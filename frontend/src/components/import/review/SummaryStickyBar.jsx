import React from 'react';

/**
 * SummaryStickyBar
 * Sticky summary widget containing Ready, Review, and Missing counts,
 * and the primary trigger to commit the import to Spotify.
 */
export default function SummaryStickyBar({
  readyCount = 0,
  reviewPendingCount = 0,
  missingCount = 0,
  onConfirm,
  hasPlaylist = true,
}) {
  const canConfirm = reviewPendingCount === 0;
  
  // Display target playlist context text
  const playlistContext = hasPlaylist ? 'Selected playlist' : 'New playlist';

  return (
    <div className="drp-sticky-summary">
      <div className="drp-sticky-summary__inner">
        {/* Status Counters */}
        <div className="drp-sticky-summary__counts">
          {/* Ready Counter */}
          <div className="drp-sticky-count drp-sticky-count--ready">
            <svg className="drp-sticky-count__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="drp-sticky-count__text">
              <strong>{readyCount}</strong> ready
            </span>
          </div>

          {/* Need Review Counter */}
          <div className="drp-sticky-count drp-sticky-count--review">
            <svg className="drp-sticky-count__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="drp-sticky-count__text">
              <strong>{reviewPendingCount}</strong> need review
            </span>
          </div>

          {/* Not Found Counter */}
          <div className="drp-sticky-count drp-sticky-count--missing">
            <svg className="drp-sticky-count__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span className="drp-sticky-count__text">
              <strong>{missingCount}</strong> not found
            </span>
          </div>
        </div>

        {/* Action Button & Context */}
        <div className="drp-sticky-summary__actions">
          <span className="drp-sticky-summary__context">{playlistContext}</span>
          <button
            type="button"
            className={`drp-sticky-btn ${canConfirm ? 'drp-sticky-btn--enabled' : 'drp-sticky-btn--disabled'}`}
            disabled={!canConfirm}
            onClick={onConfirm}
            title={
              reviewPendingCount > 0
                ? `Resolve the remaining ${reviewPendingCount} review items to unlock import`
                : 'Import these tracks to Spotify'
            }
          >
            Import {readyCount} track{readyCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
      
      {reviewPendingCount > 0 && (
        <div className="drp-sticky-summary__warning-banner">
          <svg className="drp-sticky-summary__warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>Resolve all review items below to unlock the import action.</span>
        </div>
      )}
    </div>

  );
}
