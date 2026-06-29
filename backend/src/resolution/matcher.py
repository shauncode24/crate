"""
matcher.py — Phase 6: Bucketing Engine

bucket_match(parsed_song, scored_candidates) → ResolvedMatch (dict)

Thresholds:
  score ≥ AUTO_ACCEPT_THRESHOLD  →  'auto'
  score ≥ REVIEW_FLOOR           →  'review'
  score <  REVIEW_FLOOR          →  'notfound'
"""

from __future__ import annotations

# ── Tunable thresholds (mirrors matchConfig.js) ───────────────────────────────

AUTO_ACCEPT_THRESHOLD = 80
REVIEW_FLOOR          = 50
REVIEW_CANDIDATE_COUNT = 3


# ── Public API ────────────────────────────────────────────────────────────────

def bucket_match(parsed_song: dict, scored_candidates: list[dict]) -> dict:
    """
    Bucket a parsed song against its scored candidates.

    Expects scored_candidates already sorted best-first (as returned by
    rank_candidates). Re-sorts defensively.

    Returns a ResolvedMatch dict:
      {
        status:        'auto' | 'review' | 'notfound',
        chosen:        candidate dict | None,
        topCandidates: list[candidate dict],
        allCandidates: list[candidate dict],
        parsedSong:    { title, artist }
      }
    """
    # Defensive sort — best score first.
    sorted_cands = sorted(
        scored_candidates,
        key=lambda c: c.get("score", {}).get("final", 0),
        reverse=True,
    )

    best      = sorted_cands[0] if sorted_cands else None
    top_score = best["score"]["final"] if best else float("-inf")

    if best and top_score >= AUTO_ACCEPT_THRESHOLD:
        return {
            "status":        "auto",
            "chosen":        best,
            "topCandidates": [],
            "allCandidates": sorted_cands,
            "parsedSong":    {"title": parsed_song["title"], "artist": parsed_song.get("artist")},
        }

    if best and top_score >= REVIEW_FLOOR:
        return {
            "status":        "review",
            "chosen":        None,
            "topCandidates": sorted_cands[:REVIEW_CANDIDATE_COUNT],
            "allCandidates": sorted_cands,
            "parsedSong":    {"title": parsed_song["title"], "artist": parsed_song.get("artist")},
        }

    return {
        "status":        "notfound",
        "chosen":        None,
        "topCandidates": [],
        "allCandidates": sorted_cands,
        "parsedSong":    {"title": parsed_song["title"], "artist": parsed_song.get("artist")},
    }