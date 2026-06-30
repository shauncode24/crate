import React from 'react';

/**
 * MatchStatusGrid
 * Renders status metric cards: Ready, Need Review, and Not Found counts.
 */
export default function MatchStatusGrid({
  autoCount = 0,
  reviewCount = 0,
  missingCount = 0,
  resolveState,
}) {
  // We only show numbers/metrics when we have started searching or are done
  const isSearchActive = resolveState === 'running' || resolveState === 'done';

  return (
    <div className="resolve-status-grid">
      {/* Ready (Auto Resolved) Card */}
      <div className={`resolve-status-card resolve-status-card--ready ${isSearchActive ? 'resolve-status-card--active' : ''}`}>
        <div className="resolve-status-card__icon-wrapper">
          <svg
            className="resolve-status-card__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="resolve-status-card__content">
          <span className="resolve-status-card__number">{isSearchActive ? autoCount : '-'}</span>
          <span className="resolve-status-card__label">Ready</span>
        </div>
      </div>

      {/* Need Review Card */}
      <div className={`resolve-status-card resolve-status-card--review ${isSearchActive ? 'resolve-status-card--active' : ''}`}>
        <div className="resolve-status-card__icon-wrapper">
          <svg
            className="resolve-status-card__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div className="resolve-status-card__content">
          <span className="resolve-status-card__number">{isSearchActive ? reviewCount : '-'}</span>
          <span className="resolve-status-card__label">Need Review</span>
        </div>
      </div>

      {/* Not Found Card */}
      <div className={`resolve-status-card resolve-status-card--notfound ${isSearchActive ? 'resolve-status-card--active' : ''}`}>
        <div className="resolve-status-card__icon-wrapper">
          <svg
            className="resolve-status-card__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <div className="resolve-status-card__content">
          <span className="resolve-status-card__number">{isSearchActive ? missingCount : '-'}</span>
          <span className="resolve-status-card__label">Not Found</span>
        </div>
      </div>
    </div>
  );
}
