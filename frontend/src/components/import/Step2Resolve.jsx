import './Step2Resolve.css';

/**
 * Step2Resolve — Spotify batch-search and playlist-selector screen.
 *
 * Props:
 *   songs               [{title, artist, rawText}]
 *   isLoggedIn          bool
 *   resolveState        'idle' | 'running' | 'done' | 'error'
 *   resolveError        string | null
 *   resolveResults      ResolvedMatch[]
 *   batchProgress       { completed, total }
 *   retryNotice         { title, waitSeconds } | null
 *   playlists           Spotify playlist objects[]
 *   loadingPlaylists    bool
 *   selectedPlaylistId  string
 *   customPlaylistId    string
 *   deduplicateEnabled  bool
 *   checkingDuplicates  bool
 *   onResolveAll        () => void
 *   onPlaylistChange    (id) => void
 *   onCustomPlaylistChange (id) => void
 *   onDeduplicateChange (bool) => void
 *   onEnterPreview      () => void
 *   onBack              () => void   (re-paste)
 */
export default function Step2Resolve({
  songs,
  isLoggedIn,
  resolveState,
  resolveError,
  resolveResults,
  batchProgress,
  retryNotice,
  playlists,
  loadingPlaylists,
  selectedPlaylistId,
  customPlaylistId,
  deduplicateEnabled,
  checkingDuplicates,
  onResolveAll,
  onPlaylistChange,
  onCustomPlaylistChange,
  onDeduplicateChange,
  onEnterPreview,
  onBack,
}) {
  const batchPct    = batchProgress.total ? Math.round((batchProgress.completed / batchProgress.total) * 100) : 0;
  const autoCount   = resolveResults.filter(r => r?.status === 'auto').length;
  const reviewCount = resolveResults.filter(r => r?.status === 'review').length;
  const missingCount= resolveResults.filter(r => r?.status === 'notfound').length;

  return (
    <div className="step2">
      {/* Extracted songs chip strip */}
      {songs.length > 0 && (
        <div className="ip-extracted-list">
          <div className="ip-extracted-header">
            <span className="ip-extracted-label">Extracted songs</span>
            <span className="ip-extracted-count">{songs.length} found</span>
            <button className="step2__repaste" onClick={onBack}>← re-paste</button>
          </div>
          <div className="ip-song-chips">
            {songs.map((s, i) => (
              <div key={i} className="ip-song-chip">
                {s.title}{s.artist && <span className="ip-song-chip__artist">— {s.artist}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolve controls */}
      <section className="ip-resolve-section">
        <div className="ip-resolve-header">
          <span className="ip-resolve-label">Spotify search</span>
          {resolveState === 'idle' && (
            <button className="ip-resolve-btn" onClick={onResolveAll} disabled={!isLoggedIn}>
              Search Spotify →
            </button>
          )}
          {resolveState === 'running' && (
            <span className="ip-progress-label">{batchProgress.completed}/{batchProgress.total} resolved…</span>
          )}
        </div>

        {!isLoggedIn && <p className="ip-login-hint">Log in with Spotify to enable search.</p>}

        {resolveState === 'running' && (
          <div className="ip-progress-track">
            <div className="ip-progress-fill" style={{ width: `${batchPct}%` }} />
          </div>
        )}

        {retryNotice && (
          <p className="ip-retry-banner">
            ⏳ Rate-limited on "{retryNotice.title}" — retrying in {retryNotice.waitSeconds}s
          </p>
        )}

        {resolveState === 'error' && <p className="ip-resolve-error">{resolveError}</p>}

        {resolveState === 'done' && (
          <>
            {/* Playlist selector */}
            <div className="step2__playlist-selector">
              <label className="step2__playlist-label">Target Spotify Playlist</label>
              {loadingPlaylists ? (
                <span className="step2__loading-hint">Loading your playlists…</span>
              ) : (
                <div className="step2__playlist-inputs">
                  <select
                    className="step2__select"
                    value={selectedPlaylistId}
                    onChange={e => onPlaylistChange(e.target.value)}
                  >
                    <option value="">— No target playlist (creates new) —</option>
                    <option value="custom">— Enter Playlist ID manually —</option>
                    {playlists.map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.name} ({pl.tracks?.total ?? 0} tracks)</option>
                    ))}
                  </select>

                  {selectedPlaylistId === 'custom' && (
                    <input
                      type="text"
                      className="step2__custom-input"
                      placeholder="Paste Spotify Playlist ID"
                      value={customPlaylistId}
                      onChange={e => onCustomPlaylistChange(e.target.value.trim())}
                    />
                  )}

                  <label className="step2__dedup-label">
                    <input
                      type="checkbox"
                      checked={deduplicateEnabled}
                      onChange={e => onDeduplicateChange(e.target.checked)}
                    />
                    Check for duplicates before importing
                  </label>
                </div>
              )}
            </div>

            {/* Done row */}
            <div className="ip-resolve-done-row">
              <span className="ip-resolve-done-summary">
                <strong>{autoCount}</strong> auto · {reviewCount} need review · {missingCount} not found
              </span>
              <button
                className="ip-preview-btn"
                onClick={onEnterPreview}
                disabled={checkingDuplicates || (selectedPlaylistId === 'custom' && !customPlaylistId)}
              >
                {checkingDuplicates ? 'Checking duplicates…' : 'Review & confirm →'}
              </button>
            </div>
          </>
        )}

        {/* Result chips */}
        {(resolveState === 'running' || resolveState === 'done') && resolveResults.length > 0 && (
          <div className="step2__result-chips">
            {resolveResults.map((r, i) => r && (
              <span
                key={i}
                className={`step2__chip step2__chip--${r.status}`}
                title={r.parsedSong?.title}
              >
                {r.status === 'auto' ? '✓' : r.status === 'review' ? '⚠' : '✗'}{' '}
                {r.parsedSong?.title?.slice(0, 20) ?? `#${i + 1}`}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
