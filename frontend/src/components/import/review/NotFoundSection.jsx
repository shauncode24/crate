import React, { useState } from 'react';

/**
 * NotFoundSection
 * Renders missing tracks that couldn't be auto-resolved on Spotify.
 */
export default function NotFoundSection({ items = [] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className={`collapsible-section collapsible-section--missing ${isOpen ? 'collapsible-section--open' : ''}`}>
      {/* Header */}
      <div className="collapsible-section__header" onClick={() => setIsOpen(!isOpen)}>
        <div className="collapsible-section__title-group">
          <div className="collapsible-section__icon-wrapper">
            <svg className="collapsible-section__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <span className="collapsible-section__title">Not found</span>
          <span className="collapsible-section__badge">{items.length}</span>
        </div>
        <svg className="collapsible-section__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Body List */}
      {isOpen && (
        <div className="collapsible-section__body">
          <div className="missing-tracks-list">
            {items.map(({ match, originalIndex }, idx) => (
              <div key={originalIndex} className="missing-track-item">
                <span className="missing-track-item__index">{idx + 1}.</span>
                <div className="missing-track-item__info">
                  <span className="missing-track-item__title">{match.parsedSong.title}</span>
                  {match.parsedSong.artist && (
                    <span className="missing-track-item__artist"> by {match.parsedSong.artist}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
