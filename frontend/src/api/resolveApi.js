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

/**
 * Resolve songs via the streaming endpoint (Phase 8 test harness).
 * Reads the response as newline-delimited JSON and calls onEvent for each
 * line: {type:"progress"|"retry"|"done", ...}.
 *
 * @param {Array<{title, artist, rawText}>} songs
 * @param {string} spotifyAccessToken
 * @param {(event: object) => void} onEvent
 * @param {number|null} simulate429At — TODO(phase-8-cleanup): dev-only fault injection
 */
export async function resolveSongsStream(songs, spotifyAccessToken, onEvent, simulate429At = null) {
  const res = await fetch(`${API_BASE}/api/resolve/stream`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${spotifyAccessToken}`,
    },
    body: JSON.stringify({
      songs,
      ...(simulate429At != null ? { simulate429At } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Backend error ${res.status}`);
  }
  if (!res.body) {
    throw new Error('Streaming not supported by this browser.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer.trim()));
}

/**
 * Commit a list of track URIs to a target Spotify playlist in chunks of at most 100 tracks.
 * Catches errors per chunk so that one failing chunk does not abort the rest.
 * On 401 Unauthorized, automatically refreshes the token once and retries the chunk.
 *
 * @param {string} initialToken - User's Spotify OAuth access token
 * @param {string} playlistId - ID of the target Spotify playlist
 * @param {Array<string>} trackUris - Array of track URIs (e.g. ["spotify:track:xxxx", ...])
 * @returns {Promise<{ succeededChunks: number[], failedChunks: Array<{ index: number, error: string }> }>}
 */
export async function commitToPlaylist(initialToken, playlistId, trackUris) {
  const chunkSize = 100;
  const chunks = [];
  for (let i = 0; i < trackUris.length; i += chunkSize) {
    chunks.push(trackUris.slice(i, i + chunkSize));
  }

  let token = initialToken;
  const succeededChunks = [];
  const failedChunks = [];

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    let attempt = 0;
    let success = false;
    let lastError = '';

    while (attempt < 2 && !success) {
      attempt++;
      try {
        const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ uris: chunk })
        });

        if (res.status === 401) {
          if (attempt === 1) {
            // Re-import dynamically to avoid circular dependencies or load failures
            const { getValidAccessToken } = await import('../auth/spotifyAuth.js');
            token = await getValidAccessToken();
            continue; // retry with new token
          } else {
            throw new Error('Spotify session expired. Please log in again.');
          }
        }

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error?.message ?? `Spotify API error ${res.status}`);
        }

        success = true;
        succeededChunks.push(idx);
      } catch (err) {
        lastError = err.message || 'Unknown network error';
        if (attempt >= 2 || token === initialToken) {
          // If we got here and didn't retry (or already retried), it failed.
          break;
        }
      }
    }

    if (!success) {
      failedChunks.push({ index: idx, error: lastError });
    }
  }

  return { succeededChunks, failedChunks };
}