"""
scorer.py — Phase 5: Explainable Scoring Engine

scoreCandidate(parsed_song, candidate) → ScoreBreakdown (dict)

Weights (max points):
  title_match      45
  artist_match     35
  album_match      10
  popularity        5
  modifier_penalty −15
  ─────────────────
  max "clean"      95
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
    s = re.sub(r"[''`]", "", s)           # drop apostrophes
    s = re.sub(r"[^\w\s]", " ", s)        # punctuation → space
    s = re.sub(r"\s+", " ", s).strip()
    return s


# ── Scoring constants ─────────────────────────────────────────────────────────

MAX_TITLE    = 45
MAX_ARTIST   = 35
MAX_ALBUM    = 10
MAX_POP      =  5
MODIFIER_PEN = -15


# ── Component scorers ─────────────────────────────────────────────────────────

def score_title_match(parsed_title: str, candidate_title: str) -> float:
    a = normalise(parsed_title)
    b = normalise(candidate_title)

    lev_ratio = similarity(a, b)

    tok_a = set(t for t in a.split() if t)
    tok_b = set(t for t in b.split() if t)
    intersection = len(tok_a & tok_b)
    union = len(tok_a | tok_b)
    jaccard = intersection / union if union else 0.0

    ratio = max(lev_ratio, jaccard)
    return round(ratio * MAX_TITLE, 4)


def score_artist_match(
    parsed_artist: Optional[str],
    candidate_artist: Optional[str],
    candidate_artists: Optional[str] = None,
) -> float:
    if not parsed_artist:
        return 0.0
    if not candidate_artist:
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
    exact_count = sum(1 for p in parsed_list if any(c == p for c in cand_list))
    if exact_count == len(parsed_list):
        return float(MAX_ARTIST)

    # 2. All substring/fuzzy
    fuzzy_count = sum(
        1 for p in parsed_list
        if any(c == p or c in p or p in c for c in cand_list)
    )
    if fuzzy_count == len(parsed_list):
        return 20.0

    # 3. Proportional partial
    if fuzzy_count > 0:
        return round((fuzzy_count / len(parsed_list)) * 15, 4)

    # 4. Token-overlap fallback
    parsed_norm = normalise(parsed_artist)
    combined_norm = normalise(candidate_artists) if candidate_artists else normalise(candidate_artist)
    tok_a = set(t for t in parsed_norm.split() if t)
    tok_b = set(t for t in combined_norm.split() if t)
    intersection = len(tok_a & tok_b)
    union = len(tok_a | tok_b)
    jaccard = intersection / union if union else 0.0
    if jaccard >= 0.5:
        return 15.0

    # 5. Levenshtein fallback
    primary_norm = normalise(candidate_artist)
    if similarity(parsed_norm, primary_norm) >= 0.8:
        return 10.0
    for art in cand_list:
        if similarity(parsed_norm, art) >= 0.8:
            return 10.0

    return 0.0


def score_album_match(parsed_title: str, candidate_album: Optional[str]) -> float:
    if not candidate_album:
        return 0.0

    title = normalise(parsed_title)
    album = normalise(candidate_album)

    tok_t = set(t for t in title.split() if t)
    tok_a = set(t for t in album.split() if t)
    intersection = len(tok_t & tok_a)
    union = len(tok_t | tok_a)
    jaccard = intersection / union if union else 0.0

    if jaccard >= 1.0:
        return float(MAX_ALBUM)
    if jaccard >= 0.5:
        return 5.0
    if jaccard >= 0.25:
        return 2.0
    return 0.0


def score_popularity(popularity: int) -> float:
    return round((popularity / 100) * MAX_POP, 4)


def score_modifier_penalty(is_live: bool, is_remix: bool, raw_text: Optional[str]) -> float:
    if not is_live and not is_remix:
        return 0.0

    text = (raw_text or "").lower()
    live_hints  = ["live", "concert", "session", "acoustic"]
    remix_hints = ["remix", "remixed", "sped up", "slowed", "nightcore",
                   "flip", "edit", "bootleg", "version"]

    user_wants_live  = is_live  and any(h in text for h in live_hints)
    user_wants_remix = is_remix and any(h in text for h in remix_hints)

    if is_live  and not user_wants_live:  return float(MODIFIER_PEN)
    if is_remix and not user_wants_remix: return float(MODIFIER_PEN)
    return 0.0


# ── Public API ────────────────────────────────────────────────────────────────

@dataclass
class ScoreBreakdown:
    title_match:      float
    artist_match:     float
    album_match:      float
    popularity:       float
    modifier_penalty: float
    final:            float

    def to_dict(self) -> dict:
        return {
            "titleMatch":      self.title_match,
            "artistMatch":     self.artist_match,
            "albumMatch":      self.album_match,
            "popularity":      self.popularity,
            "modifierPenalty": self.modifier_penalty,
            "final":           self.final,
        }


def score_candidate(parsed_song: dict, candidate: dict) -> ScoreBreakdown:
    """
    Score a single candidate against the parsed song.

    parsed_song keys: title, artist (str|None), raw_text (str|None)
    candidate keys:   title, artist, artists, album, popularity, is_live, is_remix
    """
    title_match      = score_title_match(parsed_song["title"], candidate["title"])
    artist_match     = score_artist_match(
        parsed_song.get("artist"),
        candidate.get("artist"),
        candidate.get("artists"),
    )
    album_match      = score_album_match(parsed_song["title"], candidate.get("album"))
    popularity       = score_popularity(candidate.get("popularity", 0))
    modifier_penalty = score_modifier_penalty(
        candidate.get("is_live", False),
        candidate.get("is_remix", False),
        parsed_song.get("raw_text"),
    )

    final = round(title_match + artist_match + album_match + popularity + modifier_penalty, 2)

    return ScoreBreakdown(
        title_match=title_match,
        artist_match=artist_match,
        album_match=album_match,
        popularity=popularity,
        modifier_penalty=modifier_penalty,
        final=final,
    )


def rank_candidates(parsed_song: dict, candidates: list[dict]) -> list[dict]:
    """Score every candidate and return them sorted best-first, with score attached."""
    scored = []
    for c in candidates:
        breakdown = score_candidate(parsed_song, c)
        scored.append({**c, "score": breakdown.to_dict()})
    scored.sort(key=lambda x: x["score"]["final"], reverse=True)
    return scored