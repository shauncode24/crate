import { Resolver } from './resolver.js';
import { getValidAccessToken } from '../auth/spotifyAuth.js';

// ── Keyword sets for flag derivation ────────────────────────────────────────

const LIVE_KEYWORDS = [
  'live', 'in concert', 'live at', 'live from', 'live session',
  'live version', 'live performance', 'acoustic live',
];

const REMIX_KEYWORDS = [
  'remix', 'remixed', 'sped up', 'slowed', 'nightcore', 'flip',
  'bootleg', 'edit', 'vip', 'extended mix', 'club mix', 'radio edit',
  'mashup', 'version', 're-edit',
];

/**
 * Returns true if the track name (lowercased) contains any of the keywords.
 * @param {string} name
 * @param {string[]} keywords
 */
function containsKeyword(name, keywords) {
  const lower = name.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

// ── Normalise a raw Spotify track object into a Candidate ───────────────────

/**
 * @param {object} track  - Raw Spotify track object from the search response
 * @param {'field-qualified'|'plain-combined'|'title-only'} queryRung
 * @returns {import('./resolver.js').Candidate}
 */
function normalise(track, queryRung) {
  return {
    id:          track.id,
    title:       track.name,
    artist:      track.artists?.[0]?.name ?? null,
    artists:     track.artists?.map((a) => a.name).join(', ') ?? null,
    album:       track.album?.name ?? null,
    imageUrl:    track.album?.images?.[2]?.url ?? track.album?.images?.[1]?.url ?? track.album?.images?.[0]?.url ?? null,
    releaseYear: track.album?.release_date ? track.album.release_date.split('-')[0] : null,
    popularity:  track.popularity ?? 0,
    durationMs:  track.duration_ms ?? 0,
    isLive:      containsKeyword(track.name, LIVE_KEYWORDS),
    isRemix:     containsKeyword(track.name, REMIX_KEYWORDS),
    queryRung,
  };
}

// ── SpotifyResolver ──────────────────────────────────────────────────────────

export class SpotifyResolver extends Resolver {
  /**
   * @param {number} [limit=10]  - Max candidates to return per search
   */
  constructor(limit = 10) {
    super();
    this.limit = limit;
  }

  /**
   * Calls Spotify's search endpoint with a 3-rung fallback ladder:
   *   1. field-qualified  — track:"{title}" artist:"{artist}"
   *   2. plain-combined   — "{title}" "{artist}"
   *   3. title-only       — "{title}"
   *
   * Stops at the first rung that returns ≥ 1 result.
   * Logs which rung succeeded (or that all rungs failed) to the console.
   *
   * @param {string}      title
   * @param {string|null} [artist]
   * @returns {Promise<import('./resolver.js').Candidate[]>}
   */
  async search(title, artist = null) {
    const token = await getValidAccessToken();

    const rungs = buildRungs(title, artist);

    for (const { label, query } of rungs) {
      const tracks = await searchSpotify(query, this.limit, token);

      if (tracks.length > 0) {
        console.info(`[SpotifyResolver] "${title}"${artist ? ` / "${artist}"` : ''} → rung: ${label} (${tracks.length} results)`);
        return tracks.map((t) => normalise(t, label));
      }

      console.info(`[SpotifyResolver] "${title}" rung "${label}" → 0 results, trying next…`);
    }

    console.warn(`[SpotifyResolver] "${title}" — all rungs exhausted, no results.`);
    return [];
  }
}

// ── Query ladder builder ─────────────────────────────────────────────────────

/**
 * Builds the ordered list of (label, query) pairs for the ladder.
 * Rungs that don't apply (e.g. no artist → skip field-qualified & plain-combined)
 * are omitted so we never fire pointless requests.
 *
 * @param {string}      title
 * @param {string|null} artist
 * @returns {Array<{label: string, query: string}>}
 */
function buildRungs(title, artist) {
  const rungs = [];

  if (artist) {
    rungs.push({
      label: 'field-qualified',
      query: `track:"${title}" artist:"${artist}"`,
    });
    rungs.push({
      label: 'plain-combined',
      query: `"${title}" "${artist}"`,
    });
  }

  rungs.push({
    label: 'title-only',
    query: `"${title}"`,
  });

  return rungs;
}

// ── Raw Spotify search call ──────────────────────────────────────────────────

/**
 * @param {string} query
 * @param {number} limit
 * @param {string} token
 * @returns {Promise<object[]>}  raw Spotify track objects
 */
async function searchSpotify(query, limit, token) {
  const params = new URLSearchParams({
    q:     query,
    type:  'track',
    limit: String(limit),
  });

  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    throw new Error('Spotify token expired or invalid — please log in again.');
  }
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After') ?? '?';
    throw new Error(`Spotify rate-limited. Retry after ${retryAfter}s.`);
  }
  if (!res.ok) {
    throw new Error(`Spotify search error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data?.tracks?.items ?? [];
}