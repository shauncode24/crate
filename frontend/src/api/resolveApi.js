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

/**
 * Aggregate the session matches, duplicate mappings, and commit transactions
 * into a structured final import report.
 *
 * @param {Array<object>} resolvedMatches - The list of matches confirmed by the user
 * @param {object} duplicateInfo - { exactTrackIds: string[], nearDuplicateTrackIds: object }
 * @param {object} commitResult - { succeededChunks: number[], failedChunks: Array<{ index, error }> }
 * @returns {object} The structured import report
 */
export function buildImportReport(resolvedMatches, duplicateInfo, commitResult) {
  const { exactTrackIds = [], nearDuplicateTrackIds = {} } = duplicateInfo || {};
  const { succeededChunks = [], failedChunks = [] } = commitResult || {};

  const added = [];
  const skippedDuplicate = [];
  const notFound = [];
  const failed = [];

  let committedIndex = 0;
  const chunkSize = 100;

  for (let i = 0; i < resolvedMatches.length; i++) {
    const match = resolvedMatches[i];
    if (!match) continue;

    const rawText = match.parsedSong?.rawText || match.parsedSong?.title || `Song #${i + 1}`;

    // Not found bucket
    if (match.status === 'notfound') {
      notFound.push({ rawText });
      continue;
    }

    // Skipped duplicate bucket
    const isExactDup = match.isDuplicate || (match.chosen && exactTrackIds.includes(match.chosen.id));
    const isNearDup = match.duplicateWarning || (match.chosen && nearDuplicateTrackIds[match.chosen.id]);

    if (match.status === 'skipped') {
      if (isExactDup || isNearDup) {
        let matchedWith = '';
        if (isNearDup) {
          matchedWith = match.duplicateWarning 
            ? match.duplicateWarning.replace('Already in playlist as "', '').replace('"', '')
            : nearDuplicateTrackIds[match.chosen.id];
        } else if (match.chosen) {
          matchedWith = match.chosen.title;
        }

        skippedDuplicate.push({
          ...(match.chosen || {}),
          title: match.parsedSong?.title || (match.chosen && match.chosen.title) || 'Unknown Track',
          artist: match.parsedSong?.artist || (match.chosen && (match.chosen.artists || match.chosen.artist)) || 'Unknown Artist',
          matchedWith: matchedWith || 'Exact duplicate'
        });
      } else {
        // Treat manual skips as skippedDuplicate for reconciliation purposes
        skippedDuplicate.push({
          ...(match.chosen || {}),
          title: match.parsedSong?.title || (match.chosen && match.chosen.title) || 'Unknown Track',
          artist: match.parsedSong?.artist || (match.chosen && (match.chosen.artists || match.chosen.artist)) || 'Unknown Artist',
          matchedWith: 'Manually skipped'
        });
      }
      continue;
    }

    // Attempted to commit
    if (match.chosen && match.chosen.id) {
      const chunkIndex = Math.floor(committedIndex / chunkSize);
      committedIndex++;

      const isSucceeded = succeededChunks.includes(chunkIndex);
      const failObj = failedChunks.find(f => f.index === chunkIndex);

      const trackInfo = {
        ...match.chosen,
        confidence: match.chosen.score?.final 
          ? Math.round(match.chosen.score.final * 100) 
          : 90
      };

      if (isSucceeded) {
        added.push(trackInfo);
      } else if (failObj) {
        failed.push({
          ...trackInfo,
          chunk: chunkIndex,
          error: failObj.error || 'Spotify chunk transaction error'
        });
      } else {
        // Fallback (e.g. if no playlist selected, so commitResult has no chunks)
        added.push(trackInfo);
      }
    } else {
      notFound.push({ rawText });
    }
  }

  return {
    added,
    skippedDuplicate,
    notFound,
    failed,
    counts: {
      added: added.length,
      skippedDuplicate: skippedDuplicate.length,
      notFound: notFound.length,
      failed: failed.length,
      total: added.length + skippedDuplicate.length + notFound.length + failed.length
    }
  };
}

/**
 * Compute run-level observability metrics from the per-song resolution logs
 * collected during a stream run and the parse-method tags from Phase 2/3.
 *
 * @param {Array<{
 *   rawText: string,
 *   queryRung: string,
 *   topCandidateScore: number,
 *   cacheHit: boolean,
 *   latencyMs: number
 * }>} logs — one entry per resolved song, in resolution order
 *
 * @param {Array<{ parseMethod?: string }>} parsedSongs
 *   — the array extracted in Phase 2/3 (may contain parseMethod:'llm'|'heuristic')
 *
 * @param {number} retryCount — total 429 retries observed during this run
 *
 * @returns {{
 *   avgLatencyMs: number,
 *   avgTopConfidence: number,
 *   cacheHitRate: number,
 *   llmFallbackRate: number,
 *   retryCount: number
 * }}
 */
export function summarizeRun(logs = [], parsedSongs = [], retryCount = 0) {
  try {
    const n = logs.length;

    const avgLatencyMs = n
      ? Math.round(logs.reduce((sum, l) => sum + (l.latencyMs ?? 0), 0) / n)
      : 0;

    const avgTopConfidence = n
      ? Math.round(
          (logs.reduce((sum, l) => sum + (l.topCandidateScore ?? 0), 0) / n) * 10
        ) / 10
      : 0;

    const cacheHits = logs.filter((l) => l.cacheHit === true).length;
    const cacheHitRate = n ? Math.round((cacheHits / n) * 100) / 100 : 0;

    const total = parsedSongs.length;
    const llmCount = parsedSongs.filter((s) => s?.parseMethod === 'llm').length;
    const llmFallbackRate = total ? Math.round((llmCount / total) * 100) / 100 : 0;

    return {
      avgLatencyMs,
      avgTopConfidence,
      cacheHitRate,
      llmFallbackRate,
      retryCount: retryCount ?? 0,
    };
  } catch (err) {
    console.warn('[summarizeRun] Failed to compute metrics:', err);
    return { avgLatencyMs: 0, avgTopConfidence: 0, cacheHitRate: 0, llmFallbackRate: 0, retryCount: 0 };
  }
}