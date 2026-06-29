"""
resolve_router.py — Phase 4-7 HTTP surface

POST   /api/resolve            — resolve a list of parsed songs against Spotify
GET    /api/resolve/cache      — return cache stats + all entries (debug panel)
DELETE /api/resolve/cache      — wipe the cache

The Spotify OAuth access token must be sent by the frontend in the
Authorization header:  Authorization: Bearer <access_token>

This keeps the token in the browser (where PKCE produced it) while
letting all the heavy logic run server-side.
"""

from __future__ import annotations
import logging

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, field_validator

from .spotify_resolver import SpotifyResolver
from .scorer           import rank_candidates
from .matcher          import bucket_match
from . import match_cache

logger = logging.getLogger(__name__)
router = APIRouter()

_resolver = SpotifyResolver(limit=8)


# ── Request / response models ─────────────────────────────────────────────────

class ParsedSong(BaseModel):
    title:   str
    artist:  str | None = None
    rawText: str | None = None   # original input line, used for modifier penalty

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("title must not be empty")
        return v


class ResolveRequest(BaseModel):
    songs: list[ParsedSong]

    @field_validator("songs")
    @classmethod
    def not_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("songs list must not be empty")
        if len(v) > 100:
            raise ValueError("maximum 100 songs per request")
        return v


class ResolveResponse(BaseModel):
    results: list[dict]   # list of ResolvedMatch dicts (opaque to Pydantic)
    cacheStats: dict


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/resolve", response_model=ResolveResponse)
async def resolve(
    body: ResolveRequest,
    authorization: str = Header(..., description="Bearer <spotify_access_token>"),
) -> ResolveResponse:
    """
    Resolve a list of parsed songs:
      1. Check cache — return immediately on hit.
      2. On miss: Spotify search → score → bucket → cache → return.
    """
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authorization header must be 'Bearer <token>'")

    token = authorization[len("bearer "):]

    results: list[dict] = []

    for song in body.songs:
        parsed = {
            "title":    song.title,
            "artist":   song.artist,
            "raw_text": song.rawText,
        }

        # ── Phase 7: cache lookup ─────────────────────────────────────────────
        cached = match_cache.get(song.title, song.artist)
        if cached is not None:
            results.append({**cached, "fromCache": True})
            continue

        # ── Cache miss: full pipeline ─────────────────────────────────────────
        try:
            candidates = await _resolver.search(song.title, song.artist, token)
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        ranked   = rank_candidates(parsed, candidates)
        resolved = bucket_match(parsed, ranked)

        match_cache.set(song.title, song.artist, resolved)
        results.append(resolved)

    return ResolveResponse(results=results, cacheStats=match_cache.get_stats())


@router.get("/resolve/cache")
async def get_cache() -> dict:
    """Return current cache stats and all stored entries (for the debug panel)."""
    return {
        "stats":   match_cache.get_stats(),
        "entries": match_cache.entries(),
    }


@router.delete("/resolve/cache", status_code=204)
async def clear_cache() -> None:
    """Wipe the in-memory cache and reset session counters."""
    match_cache.clear()