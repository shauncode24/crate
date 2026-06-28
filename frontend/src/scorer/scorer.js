/**
 * scorer.js — Phase 5: Explainable Scoring Engine
 *
 * scoreCandidate(parsedSong, candidate) → ScoreBreakdown
 *
 * Every component is a named function returning a number.  The breakdown
 * object carries all components plus the final sum, so any wrong ranking
 * can be explained by pointing at exactly which line differed.
 *
 * Weights (max points):
 *   titleMatch      45   largest component — are these the same song?
 *   artistMatch     35   exact > partial > absent-but-not-penalised
 *   albumMatch      10   weak signal, kept minimal
 *   popularity       5   tiebreaker only; scaled from Spotify's 0–100
 *   modifierPenalty −15  live/remix candidate the user didn't ask for
 *   ─────────────────
 *   max "clean"     95   (100 if popularity == 100, rare)
 */

// ─────────────────────────────────────────────────────────────────────────────
// String helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Levenshtein distance between two strings (classic DP, O(mn) time).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  // Allocate a flat (m+1)×(n+1) array, initialised to 0.
  const d = new Array((m + 1) * (n + 1)).fill(0);
  const idx = (i, j) => i * (n + 1) + j;

  for (let i = 0; i <= m; i++) d[idx(i, 0)] = i;
  for (let j = 0; j <= n; j++) d[idx(0, j)] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[idx(i, j)] = Math.min(
        d[idx(i - 1, j)] + 1,       // deletion
        d[idx(i, j - 1)] + 1,       // insertion
        d[idx(i - 1, j - 1)] + cost // substitution
      );
    }
  }
  return d[idx(m, n)];
}

/**
 * Normalised similarity ratio derived from Levenshtein distance.
 * Returns a value in [0, 1] where 1 = identical.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function similarity(a, b) {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Lowercase + strip punctuation that varies across sources:
 *   brackets, parens, leading/trailing whitespace, common separators.
 * We keep internal spaces so "painted skies" stays two tokens.
 * @param {string} str
 * @returns {string}
 */
function normalise(str) {
  return str
    .toLowerCase()
    .replace(/[''`]/g, "'")          // smart quotes → apostrophe
    .replace(/[^\w\s']/g, ' ')       // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring components
// ─────────────────────────────────────────────────────────────────────────────

const MAX_TITLE    = 45;
const MAX_ARTIST   = 35;
const MAX_ALBUM    = 10;
const MAX_POP      =  5;
const MODIFIER_PEN = -15;

/**
 * Title similarity score (0 – 45).
 *
 * Strategy:
 *  1. Normalise both strings (lowercase, strip punctuation).
 *  2. Compute Levenshtein-based ratio.
 *  3. Additionally check token overlap for cases where word order differs
 *     (e.g. "You & Me" vs "You and Me").  Take the higher of the two.
 *
 * @param {string} parsedTitle
 * @param {string} candidateTitle
 * @returns {number}
 */
function scoreTitleMatch(parsedTitle, candidateTitle) {
  const a = normalise(parsedTitle);
  const b = normalise(candidateTitle);

  const levRatio = similarity(a, b);

  // Token-overlap Jaccard as secondary measure.
  const tokA = new Set(a.split(' ').filter(Boolean));
  const tokB = new Set(b.split(' ').filter(Boolean));
  const intersection = [...tokA].filter((t) => tokB.has(t)).length;
  const union = new Set([...tokA, ...tokB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  const ratio = Math.max(levRatio, jaccard);
  return parseFloat((ratio * MAX_TITLE).toFixed(4));
}

/**
 * Artist match score (0 – 35).
 *
 * Rules:
 *  - If parsedSong.artist is null/empty → 0 (neutral, not a penalty).
 *  - Exact match (after normalisation)  → 35.
 *  - One name contains the other        → 20  (e.g. "Elaine" in "Elaine ft. X").
 *  - Significant token overlap (≥ 0.5 Jaccard) → 15.
 *  - Levenshtein ratio ≥ 0.8            → 10  (typo/transliteration tolerance).
 *  - Otherwise                          → 0.
 *
 * @param {string|null} parsedArtist
 * @param {string|null} candidateArtist
 * @param {string|null} [candidateArtists] - Comma-separated list of all artist names
 * @returns {number}
 */
function scoreArtistMatch(parsedArtist, candidateArtist, candidateArtists = null) {
  if (!parsedArtist) return 0;               // no artist provided — neutral
  if (!candidateArtist) return 0;            // Spotify returned nothing

  // Split and normalise individual parsed artists
  const parsedArtists = parsedArtist
    ? parsedArtist.split(',').map((a) => normalise(a.trim())).filter(Boolean)
    : [];
  if (parsedArtists.length === 0) return 0;

  // Split and normalise all individual candidate artists
  const candidateArtistsList = candidateArtists
    ? candidateArtists.split(',').map((a) => normalise(a.trim())).filter(Boolean)
    : [normalise(candidateArtist)].filter(Boolean);

  // 1. Check exact matches for all parsed artists
  const exactMatchingCount = parsedArtists.filter((parsed) =>
    candidateArtistsList.some((cand) => cand === parsed)
  ).length;

  if (exactMatchingCount === parsedArtists.length) {
    return MAX_ARTIST; // All parsed artists found exactly
  }

  // 2. Check substring/fuzzy matches for all parsed artists
  const fuzzyMatchingCount = parsedArtists.filter((parsed) =>
    candidateArtistsList.some((cand) => cand === parsed || cand.includes(parsed) || parsed.includes(cand))
  ).length;

  if (fuzzyMatchingCount === parsedArtists.length) {
    return 20; // All parsed artists match at least partially
  }

  // 3. Proportional score for partial list matches
  if (fuzzyMatchingCount > 0) {
    const ratio = fuzzyMatchingCount / parsedArtists.length;
    return parseFloat((ratio * 15).toFixed(4));
  }

  // 4. Token overlap fallback with combined names
  const parsedNorm = normalise(parsedArtist);
  const combinedNorm = candidateArtists ? normalise(candidateArtists) : normalise(candidateArtist);

  const tokA = new Set(parsedNorm.split(' ').filter(Boolean));
  const tokB = new Set(combinedNorm.split(' ').filter(Boolean));
  const intersection = [...tokA].filter((t) => tokB.has(t)).length;
  const union = new Set([...tokA, ...tokB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;
  if (jaccard >= 0.5) return 15;

  // 5. Levenshtein fallback (primary or individual artists)
  const primaryNorm = normalise(candidateArtist);
  if (similarity(parsedNorm, primaryNorm) >= 0.8) return 10;
  for (const art of candidateArtistsList) {
    if (similarity(parsedNorm, art) >= 0.8) return 10;
  }

  return 0;
}

/**
 * Album signal (0 – 10).
 *
 * We only have the album from the Spotify side (parsedSong rarely mentions
 * albums).  Treat this as a soft self-consistency check: if the candidate's
 * album name overlaps heavily with its own title (common for singles), give
 * a small bonus — the artist released a dedicated single.
 * If the album name has significant token overlap with the parsed title, also
 * give partial credit (the song is a title track or well-known single).
 *
 * This is intentionally weak — it should never swing a decision on its own.
 *
 * @param {string}      parsedTitle
 * @param {string|null} candidateAlbum
 * @returns {number}
 */
function scoreAlbumMatch(parsedTitle, candidateAlbum) {
  if (!candidateAlbum) return 0;

  const title = normalise(parsedTitle);
  const album = normalise(candidateAlbum);

  const tokTitle = new Set(title.split(' ').filter(Boolean));
  const tokAlbum = new Set(album.split(' ').filter(Boolean));
  const intersection = [...tokTitle].filter((t) => tokAlbum.has(t)).length;
  const union = new Set([...tokTitle, ...tokAlbum]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  // Scale: perfect overlap → 10, ≥ 50% overlap → 5, ≥ 25% → 2, else 0.
  if (jaccard >= 1.0) return MAX_ALBUM;
  if (jaccard >= 0.5) return 5;
  if (jaccard >= 0.25) return 2;
  return 0;
}

/**
 * Popularity tiebreaker (0 – 5).
 *
 * Scales Spotify's 0–100 popularity field into [0, 5].
 * Intentionally tiny — it should only settle near-ties, never dominate.
 *
 * @param {number} popularity  0–100
 * @returns {number}
 */
function scorePopularity(popularity) {
  return parseFloat(((popularity / 100) * MAX_POP).toFixed(4));
}

/**
 * Unrequested-modifier penalty (0 or −15).
 *
 * If the candidate is flagged as live or a remix, AND the original raw
 * input text doesn't mention those qualifiers, deduct 15 points.
 *
 * The rawText check is intentionally loose (simple includes) because users
 * write "live version", "sped up", "remix" etc. in many ways.
 *
 * @param {boolean}     isLive
 * @param {boolean}     isRemix
 * @param {string|null} rawText  original input line (may be undefined)
 * @returns {number}
 */
function scoreModifierPenalty(isLive, isRemix, rawText) {
  if (!isLive && !isRemix) return 0;

  const text = (rawText ?? '').toLowerCase();
  const LIVE_HINTS  = ['live', 'concert', 'session', 'acoustic'];
  const REMIX_HINTS = ['remix', 'remixed', 'sped up', 'slowed', 'nightcore',
                       'flip', 'edit', 'bootleg', 'version'];

  const userWantsLive  = isLive  && LIVE_HINTS.some((h)  => text.includes(h));
  const userWantsRemix = isRemix && REMIX_HINTS.some((h) => text.includes(h));

  // If the candidate is live/remix BUT the user asked for exactly that, no penalty.
  if (isLive  && !userWantsLive)  return MODIFIER_PEN;
  if (isRemix && !userWantsRemix) return MODIFIER_PEN;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ScoreBreakdown
 * @property {number} titleMatch       0 – 45
 * @property {number} artistMatch      0 – 35
 * @property {number} albumMatch       0 – 10
 * @property {number} popularity       0 – 5
 * @property {number} modifierPenalty  0 or −15
 * @property {number} final            sum of all components
 */

/**
 * Score a single candidate against the parsed song.
 *
 * @param {{ title: string, artist: string|null, rawText?: string }} parsedSong
 * @param {import('./resolver.js').Candidate} candidate
 * @returns {ScoreBreakdown}
 *
 * ─── Worked example 1: clean match ──────────────────────────────────────────
 *
 * parsedSong : { title: "Painted Skies", artist: "Elaine" }
 * candidate  : { title: "Painted Skies", artist: "Elaine", album: "Painted Skies",
 *                popularity: 61, isLive: false, isRemix: false }
 *
 * titleMatch      = similarity("painted skies", "painted skies") * 45 = 1.0 * 45 = 45
 * artistMatch     = exact("elaine", "elaine")                         = 35
 * albumMatch      = jaccard({"painted","skies"}, {"painted","skies"}) = 1.0 → 10
 * popularity      = (61 / 100) * 5                                    = 3.05
 * modifierPenalty = not live, not remix                               = 0
 * ─────────────────────────────────────────────────────────────────────────────
 * final           = 45 + 35 + 10 + 3.05 + 0                          = 93.05
 *
 * ─── Worked example 2: live version the user didn't request ─────────────────
 *
 * parsedSong : { title: "Painted Skies", artist: "Elaine", rawText: "Painted Skies - Elaine" }
 * candidate  : { title: "Painted Skies (Live)", artist: "Elaine", album: "Live at …",
 *                popularity: 40, isLive: true, isRemix: false }
 *
 * titleMatch      = similarity("painted skies", "painted skies live") * 45
 *                 ≈ similarity ratio ≈ 0.79 → ~35.4
 *                 (Jaccard: {"painted","skies"} ∩ {"painted","skies","live"} = 2/3 ≈ 0.67 → ~30.0)
 *                 → takes higher: ~35.4
 * artistMatch     = exact("elaine", "elaine")                         = 35
 * albumMatch      = jaccard({"painted","skies"}, {"live","at","…"})   ≈ 0 → 0
 * popularity      = (40 / 100) * 5                                    = 2
 * modifierPenalty = isLive=true, rawText has no live hint             = −15
 * ─────────────────────────────────────────────────────────────────────────────
 * final           ≈ 35.4 + 35 + 0 + 2 − 15                          ≈ 57.4
 *
 * → Candidate A (93.05) outscores B (57.4): 35.65 points, explained by:
 *     titleMatch gap    : ~9.6 pts  (live suffix degrades title similarity)
 *     albumMatch gap    : 10 pts    (album name doesn't match title)
 *     popularity gap    : 1.05 pts
 *     modifierPenalty   : 15 pts    ← single largest contributor to the gap
 */
export function scoreCandidate(parsedSong, candidate) {
  const titleMatch      = scoreTitleMatch(parsedSong.title, candidate.title);
  const artistMatch     = scoreArtistMatch(
    parsedSong.artist,
    candidate.artist,
    candidate.artists
  );
  const albumMatch      = scoreAlbumMatch(parsedSong.title, candidate.album);
  const popularity      = scorePopularity(candidate.popularity);
  const modifierPenalty = scoreModifierPenalty(
    candidate.isLive,
    candidate.isRemix,
    parsedSong.rawText ?? null,
  );

  const final = parseFloat(
    (titleMatch + artistMatch + albumMatch + popularity + modifierPenalty).toFixed(2)
  );

  return { titleMatch, artistMatch, albumMatch, popularity, modifierPenalty, final };
}

/**
 * Score every candidate and return them sorted best-first.
 * Attaches the breakdown to each candidate as `score`.
 *
 * @param {{ title: string, artist: string|null, rawText?: string }} parsedSong
 * @param {import('./resolver.js').Candidate[]} candidates
 * @returns {Array<import('./resolver.js').Candidate & { score: ScoreBreakdown }>}
 */
export function rankCandidates(parsedSong, candidates) {
  return candidates
    .map((c) => ({ ...c, score: scoreCandidate(parsedSong, c) }))
    .sort((a, b) => b.score.final - a.score.final);
}