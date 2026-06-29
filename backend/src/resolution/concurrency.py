"""
concurrency.py — Phase 8: Bounded Concurrency + 429 Backoff

Two independent, composable pieces:

  run_with_concurrency(items, worker, concurrency, on_progress=None)
      Generic worker-pool. Runs `worker(item, index)` for every item, at
      most `concurrency` in flight at once — never all-at-once (rate-limit
      magnet) and never one-at-a-time (slow for no reason). The next item
      starts the instant a slot frees up. Results come back in *original*
      input order, not completion order.

      IMPORTANT: this function does not catch worker exceptions. If your
      worker can fail for an individual item in a way that shouldn't abort
      the whole batch, catch it inside the worker and return an error-shaped
      result instead of raising.

  search_with_backoff(resolver, title, artist, token, max_retries=3, on_retry=None)
      Wraps SpotifyResolver.search(). On SpotifyRateLimitError: waits
      retry_after seconds (scaled up per attempt) plus 0-500ms of random
      jitter — the jitter matters because if 5 concurrent requests get
      throttled together, you don't want all 5 retries landing in the same
      instant and immediately re-triggering the limit. Retries the whole
      search() call (all three rungs) since Spotify rate-limits the token,
      not a specific query.
"""

from __future__ import annotations
import asyncio
import logging
import random
from typing import Awaitable, Callable, TypeVar

from .spotify_resolver import SpotifyRateLimitError

logger = logging.getLogger(__name__)

T = TypeVar("T")
R = TypeVar("R")


async def run_with_concurrency(
    items: list[T],
    worker: Callable[[T, int], Awaitable[R]],
    concurrency: int,
    on_progress: Callable[[int, int], None] | None = None,
) -> list[R]:
    """Worker-pool runner. See module docstring for the contract."""
    total = len(items)
    if total == 0:
        return []

    results: list[R] = [None] * total  # type: ignore[list-item]
    completed = 0
    completed_lock = asyncio.Lock()

    queue: asyncio.Queue[int] = asyncio.Queue()
    for i in range(total):
        queue.put_nowait(i)

    async def run_one() -> None:
        nonlocal completed
        while True:
            try:
                idx = queue.get_nowait()
            except asyncio.QueueEmpty:
                return
            results[idx] = await worker(items[idx], idx)
            async with completed_lock:
                completed += 1
                if on_progress:
                    on_progress(completed, total)

    pool_size = max(1, min(concurrency, total))
    workers = [asyncio.create_task(run_one()) for _ in range(pool_size)]
    await asyncio.gather(*workers)

    return results


async def search_with_backoff(
    resolver,
    title: str,
    artist: str | None,
    token: str,
    max_retries: int = 3,
    on_retry: Callable[[int, float], None] | None = None,
) -> list[dict]:
    """
    Calls resolver.search(title, artist, token), retrying on
    SpotifyRateLimitError up to `max_retries` times with increasing backoff.

    on_retry(attempt, wait_seconds) fires right before each sleep, so the
    caller (e.g. an SSE/streaming endpoint) can surface "retrying in Ns"
    instead of the request just appearing to hang.
    """
    attempt = 0
    while True:
        try:
            return await resolver.search(title, artist, token)
        except SpotifyRateLimitError as exc:
            attempt += 1
            if attempt > max_retries:
                logger.warning(
                    '[Backoff] "%s" — exhausted %d retries, giving up.',
                    title, max_retries,
                )
                raise RuntimeError(
                    f"Spotify rate-limited '{title}' after {max_retries} retries."
                ) from exc

            jitter = random.uniform(0, 0.5)
            wait_s = exc.retry_after * attempt + jitter  # increasing backoff
            logger.info(
                '[Backoff] "%s" — 429 (attempt %d/%d), retrying in %.2fs',
                title, attempt, max_retries, wait_s,
            )
            if on_retry:
                on_retry(attempt, wait_s)
            await asyncio.sleep(wait_s)