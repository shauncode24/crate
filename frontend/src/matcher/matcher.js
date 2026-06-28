/**
 * matcher.js — Phase 6: Bucketing Engine
 *
 * bucketMatch(parsedSong, scoredCandidates) → ResolvedMatch
 *
 * Takes the ranked+scored candidate list from Phase 5 and assigns one of
 * three outcomes.  Pure function — no side-effects, no I/O.
 *
 * @typedef {import('../resolver/resolver.js').Candidate & { score: import('../scorer/scorer.js').ScoreBreakdown }} ScoredCandidate
 *
 * @typedef {Object} ResolvedMatch
 * @property {'auto'|'review'|'notfound'} status
 * @property {ScoredCandidate|null} chosen
 *   The accepted candidate for status='auto'; null otherwise.
 * @property {ScoredCandidate[]} topCandidates
 *   For status='review': top N candidates (see REVIEW_CANDIDATE_COUNT).
 *   For status='auto':   empty array (chosen is sufficient).
 *   For status='notfound': empty array.
 * @property {ScoredCandidate[]} allCandidates
 *   All scored candidates, sorted best-first.
 * @property {{ title: string, artist: string|null }} parsedSong
 *   Echo of the input — keeps the match self-contained for downstream phases.
 */

import {
  AUTO_ACCEPT_THRESHOLD,
  REVIEW_FLOOR,
  REVIEW_CANDIDATE_COUNT,
} from './matchConfig.js';

/**
 * Bucket a parsed song against its scored candidates.
 *
 * Expects `scoredCandidates` to already be sorted best-first (as returned by
 * `rankCandidates` from scorer.js).  Re-sorts defensively in case the caller
 * didn't, so the function stays correct regardless of input order.
 *
 * Worked examples
 * ───────────────
 * Example A — auto-accept
 *   parsedSong      : { title: "Painted Skies", artist: "Elaine" }
 *   top score       : 88.05   (clean exact match, Phase 5 Candidate A)
 *   AUTO_ACCEPT_THRESHOLD: 80
 *   → 88.05 ≥ 80 → status: 'auto', chosen: Candidate A, topCandidates: []
 *
 * Example B — needs review
 *   parsedSong      : { title: "Redbone", artist: null }
 *   top score       : 65      (title-only match, artist unknown)
 *   → 65 < 80, 65 ≥ 50 → status: 'review', chosen: null, topCandidates: [top 3]
 *
 * Example C — not found
 *   parsedSong      : { title: "xyzzy plugh", artist: "nobody" }
 *   top score       : 22
 *   → 22 < 50 → status: 'notfound', chosen: null, topCandidates: []
 *
 * Example D — no candidates at all
 *   scoredCandidates: []
 *   → status: 'notfound', chosen: null, topCandidates: []
 *
 * @param {{ title: string, artist: string|null, rawText?: string }} parsedSong
 * @param {ScoredCandidate[]} scoredCandidates
 * @returns {ResolvedMatch}
 */
export function bucketMatch(parsedSong, scoredCandidates) {
  // Defensive sort — best score first.
  const sorted = [...scoredCandidates].sort(
    (a, b) => b.score.final - a.score.final
  );

  const best = sorted[0] ?? null;
  const topScore = best?.score?.final ?? -Infinity;

  // ── Bucket decision ──────────────────────────────────────────────────────

  if (best && topScore >= AUTO_ACCEPT_THRESHOLD) {
    return {
      status:        'auto',
      chosen:        best,
      topCandidates: [],
      allCandidates: sorted,
      parsedSong,
    };
  }

  if (best && topScore >= REVIEW_FLOOR) {
    return {
      status:        'review',
      chosen:        null,
      topCandidates: sorted.slice(0, REVIEW_CANDIDATE_COUNT),
      allCandidates: sorted,
      parsedSong,
    };
  }

  return {
    status:        'notfound',
    chosen:        null,
    topCandidates: [],
    allCandidates: sorted,
    parsedSong,
  };
}