/**
 * matchConfig.js — Phase 6: Tunable Bucketing Thresholds
 *
 * These two numbers are the single most consequential tuning decision in the
 * whole pipeline.  They live here — not buried in an if-statement — so that
 * the tradeoff is visible and the values are easy to change in one place.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  score ≥ AUTO_ACCEPT_THRESHOLD  →  auto           (commit without review)│
 * │  score ≥ REVIEW_FLOOR           →  review         (show top 3 to user)  │
 * │  score <  REVIEW_FLOOR          →  not-found      (skip this song)       │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Tradeoff:
 *   Raising AUTO_ACCEPT_THRESHOLD → fewer silently-wrong adds, more review work.
 *   Lowering AUTO_ACCEPT_THRESHOLD → faster imports, higher risk of wrong song.
 *   Raising REVIEW_FLOOR → fewer review prompts, more songs fall to not-found.
 *   Lowering REVIEW_FLOOR → more review prompts, catches more ambiguous cases.
 *
 * Starting values rationale (against the Phase 5 scoring scale, max ~95):
 *   80 auto-accept: a clean title+artist exact match with no modifier penalty
 *      scores ~88–93, so 80 is a comfortable buffer below "perfect" while
 *      still requiring both title and artist to align well.
 *   50 review floor: roughly a title-only match with moderate similarity.
 *      Below 50 the top candidate is likely a coincidental keyword overlap
 *      and surfacing it for review would create more noise than signal.
 */
export const AUTO_ACCEPT_THRESHOLD = 80;
export const REVIEW_FLOOR          = 50;

/** How many candidates to surface in the review UI. */
export const REVIEW_CANDIDATE_COUNT = 3;