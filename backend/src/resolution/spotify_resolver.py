"""
spotify_resolver.py — Phase 4: Spotify Search

SpotifyResolver.search(title, artist?) → list[Candidate dict]

Three-rung query ladder:
  1. field-qualified  — track:"title" artist:"artist"
  2. plain-combined   — "title" "artist"
  3. title-only       — "title"

Stops at the first rung that returns ≥ 1 result.
Uses the user's OAuth access token (passed in per-request).
"""

from __future__ import annotations
import logging
import re
import httpx

logger = logging.getLogger(__name__)


class SpotifyRateLimitError(Exception):
    """
    Raised when Spotify returns 429 Too Many Requests.

    Carries `retry_after` (seconds, from the Retry-After header) so callers
    can back off correctly instead of treating this as a hard failure —
    a 429 is an expected, recoverable condition, not an error.
    """

    def __init__(self, retry_after: float):
        self.retry_after = retry_after
        super().__init__(f"Spotify rate-limited — retry after {retry_after}s")


# ── Keyword sets for flag derivation (mirrors spotifyResolver.js) ─────────────

LIVE_KEYWORDS = [
    "live", "in concert", "live at", "live from", "live session",
    "live version", "live performance", "acoustic live",
]

REMIX_KEYWORDS = [
    "remix", "remixed", "sped up", "slowed", "nightcore", "flip",
    "bootleg", "edit", "vip", "extended mix", "club mix", "radio edit",
    "mashup", "version", "re-edit",
]


def _contains_keyword(name: str, keywords: list[str]) -> bool:
    lower = name.lower()
    return any(kw in lower for kw in keywords)


def _normalise_track(track: dict, query_rung: str) -> dict:
    """Convert a raw Spotify track object to a Candidate dict."""
    artists = track.get("artists") or []
    images  = (track.get("album") or {}).get("images") or []

    # Prefer the smallest thumbnail (index 2), fall back to larger ones.
    image_url = None
    for idx in (2, 1, 0):
        if idx < len(images):
            image_url = images[idx].get("url")
            break

    release_date = (track.get("album") or {}).get("release_date", "")

    return {
        "id":          track["id"],
        "title":       track["name"],
        "artist":      artists[0]["name"] if artists else None,
        "artists":     ", ".join(a["name"] for a in artists) if artists else None,
        "album":       (track.get("album") or {}).get("name"),
        "imageUrl":    image_url,
        "releaseYear": release_date.split("-")[0] if release_date else None,
        "popularity":  track.get("popularity", 0),
        "durationMs":  track.get("duration_ms", 0),
        "isLive":      _contains_keyword(track["name"], LIVE_KEYWORDS),
        "isRemix":     _contains_keyword(track["name"], REMIX_KEYWORDS),
        "queryRung":   query_rung,
    }


def _build_rungs(title: str, artist: str | None) -> list[dict]:
    """Build the ordered query ladder. Omits artist rungs when artist is None."""
    rungs = []
    if artist:
        rungs.append({
            "label": "field-qualified",
            "query": f'track:"{title}" artist:"{artist}"',
        })
        rungs.append({
            "label": "plain-combined",
            "query": f'"{title}" "{artist}"',
        })
    rungs.append({
        "label": "title-only",
        "query": f'"{title}"',
    })
    return rungs


async def _search_spotify(query: str, limit: int, token: str) -> list[dict]:
    """Raw Spotify /v1/search call. Returns list of track objects."""
    params = {"q": query, "type": "track", "limit": str(limit)}

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(
            "https://api.spotify.com/v1/search",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )

    if res.status_code == 401:
        raise RuntimeError("Spotify token expired or invalid — please log in again.")
    if res.status_code == 429:
        raw = res.headers.get("Retry-After", "1")
        try:
            retry_after = float(raw)
        except ValueError:
            retry_after = 1.0
        raise SpotifyRateLimitError(retry_after)
    if not res.is_success:
        raise RuntimeError(f"Spotify search error {res.status_code}: {res.text}")

    return res.json().get("tracks", {}).get("items", [])


class SpotifyResolver:
    def __init__(self, limit: int = 8):
        self.limit = limit

    async def search(
        self,
        title: str,
        artist: str | None,
        token: str,
    ) -> list[dict]:
        """
        Search Spotify via the query ladder, return normalised Candidate dicts.

        token — user's OAuth access token (passed through from the request header).
        """
        rungs = _build_rungs(title, artist)

        for rung in rungs:
            tracks = await _search_spotify(rung["query"], self.limit, token)
            if tracks:
                logger.info(
                    '[SpotifyResolver] "%s"%s → rung: %s (%d results)',
                    title,
                    f' / "{artist}"' if artist else "",
                    rung["label"],
                    len(tracks),
                )
                return [_normalise_track(t, rung["label"]) for t in tracks]

            logger.info(
                '[SpotifyResolver] "%s" rung "%s" → 0 results, trying next…',
                title,
                rung["label"],
            )

        logger.warning('[SpotifyResolver] "%s" — all rungs exhausted.', title)
        return []