"""
match_cache.py — Phase 7: Server-Side Resolution Cache

In-memory dict keyed by normalize_key(title, artist).
Lives for the lifetime of the backend process.

For a single-user portfolio project this is sufficient and avoids the
localStorage 5 MB quota and JSON serialisation overhead. If you later
want persistence across server restarts, swap _store for a shelve/SQLite
backend without changing the public API.

Public API
──────────
  normalize_key(title, artist?) → str
  get(title, artist?)           → ResolvedMatch dict | None
  set(title, artist?, match)    → None
  get_stats()                   → dict
  clear()                       → None
  entries()                     → list[dict]   (for the debug endpoint)
"""

from __future__ import annotations
import logging
import re

logger = logging.getLogger(__name__)

# ── Storage & counters ────────────────────────────────────────────────────────

_store: dict[str, dict] = {}
_session_hits   = 0
_session_misses = 0


# ── Key normalisation (mirrors matchCache.js normalizeKey) ────────────────────

def normalize_key(title: str, artist: str | None = None) -> str:
    """
    Stable, collision-resistant cache key.

    Examples:
      ("Painted Skies", "Elaine")    → "painted skies|elaine"
      ("painted skies ", " Elaine")  → "painted skies|elaine"
      ("Can't Help Myself", None)    → "cant help myself|"
    """
    def clean(s: str) -> str:
        s = (s or "").lower()
        s = re.sub(r"[''`]", "", s)          # drop apostrophes
        s = re.sub(r"[^\w\s]", " ", s)       # punctuation → space
        s = re.sub(r"\s+", " ", s).strip()
        return s

    return f"{clean(title)}|{clean(artist or '')}"


# ── Public API ────────────────────────────────────────────────────────────────

def get(title: str, artist: str | None = None) -> dict | None:
    global _session_hits, _session_misses
    key = normalize_key(title, artist)
    hit = _store.get(key)
    if hit is not None:
        _session_hits += 1
        logger.info('[MatchCache] HIT  "%s" (session hits: %d)', key, _session_hits)
    else:
        _session_misses += 1
        logger.info('[MatchCache] MISS "%s" (session misses: %d)', key, _session_misses)
    return hit


def set(title: str, artist: str | None, resolved_match: dict) -> None:  # noqa: A001
    key = normalize_key(title, artist)
    _store[key] = resolved_match
    logger.info('[MatchCache] SET  "%s"', key)


def get_stats() -> dict:
    total    = _session_hits + _session_misses
    hit_rate = (_session_hits / total) if total else 0.0
    return {
        "hits":    _session_hits,
        "misses":  _session_misses,
        "size":    len(_store),
        "hitRate": round(hit_rate, 4),
    }


def clear() -> None:
    global _session_hits, _session_misses
    _store.clear()
    _session_hits   = 0
    _session_misses = 0
    logger.info("[MatchCache] Cache cleared.")


def entries() -> list[dict]:
    return [{"key": k, "match": v} for k, v in _store.items()]