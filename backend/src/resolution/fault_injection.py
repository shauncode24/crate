"""
fault_injection.py — TODO(phase-8-cleanup): test-only fault injector.

Used exclusively by the concurrency playground (POST /api/resolve/stream
with simulate429At set) to deterministically trigger a 429 partway through
a batch, so the retry/backoff path can be exercised without waiting around
for Spotify to actually throttle us. Never used by the production
/api/resolve endpoint.
"""

from __future__ import annotations
import asyncio

from .spotify_resolver import SpotifyResolver, SpotifyRateLimitError


class Simulated429Injector:
    """
    Wraps a real SpotifyResolver. Counts calls across the whole batch
    (shared counter, since requests run concurrently) and raises exactly
    one fake SpotifyRateLimitError when the counter hits `at_index`, then
    delegates to the real resolver for everything else.
    """

    def __init__(self, real_resolver: SpotifyResolver, at_index: int, fake_retry_after: float = 3.0):
        self._real = real_resolver
        self._at_index = at_index
        self._fake_retry_after = fake_retry_after
        self._calls = 0
        self._fired = False
        self._lock = asyncio.Lock()

    async def search(self, title: str, artist: str | None, token: str) -> list[dict]:
        async with self._lock:
            self._calls += 1
            should_fire = self._calls == self._at_index and not self._fired
            if should_fire:
                self._fired = True

        if should_fire:
            raise SpotifyRateLimitError(self._fake_retry_after)

        return await self._real.search(title, artist, token)