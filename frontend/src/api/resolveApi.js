/**
 * resolveApi.js — Frontend client for the /api/resolve endpoint.
 *
 * This is the only file the frontend needs for resolution now.
 * All Spotify search, scoring, bucketing, and caching happens server-side.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

/**
 * Resolve an array of parsed songs via the backend pipeline.
 *
 * The backend runs: Spotify search → score → bucket → cache
 * and returns the same ResolvedMatch shape the frontend already knows how
 * to render (status, chosen, topCandidates, allCandidates, parsedSong).
 *
 * @param {Array<{ title: string, artist: string|null, rawText?: string }>} songs
 * @param {string} spotifyAccessToken  — user's OAuth token from getValidAccessToken()
 * @returns {Promise<{ results: ResolvedMatch[], cacheStats: object }>}
 */
export async function resolveSongs(songs, spotifyAccessToken) {
  const res = await fetch(`${API_BASE}/api/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${spotifyAccessToken}`,
    },
    body: JSON.stringify({ songs }),
  });

  if (res.status === 401) {
    throw new Error('Spotify token expired — please log in again.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Backend error ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch cache stats and all stored entries from the backend.
 * Used by the cache debug panel.
 *
 * @returns {Promise<{ stats: object, entries: Array<{ key: string, match: object }> }>}
 */
export async function getCacheState() {
  const res = await fetch(`${API_BASE}/api/resolve/cache`);
  if (!res.ok) throw new Error(`Cache fetch error ${res.status}`);
  return res.json();
}

/**
 * Wipe the server-side cache.
 */
export async function clearCache() {
  const res = await fetch(`${API_BASE}/api/resolve/cache`, { method: 'DELETE' });
  if (res.status !== 204 && !res.ok) throw new Error(`Cache clear error ${res.status}`);
}