import React from 'react';

/**
 * ImportSettingsCard
 * Handles playlist configuration (selecting playlists, entering custom IDs)
 * and triggering duplicate checks/confirmations.
 */
export default function ImportSettingsCard({
  playlists = [],
  loadingPlaylists = false,
  selectedPlaylistId = '',
  customPlaylistId = '',
  deduplicateEnabled = true,
  checkingDuplicates = false,
  onPlaylistChange,
  onCustomPlaylistChange,
  onDeduplicateChange,
  onEnterPreview,
}) {
  const isCustom = selectedPlaylistId === 'custom';
  const isSubmitDisabled = checkingDuplicates || (isCustom && !customPlaylistId.trim());

  return (
    <div className="resolve-card resolve-settings-card">
      <h3 className="resolve-settings-card__title">Import Settings</h3>

      <div className="resolve-settings-card__body">
        {/* Target Playlist Selector */}
        <div className="resolve-field">
          <label className="resolve-field__label" htmlFor="target-playlist-select">
            Target Playlist
          </label>
          
          {loadingPlaylists ? (
            <div className="resolve-field__loading">
              <span className="resolve-spinner spin" />
              <span>Loading playlists from Spotify...</span>
            </div>
          ) : (
            <div className="resolve-field__inputs">
              <div className="resolve-select-wrapper">
                <select
                  id="target-playlist-select"
                  className="resolve-select"
                  value={selectedPlaylistId}
                  onChange={(e) => onPlaylistChange(e.target.value)}
                >
                  <option value="">Create a new playlist</option>
                  <option value="custom">Enter Playlist ID manually</option>
                  {playlists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} ({pl.tracks?.total ?? 0} tracks)
                    </option>
                  ))}
                </select>
                <span className="resolve-select-arrow">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </div>

              {isCustom && (
                <div className="resolve-input-wrapper">
                  <input
                    type="text"
                    className="resolve-input"
                    placeholder="Paste Spotify Playlist ID"
                    value={customPlaylistId}
                    onChange={(e) => onCustomPlaylistChange(e.target.value.trim())}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Deduplicate Checkbox */}
        <div className="resolve-checkbox-field">
          <label className="resolve-checkbox-label">
            <input
              type="checkbox"
              className="resolve-checkbox"
              checked={deduplicateEnabled}
              onChange={(e) => onDeduplicateChange(e.target.checked)}
            />
            <span className="resolve-checkbox-custom" />
            <span className="resolve-checkbox-text">Check for duplicates before importing</span>
          </label>
        </div>

        {/* Action Button */}
        <div className="resolve-settings-card__actions">
          <button
            type="button"
            className="resolve-btn resolve-btn--submit"
            onClick={onEnterPreview}
            disabled={isSubmitDisabled}
          >
            {checkingDuplicates ? (
              <>
                <span className="resolve-spinner spin resolve-spinner--light" />
                Checking duplicates...
              </>
            ) : (
              'Review & confirm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
