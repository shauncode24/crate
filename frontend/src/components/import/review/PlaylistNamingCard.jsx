import React from 'react';

/**
 * PlaylistNamingCard
 * Confirms name/description before importing matches to Spotify.
 */
export default function PlaylistNamingCard({
  suggestedName,
  suggestedDesc,
  selectedPlaylistId,
  onNameChange,
  onDescChange,
  onBack,
  onFinalize,
}) {
  const isExistingPlaylist = Boolean(selectedPlaylistId && selectedPlaylistId !== 'custom');

  return (
    <section className="step3-naming">
      <div className="step3-naming__card">
        {/* Header */}
        <h2 className="step3-naming__title">Name your playlist</h2>
        <p className="step3-naming__subtitle">We've suggested a name based on your tracks.</p>

        {/* Form Fields */}
        <div className="step3-naming__fields">
          <div className="step3-naming__field">
            <label className="step3-naming__label" htmlFor="playlist-name-input">
              Playlist Name
            </label>
            <input
              id="playlist-name-input"
              type="text"
              className="step3-naming__input step3-naming__input--name"
              value={suggestedName}
              onChange={e => onNameChange(e.target.value)}
              placeholder="E.g., Late Night Focus"
              maxLength={100}
              autoFocus
            />
          </div>
          
          <div className="step3-naming__field">
            <label className="step3-naming__label" htmlFor="playlist-desc-input">
              Description
            </label>
            <textarea
              id="playlist-desc-input"
              className="step3-naming__input step3-naming__input--desc"
              value={suggestedDesc}
              onChange={e => onDescChange(e.target.value)}
              placeholder="E.g., A curated mix of ambient and electronic tracks."
              maxLength={200}
              rows={3}
            />
          </div>

          {/* Conditional Note */}
          <p className="step3-naming__hint">
            {isExistingPlaylist
              ? "You're adding to an existing playlist — name & description won't be applied."
              : 'This will be the name & description of your new Spotify playlist.'}
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="step3-naming__actions">
          <button 
            type="button" 
            className="step3-naming__back" 
            onClick={onBack}
          >
            Back to review
          </button>
          
          <button
            type="button"
            className="step3-naming__finalize"
            onClick={onFinalize}
          >
            Finalize import
          </button>
        </div>
      </div>
    </section>
  );
}
