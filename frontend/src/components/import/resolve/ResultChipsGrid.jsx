import React from 'react';

/**
 * ResultChipsGrid
 * Displays real-time matching results during or after searching.
 */
export default function ResultChipsGrid({ resolveResults = [], resolveState }) {
  const isSearchActive = resolveState === 'running' || resolveState === 'done';

  if (!isSearchActive || resolveResults.length === 0) return null;

  return (
    <div className="resolve-card resolve-results-card">
      <h3 className="resolve-results-card__title">Spotify Match Results</h3>
      
      <div className="resolve-results-grid">
        {resolveResults.map((result, i) => {
          if (!result) {
            // Placeholder/loading chip for index that hasn't finished processing yet
            return (
              <div key={i} className="resolve-chip resolve-chip--pending">
                <span className="resolve-chip__status-icon">
                  <span className="resolve-spinner resolve-spinner--small spin" />
                </span>
                <span className="resolve-chip__text">Processing #{i + 1}...</span>
              </div>
            );
          }

          const status = result.status; // 'auto' | 'review' | 'notfound'
          const titleText = result.parsedSong?.title || `Track #${i + 1}`;
          const artistText = result.parsedSong?.artist ? ` — ${result.parsedSong.artist}` : '';
          const tooltip = `${titleText}${artistText} (${status})`;

          // Determine icon and class name
          let icon = null;
          let statusClass = '';

          if (status === 'auto') {
            statusClass = 'resolve-chip--auto';
            icon = (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            );
          } else if (status === 'review') {
            statusClass = 'resolve-chip--review';
            icon = (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            );
          } else {
            statusClass = 'resolve-chip--notfound';
            icon = (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            );
          }

          return (
            <div key={i} className={`resolve-chip ${statusClass}`} title={tooltip}>
              <span className="resolve-chip__status-icon">{icon}</span>
              <span className="resolve-chip__text">
                {titleText}
                {artistText && <span className="resolve-chip__artist-text">{artistText}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
