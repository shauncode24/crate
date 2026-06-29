/**
 * matchConfig.js — UI display constants only.
 *
 * The actual bucketing logic and these threshold values now live in
 * backend/src/resolution/matcher.py. These copies exist solely so the
 * frontend can colour-code badges and legend text without an extra API call.
 * If you change the thresholds in matcher.py, update these too.
 */
export const AUTO_ACCEPT_THRESHOLD = 80;
export const REVIEW_FLOOR          = 50;