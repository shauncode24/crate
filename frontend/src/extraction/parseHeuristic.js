// Turns raw pasted text into a clean list of ParsedSong objects without AI.
// Handles the common structured cases so Phase 3 (AI) only has to deal with
// genuinely ambiguous lines.
//
// Output shape:
//   {
//     rawText:       string  — the original line, untouched
//     title:         string  — best-guess song title
//     artist:        string | null — best-guess artist, or null if not found
//     parseMethod:   'heuristic'
//     delimiterFound: boolean — false means Phase 3 should attempt AI lookup
//   }

// ---------------------------------------------------------------------------
// Regex constants
// ---------------------------------------------------------------------------

// Leading numbering: "1. ", "1) ", "01. " etc.
const RE_LEADING_NUMBER = /^\d+[\.\)]\s*/;

// Leading bullets: "- ", "• ", "* "
const RE_LEADING_BULLET = /^[-•*]\s+/;

// Emoji (Unicode ranges covering most emoji blocks)
const RE_EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{231A}\u{231B}\u{25AA}-\u{25FE}\u{2614}\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}\u{26AB}\u{26BD}\u{26BE}\u{26C4}\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}]/gu;

// Bracketed/parenthetical noise: "(Official Video)", "[Lyrics]", "(ft. X)", etc.
const RE_NOISE_PARENS = /\s*\([^)]*\)\s*/g;
const RE_NOISE_BRACKETS = /\s*\[[^\]]*\]\s*/g;

// Smart quotes → straight
const SMART_QUOTE_MAP = {
  '\u2018': "'", '\u2019': "'",
  '\u201C': '"', '\u201D': '"',
  '\u2032': "'", '\u2033': '"',
};

// Delimiters to try, in priority order.
// Each entry: { re, label } where re captures (title)(delimiter)(artist).
// We use a split-based approach rather than capture groups for flexibility.
const DELIMITERS = [
  { label: '-',  re: /\s+[-\u2013]\s+/, titleMustBeShaped: false },  // " - " or " – "
  { label: '—',  re: /\s*\u2014\s*/,    titleMustBeShaped: false },  // em dash
  { label: 'by', re: /\s+by\s+/i,       titleMustBeShaped: true  },  // " by " — only accept if left side looks like a title, not a sentence
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Replace smart/curly quotes with their ASCII equivalents. */
function normalizeQuotes(str) {
  return str.replace(/[\u2018\u2019\u201C\u201D\u2032\u2033]/g, (ch) => SMART_QUOTE_MAP[ch] ?? ch);
}

/**
 * Strip leading numbering and bullets, then emoji, then bracketed noise,
 * then normalize whitespace and quotes.
 */
function cleanLine(line) {
  let s = line;

  s = s.replace(RE_LEADING_NUMBER, '');
  s = s.replace(RE_LEADING_BULLET, '');
  s = s.replace(RE_EMOJI, '');
  s = s.replace(RE_NOISE_PARENS, ' ');
  s = s.replace(RE_NOISE_BRACKETS, ' ');
  s = normalizeQuotes(s);

  // Collapse multiple spaces, trim
  s = s.replace(/\s{2,}/g, ' ').trim();

  return s;
}

/**
 * Return true if a candidate split side looks reasonable:
 * - non-empty
 * - not absurdly long (> 120 chars suggests we ate too much)
 * - not just punctuation / digits
 */
function isSaneSide(s) {
  if (!s || s.length === 0) return false;
  if (s.length > 120) return false;
  if (/^[\d\s\W]+$/.test(s)) return false;
  return true;
}

// Prose signals that disqualify a string from being a song title.
// Used to reject false-positive " by " splits like:
//   "honestly can't stop listening to Stick Season by Noah Kahan"
//   ↑ left side is a sentence, not a title — reject the split entirely.
const PROSE_TITLE_SIGNALS = [
  /\bright\s+now\b/i,
  /\blately\b/i,
  /\bhonestly\b/i,
  /\bbeen\b/i,
  /\breally\b/i,
  /\bso\s+into\b/i,
  /\bon\s+repeat\b/i,
  /\bobsessed\b/i,
  /\bcan'?t\s+stop\b/i,
  /\bkeep\s+(listening|playing|coming\s+back)\b/i,
  /\blove\s+(this|how)\b/i,
  /\blistening\s+to\b/i,
  /\bkick\b/i,
];

/**
 * Returns false if the string looks like a sentence rather than a song title.
 * Only consulted for delimiters marked titleMustBeShaped: true (i.e. " by ").
 */
function isTitleShaped(s) {
  const words = s.trim().split(/\s+/);
  if (words.length > 6) return false;
  if (PROSE_TITLE_SIGNALS.some((re) => re.test(s))) return false;
  return true;
}

/**
 * Attempt to split `cleaned` into [title, artist] using DELIMITERS in order.
 * Returns { title, artist, delimiterFound } or { title: cleaned, artist: null, delimiterFound: false }.
 */
function splitTitleArtist(cleaned) {
  for (const { re, titleMustBeShaped } of DELIMITERS) {
    // Split on first occurrence only
    const idx = cleaned.search(re);
    if (idx === -1) continue;

    const match = cleaned.match(re);
    const delimiter = match[0];
    const delimStart = idx;
    const delimEnd = idx + delimiter.length;

    const left = cleaned.slice(0, delimStart).trim();
    const right = cleaned.slice(delimEnd).trim();

    if (!isSaneSide(left) || !isSaneSide(right)) continue;

    // For " by " splits, reject if the left side reads as a sentence.
    if (titleMustBeShaped && !isTitleShaped(left)) continue;

    return { title: left, artist: right, delimiterFound: true };
  }

  // No usable delimiter found — return the whole cleaned string as title
  return { title: cleaned, artist: null, delimiterFound: false };
}

export function parseHeuristic(rawText) {
  const lines = rawText.split('\n');
  const results = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cleaned = cleanLine(trimmed);

    // Skip lines that collapsed to nothing (e.g. a line that was only emoji)
    if (!cleaned) continue;

    const { title, artist, delimiterFound } = splitTitleArtist(cleaned);

    results.push({
      rawText: trimmed,
      title,
      artist,
      parseMethod: 'heuristic',
      delimiterFound,
    });
  }

  return results;
}