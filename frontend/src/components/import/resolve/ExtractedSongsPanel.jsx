import React, { useState } from 'react';

/**
 * ExtractedSongsPanel
 * Collapsible panel showing the raw songs extracted in Step 1.
 */
export default function ExtractedSongsPanel({ songs = [], onBack }) {
  const [isOpen, setIsOpen] = useState(false);

  if (songs.length === 0) return null;

  return (
    <div className={`resolve-card resolve-songs-panel ${isOpen ? 'resolve-songs-panel--open' : ''}`}>
      <div className="resolve-songs-panel__header" onClick={() => setIsOpen(!isOpen)}>
        <div className="resolve-songs-panel__title-group">
          <svg
            className="resolve-songs-panel__chevron"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="resolve-songs-panel__label">Extracted Track List</span>
          <span className="resolve-songs-panel__count">{songs.length} tracks detected</span>
        </div>
        <button
          type="button"
          className="resolve-songs-panel__repaste"
          onClick={(e) => {
            e.stopPropagation(); // Avoid toggling accordion
            onBack();
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Re-paste
        </button>
      </div>

      {isOpen && (
        <div className="resolve-songs-panel__content">
          <div className="resolve-song-chips">
            {songs.map((song, i) => (
              <div key={i} className="resolve-song-chip">
                <span className="resolve-song-chip__num">{i + 1}</span>
                <span className="resolve-song-chip__title">{song.title}</span>
                {song.artist && (
                  <span className="resolve-song-chip__artist">by {song.artist}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
