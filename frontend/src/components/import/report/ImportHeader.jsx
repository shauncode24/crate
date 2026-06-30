import React from 'react';

/**
 * ImportHeader
 * Displays status badge, success/warning counts, and "Open in Spotify" button.
 */
export default function ImportHeader({ addedCount = 0, playlistId, hasFailures = false }) {
  const playlistUrl = playlistId ? `https://open.spotify.com/playlist/${playlistId}` : null;

  return (
    <div className="rpt-header">
      {/* Checkmark / Warning badge icon */}
      <div className={`rpt-header__status-badge ${hasFailures ? 'rpt-header__status-badge--warning' : 'rpt-header__status-badge--success'}`}>
        {hasFailures ? (
          <svg className="rpt-header__badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ) : (
          <svg className="rpt-header__badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Main Header Text */}
      <h2 className="rpt-header__title">
        {addedCount} track{addedCount !== 1 ? 's' : ''} added
      </h2>
      <p className="rpt-header__subtitle">
        {hasFailures 
          ? 'Tracks were processed, but some chunks failed to write due to API/network errors.' 
          : 'Successfully added to your playlist.'}
      </p>

      {/* Open in Spotify Button */}
      {playlistUrl && addedCount > 0 && (
        <a 
          href={playlistUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="rpt-header__spotify-btn"
        >
          Open in Spotify
          <svg className="rpt-header__spotify-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      )}
    </div>
  );
}
