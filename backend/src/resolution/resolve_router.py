"""
resolve_router.py — Phase 4-8 HTTP surface

POST   /api/resolve            — resolve a list of parsed songs against Spotify
POST   /api/resolve/stream      — same thing, but streams NDJSON progress/retry
                                   events as it goes (Phase 8 test harness)
GET    /api/resolve/cache       — return cache stats + all entries (debug panel)
DELETE /api/resolve/cache       — wipe the cache

The Spotify OAuth access token must be sent by the frontend in the
Authorization header:  Authorization: Bearer <access_token>
"""

from __future__ import annotations
import asyncio
import json
import logging

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator

from .spotify_resolver import SpotifyResolver
from .scorer            import rank_candidates
from .matcher           import bucket_match
from .concurrency       import run_with_concurrency, search_with_backoff
from .fault_injection   import Simulated429Injector
from . import match_cache

logger = logging.getLogger(__name__)
router = APIRouter()

_resolver = SpotifyResolver(limit=8)

RESOLVE_CONCURRENCY = 5   # in-flight Spotify searches at once — Phase 8
MAX_RETRIES         = 3   # 429 retry attempts before giving up on a song


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


class StreamResolveRequest(ResolveRequest):
    # TODO(phase-8-cleanup): test-only fault injection for the concurrency
    # playground. Never set by production UI code (resolveSongs() in
    # resolveApi.js never sends this field).
    simulate429At: int | None = None


class ResolveResponse(BaseModel):
    results: list[dict]   # list of ResolvedMatch dicts (opaque to Pydantic)
    cacheStats: dict


# ── Shared per-song resolution (used by both /resolve and /resolve/stream) ────

async def _resolve_one(
    song: ParsedSong,
    token: str,
    *,
    resolver: SpotifyResolver | Simulated429Injector | None = None,
    on_retry=None,
) -> dict:
    """
    Resolve a single song: cache check → search (with backoff) → score → bucket → cache.

    Never raises — a song that ultimately fails (rate-limited past
    max_retries, Spotify error, etc.) comes back as a status:"error" dict
    instead of killing the rest of the batch. This is what makes it safe
    to use as a worker inside run_with_concurrency.
    """
    resolver = resolver or _resolver
    parsed = {"title": song.title, "artist": song.artist, "raw_text": song.rawText}

    cached = match_cache.get(song.title, song.artist)
    if cached is not None:
        return {**cached, "fromCache": True, "retries": 0}

    retry_count = 0

    def _track_retry(attempt: int, wait_s: float) -> None:
        nonlocal retry_count
        retry_count = attempt
        if on_retry:
            on_retry(attempt, wait_s)

    try:
        candidates = await search_with_backoff(
            resolver, song.title, song.artist, token,
            max_retries=MAX_RETRIES, on_retry=_track_retry,
        )
    except RuntimeError as exc:
        return {
            "status":        "error",
            "chosen":        None,
            "topCandidates": [],
            "allCandidates": [],
            "parsedSong":    {"title": song.title, "artist": song.artist},
            "error":         str(exc),
            "retries":       retry_count,
        }

    ranked   = rank_candidates(parsed, candidates)
    resolved = bucket_match(parsed, ranked)
    resolved["retries"] = retry_count

    match_cache.set(song.title, song.artist, resolved)
    return resolved


def _check_auth(authorization: str) -> str:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authorization header must be 'Bearer <token>'")
    return authorization[len("bearer "):]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/resolve", response_model=ResolveResponse)
async def resolve(
    body: ResolveRequest,
    authorization: str = Header(..., description="Bearer <spotify_access_token>"),
) -> ResolveResponse:
    """
    Resolve a list of parsed songs, up to RESOLVE_CONCURRENCY in flight at
    once, retrying individual 429s with backoff. Cache hits, successes, and
    errors are all returned — nothing is dropped.
    """
    token = _check_auth(authorization)

    async def worker(song: ParsedSong, _index: int) -> dict:
        return await _resolve_one(song, token)

    results = await run_with_concurrency(body.songs, worker, RESOLVE_CONCURRENCY)
    return ResolveResponse(results=results, cacheStats=match_cache.get_stats())


@router.post("/resolve/stream")
async def resolve_stream(
    body: StreamResolveRequest,
    authorization: str = Header(..., description="Bearer <spotify_access_token>"),
) -> StreamingResponse:
    """
    Same pipeline as /resolve, but streams newline-delimited JSON events as
    it goes, so a UI can show live progress and "retrying in Ns" instead of
    a single blocking response:

      {"type": "progress", "completed": N, "total": T}
      {"type": "retry", "index": i, "title": "...", "attempt": k, "maxRetries": 3, "waitSeconds": 4.21}
      {"type": "done", "results": [...], "cacheStats": {...}}
    """
    token = _check_auth(authorization)

    resolver = _resolver
    if body.simulate429At is not None:
        resolver = Simulated429Injector(_resolver, at_index=body.simulate429At)

    events: asyncio.Queue = asyncio.Queue()

    async def worker(song: ParsedSong, idx: int) -> dict:
        def on_retry(attempt: int, wait_s: float) -> None:
            events.put_nowait({
                "type":       "retry",
                "index":      idx,
                "title":      song.title,
                "attempt":    attempt,
                "maxRetries": MAX_RETRIES,
                "waitSeconds": round(wait_s, 2),
            })
        result = await _resolve_one(song, token, resolver=resolver, on_retry=on_retry)
        events.put_nowait({"type": "result", "index": idx, "result": result})
        return result

    def on_progress(completed: int, total: int) -> None:
        events.put_nowait({"type": "progress", "completed": completed, "total": total})

    async def run() -> None:
        results = await run_with_concurrency(body.songs, worker, RESOLVE_CONCURRENCY, on_progress=on_progress)
        events.put_nowait({"type": "done", "results": results, "cacheStats": match_cache.get_stats()})
        events.put_nowait(None)  # sentinel — tells event_stream() to stop

    runner_task = asyncio.create_task(run())

    async def event_stream():
        try:
            while True:
                item = await events.get()
                if item is None:
                    break
                yield json.dumps(item) + "\n"
        finally:
            await runner_task

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


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


class CheckDuplicatesRequest(BaseModel):
    resolvedMatches: list[dict]
    existingTracks: list[dict]

@router.post("/resolve/check-duplicates")
async def check_duplicates_endpoint(body: CheckDuplicatesRequest) -> dict:
    """Check resolved matches against existing tracks in the playlist."""
    from .duplicates import check_duplicates
    logger.info("[Duplicates API] incoming resolvedMatches: %d items", len(body.resolvedMatches))
    logger.info("[Duplicates API] incoming existingTracks: %d items", len(body.existingTracks))
    res = await check_duplicates(body.resolvedMatches, body.existingTracks)
    logger.info("[Duplicates API] result: %s", str(res))
    return res