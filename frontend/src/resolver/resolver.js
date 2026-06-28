/**
 * @typedef {Object} Candidate
 * @property {string}  id          - Spotify track ID
 * @property {string}  title       - Track name (as returned by Spotify)
 * @property {string}  artist      - Primary artist name
 * @property {string}  [artists]   - Comma-separated list of all artist names
 * @property {string}  album       - Album name
 * @property {string}  [imageUrl]  - Album cover image URL
 * @property {string}  [releaseYear]- Album release year
 * @property {number}  popularity  - Spotify popularity 0–100
 * @property {number}  durationMs  - Track duration in milliseconds
 * @property {boolean} isLive      - Derived from track name keywords
 * @property {boolean} isRemix     - Derived from track name keywords
 * @property {'field-qualified'|'plain-combined'|'title-only'} queryRung
 *   - Which rung of the query ladder produced this result
 */

/**
 * Resolver interface.
 *
 * All implementations must expose a single method:
 *   search(title, artist?) → Promise<Candidate[]>
 *
 * The returned array is normalised to Candidate shape regardless of the
 * underlying provider — the scoring engine (Phase 5) only ever sees
 * Candidate[], never raw Spotify JSON or any other provider's shape.
 *
 * @interface
 */
export class Resolver {
  /**
   * @param {string}      title
   * @param {string|null} [artist]
   * @returns {Promise<Candidate[]>}
   */
  // eslint-disable-next-line no-unused-vars
  async search(title, artist = null) {
    throw new Error('Resolver.search() must be implemented by a subclass.');
  }
}