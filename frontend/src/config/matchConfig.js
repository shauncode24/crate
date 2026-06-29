/**
 * matchConfig.js — UI display constants only.
 *
 * Scoring logic and these thresholds live in backend/src/resolution/matcher.py.
 * These copies exist solely so the frontend can colour-code badges and legend
 * text without an extra API call. Keep in sync with the backend values.
 *
 * Scale: 0–1
 */
export const AUTO_ACCEPT_THRESHOLD = 0.80;
export const REVIEW_FLOOR          = 0.50;