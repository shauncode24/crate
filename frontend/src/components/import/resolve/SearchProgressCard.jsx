import React from 'react';

/**
 * SearchProgressCard
 * Displays Spotify search progress, title, description, and status alerts.
 */
export default function SearchProgressCard({
  resolveState,
  batchProgress,
  retryNotice,
  resolveError,
  onResolveAll,
  isLoggedIn,
}) {
  const { completed = 0, total = 0 } = batchProgress || {};
  const batchPct = total ? Math.round((completed / total) * 100) : 0;

  // Determine Title and Subtitle text based on state
  let title = 'Ready to Search';
  let subtitle = 'Match your track list against real Spotify database records.';

  if (resolveState === 'running') {
    title = 'Searching Spotify';
    subtitle = "We're matching your text to real Spotify tracks.";
  } else if (resolveState === 'done') {
    title = 'Search Complete';
    subtitle = 'Successfully processed your songs. Ready to review and import.';
  } else if (resolveState === 'error') {
    title = 'Search Interrupted';
    subtitle = 'An error occurred during Spotify resolution.';
  }

  return (
    <div className="resolve-card resolve-search-card">
      <div className="resolve-search-card__header">
        <h2 className="resolve-search-card__title">{title}</h2>
        <p className="resolve-search-card__subtitle">{subtitle}</p>
      </div>

      {/* Progress Section */}
      {(resolveState === 'running' || resolveState === 'done') && (
        <div className="resolve-progress">
          <div className="resolve-progress__labels">
            <span className="resolve-progress__status">
              {resolveState === 'running' ? 'Searching...' : 'Search complete'}
            </span>
            <span className="resolve-progress__count">
              {completed} / {total}
            </span>
          </div>
          <div className="resolve-progress__track">
            <div
              className="resolve-progress__fill"
              style={{ width: `${batchPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Idle / Login actions */}
      {resolveState === 'idle' && (
        <div className="resolve-actions">
          {!isLoggedIn ? (
            <div className="resolve-login-hint">
              <span className="resolve-login-hint__icon">🔒</span>
              <p>Log in with Spotify to enable search functionality.</p>
            </div>
          ) : (
            <button
              type="button"
              className="resolve-btn resolve-btn--primary"
              onClick={onResolveAll}
            >
              Search Spotify
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Dynamic retry notice */}
      {retryNotice && (
        <div className="resolve-alert resolve-alert--warning">
          <svg
            className="resolve-alert__icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>
            Rate-limited on <strong>"{retryNotice.title}"</strong> — retrying in{' '}
            {retryNotice.waitSeconds}s
          </p>
        </div>
      )}

      {/* Error display */}
      {resolveState === 'error' && (
        <div className="resolve-alert resolve-alert--danger">
          <svg
            className="resolve-alert__icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <octagon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="12" y1="16" x2="12" y2="16" />
          </svg>
          <p>{resolveError}</p>
        </div>
      )}
    </div>
  );
}
