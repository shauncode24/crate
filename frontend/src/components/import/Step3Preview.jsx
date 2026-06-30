import DryRunPreview from '../dryRunPreview.jsx';
import './Step3Preview.css';

/**
 * Step3Preview — dry-run preview + AI naming panel.
 *
 * Two sub-states controlled by `pendingMatches`:
 *   null     → show DryRunPreview (candidate picker)
 *   non-null → show naming panel (AI-suggested name/desc, editable)
 *
 * Props:
 *   pendingMatches       matches array | null
 *   resolveResults       ResolvedMatch[]
 *   selectedPlaylistId   string
 *   suggestedName        string
 *   suggestedDesc        string
 *   exactTrackIds        number[]
 *   nearDuplicateTrackIds object
 *   onManualSearch       (index, text) => Promise<ResolvedMatch>
 *   onBack               () => void   (back to resolve step)
 *   onConfirmAll         (matches) => void   (sets pendingMatches)
 *   onFinalizeImport     (matches) => void   (triggers Spotify commit)
 *   setSuggestedName     (s) => void
 *   setSuggestedDesc     (s) => void
 *   setPendingMatches    (m) => void
 */
export default function Step3Preview({
  pendingMatches,
  resolveResults,
  selectedPlaylistId,
  suggestedName,
  suggestedDesc,
  exactTrackIds,
  nearDuplicateTrackIds,
  onManualSearch,
  onBack,
  onConfirmAll,
  onFinalizeImport,
  setSuggestedName,
  setSuggestedDesc,
  setPendingMatches,
}) {
  const hasPlaylist = Boolean(selectedPlaylistId && selectedPlaylistId !== 'custom');

  if (pendingMatches) {
    return (
      <section className="step3-naming">
        <div className="step3-naming__card">
          <div className="step3-naming__head">
            <span className="step3-naming__sparkle">✨</span>
            <div>
              <div className="step3-naming__title">Name your playlist</div>
              <div className="step3-naming__subtitle">AI-suggested based on your track list — edit freely</div>
            </div>
          </div>

          <div className="step3-naming__fields">
            <div className="step3-naming__field">
              <label className="step3-naming__label">PLAYLIST NAME</label>
              <input
                type="text"
                className="step3-naming__input step3-naming__input--name"
                value={suggestedName}
                onChange={e => setSuggestedName(e.target.value)}
                placeholder="Playlist name…"
                maxLength={100}
                autoFocus
              />
            </div>
            <div className="step3-naming__field">
              <label className="step3-naming__label">DESCRIPTION</label>
              <input
                type="text"
                className="step3-naming__input"
                value={suggestedDesc}
                onChange={e => setSuggestedDesc(e.target.value)}
                placeholder="One-line description…"
                maxLength={200}
              />
            </div>
            <p className="step3-naming__hint">
              {!selectedPlaylistId
                ? 'This will be the name & description of your new Spotify playlist.'
                : "You're adding to an existing playlist — name & description won't be applied."}
            </p>
          </div>
        </div>

        <div className="step3-naming__actions">
          <button className="step3-naming__back" onClick={() => setPendingMatches(null)}>
            ← Back to review
          </button>
          <button
            className="step3-naming__finalize"
            onClick={() => { onFinalizeImport(pendingMatches); setPendingMatches(null); }}
          >
            Finalize import →
          </button>
        </div>
      </section>
    );
  }

  return (
    <DryRunPreview
      resolvedMatches={resolveResults}
      onConfirm={onConfirmAll}
      onManualSearch={onManualSearch}
      onBack={onBack}
      exactTrackIds={exactTrackIds}
      nearDuplicateTrackIds={nearDuplicateTrackIds}
      hasPlaylist={hasPlaylist}
    />
  );
}
