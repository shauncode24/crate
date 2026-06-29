"""
scorer.py — Phase 5: Explainable Scoring Engine

Weighted average on a 0–1 scale:

  score = (0.40 × title) + (0.25 × artist) + (0.35 × popularity)
  final = score × modifier_factor

  modifier_factor = 0.60  if candidate is live/remix and user didn't ask for it
  modifier_factor = 1.00  otherwise

  max final = 1.0  (perfect title + perfect artist + popularity 100 + no penalty)

Weights
  title      0.40  — primary signal: are these the same song?
  artist     0.25  — strong when present; neutral (0.0) when artist is null
  popularity 0.35  — large enough to surface canonical versions over obscure ones

Modifier factor (multiplicative, so score stays in [0, 1])
  0.60  unrequested live/remix version
  1.00  clean match or user explicitly asked for live/remix
"""

from __future__ import annotations
import re
from dataclasses import dataclass
from typing import Optional


# ── String helpers ────────────────────────────────────────────────────────────

def levenshtein(a: str, b: str) -> int:
    """Classic DP Levenshtein distance."""
    m, n = len(a), len(b)
    d = list(range(n + 1))
    for i in range(1, m + 1):
        prev = d[:]
        d[0] = i
        for j in range(1, n + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            d[j] = min(prev[j] + 1, d[j - 1] + 1, prev[j - 1] + cost)
    return d[n]


def similarity(a: str, b: str) -> float:
    """Normalised similarity in [0, 1] derived from Levenshtein."""
    if a == b:
        return 1.0
    max_len = max(len(a), len(b))
    if max_len == 0:
        return 1.0
    return 1.0 - levenshtein(a, b) / max_len


def normalise(s: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    s = s.lower()
    s = re.sub(r"[''`]", "", s)
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


# ── Weights & factors ─────────────────────────────────────────────────────────

W_TITLE      = 0.40
W_ARTIST     = 0.25
W_POPULARITY = 0.35
MODIFIER_FACTOR = 0.60   # applied when live/remix not requested


# ── Component scorers (each returns 0.0–1.0) ─────────────────────────────────

def score_title(parsed_title: str, candidate_title: str) -> float:
    """
    0–1. Takes the higher of Levenshtein ratio and Jaccard token overlap,
    so word-order variants ("You & Me" vs "You and Me") still score well.
    """
    a = normalise(parsed_title)
    b = normalise(candidate_title)

    lev = similarity(a, b)

    tok_a = set(t for t in a.split() if t)
    tok_b = set(t for t in b.split() if t)
    union = len(tok_a | tok_b)
    jaccard = len(tok_a & tok_b) / union if union else 0.0

    return round(max(lev, jaccard), 6)


def score_artist(
    parsed_artist: Optional[str],
    candidate_artist: Optional[str],
    candidate_artists: Optional[str] = None,
) -> float:
    """
    0–1. Returns 0.0 (neutral) when no artist was parsed — not a penalty.

    Tiers:
      1.00  all parsed artists match exactly
      0.80  all parsed artists match via substring / containment
      0.50  proportional partial match
      0.43  token-overlap Jaccard >= 0.5
      0.29  Levenshtein ratio >= 0.8 (typo / transliteration tolerance)
      0.00  no match
    """
    if not parsed_artist or not candidate_artist:
        return 0.0

    parsed_list = [normalise(a.strip()) for a in parsed_artist.split(",") if a.strip()]
    if not parsed_list:
        return 0.0

    cand_list = (
        [normalise(a.strip()) for a in candidate_artists.split(",") if a.strip()]
        if candidate_artists
        else [normalise(candidate_artist)]
    )

    # 1. All exact
    exact = sum(1 for p in parsed_list if any(c == p for c in cand_list))
    if exact == len(parsed_list):
        return 1.0

    # 2. All substring/fuzzy
    fuzzy = sum(
        1 for p in parsed_list
        if any(c == p or c in p or p in c for c in cand_list)
    )
    if fuzzy == len(parsed_list):
        return 0.80

    # 3. Proportional partial
    if fuzzy > 0:
        return round((fuzzy / len(parsed_list)) * 0.50, 6)

    # 4. Token-overlap fallback
    parsed_norm   = normalise(parsed_artist)
    combined_norm = normalise(candidate_artists) if candidate_artists else normalise(candidate_artist)
    tok_a = set(t for t in parsed_norm.split() if t)
    tok_b = set(t for t in combined_norm.split() if t)
    union = len(tok_a | tok_b)
    jaccard = len(tok_a & tok_b) / union if union else 0.0
    if jaccard >= 0.5:
        return 0.43

    # 5. Levenshtein fallback
    primary_norm = normalise(candidate_artist)
    if similarity(parsed_norm, primary_norm) >= 0.8:
        return 0.29
    if any(similarity(parsed_norm, art) >= 0.8 for art in cand_list):
        return 0.29

    return 0.0


def score_popularity(popularity: int) -> float:
    """0–1 linear scale of Spotify's 0–100 popularity field."""
    return round(max(0, min(popularity, 100)) / 100, 6)


def score_modifier_factor(is_live: bool, is_remix: bool, raw_text: Optional[str]) -> float:
    """
    Returns MODIFIER_FACTOR (0.60) if the candidate carries a live/remix flag
    the user didn't ask for; 1.0 otherwise.
    """
    if not is_live and not is_remix:
        return 1.0

    text = (raw_text or "").lower()
    live_hints  = ["live", "concert", "session", "acoustic"]
    remix_hints = ["remix", "remixed", "sped up", "slowed", "nightcore",
                   "flip", "edit", "bootleg", "version"]

    if is_live  and not any(h in text for h in live_hints):
        return MODIFIER_FACTOR
    if is_remix and not any(h in text for h in remix_hints):
        return MODIFIER_FACTOR
    return 1.0


# ── Public API ────────────────────────────────────────────────────────────────

@dataclass
class ScoreBreakdown:
    title:           float   # 0–1 component
    artist:          float   # 0–1 component
    popularity:      float   # 0–1 component
    modifier_factor: float   # 1.0 or 0.60
    final:           float   # weighted average × modifier_factor, 0–1

    def to_dict(self) -> dict:
        return {
            "title":          self.title,
            "artist":         self.artist,
            "popularity":     self.popularity,
            "modifierFactor": self.modifier_factor,
            "final":          self.final,
        }


def score_candidate(parsed_song: dict, candidate: dict) -> ScoreBreakdown:
    """
    Score a single candidate against the parsed song.

    parsed_song keys: title, artist (str|None), raw_text (str|None)
    candidate keys:   title, artist, artists, popularity, is_live, is_remix

    Worked example — clean match:
      parsed  : { title: "Painted Skies", artist: "Elaine" }
      candidate: { title: "Painted Skies", artist: "Elaine", popularity: 61 }

      title      = 1.0000
      artist     = 1.0000
      popularity = 0.6100
      weighted   = (0.40×1.0) + (0.25×1.0) + (0.35×0.61) = 0.8635
      modifier   = 1.00
      final      = 0.86

    Worked example — unrequested live version:
      candidate: { title: "Painted Skies (Live)", artist: "Elaine", popularity: 40 }

      title      ≈ 0.79  (live suffix degrades similarity)
      artist     = 1.00
      popularity = 0.40
      weighted   = (0.40×0.79) + (0.25×1.00) + (0.35×0.40) = 0.716
      modifier   = 0.60
      final      ≈ 0.43
    """
    t  = score_title(parsed_song["title"], candidate["title"])
    a  = score_artist(
        parsed_song.get("artist"),
        candidate.get("artist"),
        candidate.get("artists"),
    )
    p  = score_popularity(candidate.get("popularity", 0))
    mf = score_modifier_factor(
        candidate.get("is_live", False),
        candidate.get("is_remix", False),
        parsed_song.get("raw_text"),
    )

    weighted = (W_TITLE * t) + (W_ARTIST * a) + (W_POPULARITY * p)
    final    = round(weighted * mf, 4)

    return ScoreBreakdown(
        title=t,
        artist=a,
        popularity=p,
        modifier_factor=mf,
        final=final,
    )


def rank_candidates(parsed_song: dict, candidates: list[dict]) -> list[dict]:
    """Score every candidate and return them sorted best-first, with score attached."""
    scored = [
        {**c, "score": score_candidate(parsed_song, c).to_dict()}
        for c in candidates
    ]
    scored.sort(key=lambda x: x["score"]["final"], reverse=True)
    return scored