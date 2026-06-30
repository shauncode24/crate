/**
 * batchReviewUI.jsx — Phase 10: Batch Review UI (Stateless)
 *
 * Displays all needs-review items. Making selections immediately
 * updates the parent state, unlocking the main import button directly.
 */

import { useState, useCallback } from 'react';
import './batchReviewUI.css';

function ms(durationMs) {
  if (!durationMs) return '';
  const m = Math.floor(durationMs / 60000);
  const s = String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0');
  return `${m}:${s}`;
}

function Thumb({ url, alt }) {
  if (url) return <img className="brv-thumb" src={url} alt={alt} />;
  return <div className="brv-thumb brv-thumb--placeholder">♪</div>;
}

// ── One song's radio group ───────────────────────────────────────────────────

function SongReview({ entry, selection, onSelectCandidate, onSelectSkip, onManualSearch, exactTrackIds = [], nearDuplicateTrackIds = {} }) {
  const { match, originalIndex } = entry;
  const initialOptions = match.topCandidates?.length
    ? match.topCandidates
    : (match.allCandidates ?? []).slice(0, 3);

  const [options, setOptions]           = useState(initialOptions);
  const [manualOpen, setManualOpen]     = useState(false);
  const [manualText, setManualText]     = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError]   = useState(null);
  const [manualNotice, setManualNotice] = useState(null);

  const groupName = `review-${originalIndex}`;
  const isSkipSelected      = Boolean(selection?.skipped);
  const selectedCandidateId = selection?.chosen?.id ?? null;
  const manualSearchEnabled = Boolean(onManualSearch);

  function openManual() {
    setManualOpen(true);
    if (selectedCandidateId) onSelectCandidate(originalIndex, null);
  }

  async function handleManualSubmit() {
    const text = manualText.trim();
    if (!text || !onManualSearch) return;

    setManualLoading(true);
    setManualError(null);
    setManualNotice(null);
    try {
      const result = await onManualSearch(originalIndex, text);
      const fresh =
        result?.status === 'auto' && result.chosen
          ? [result.chosen]
          : result?.topCandidates?.length
          ? result.topCandidates
          : (result?.allCandidates ?? []).slice(0, 3);

      if (!fresh.length) {
        setManualNotice(`No Spotify matches for "${text}".`);
      } else {
        setOptions(fresh);
        setManualNotice(`${fresh.length} match${fresh.length !== 1 ? 'es' : ''} found — pick one below.`);
      }
      onSelectCandidate(originalIndex, null); // force a fresh pick against the new options
    } catch (err) {
      setManualError(err.message ?? 'Manual search failed.');
    } finally {
      setManualLoading(false);
    }
  }

  return (
    <li className="brv-song">
      <div className="brv-song__header">
        <span className="brv-song__index">{originalIndex + 1}</span>
        <div className="brv-song__info">
          <span className="brv-song__title">{match.parsedSong.title}</span>
          {match.parsedSong.artist && <span className="brv-song__artist">{match.parsedSong.artist}</span>}
          {match.duplicateWarning && (
            <span className="brv-song__warning-badge" style={{ color: '#d97706', fontSize: '11px', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '3px', marginTop: '4px', display: 'inline-block' }}>
              ⚠ {match.duplicateWarning}
            </span>
          )}
        </div>
        <span className={`brv-song__status brv-song__status--${selection?.resolved ? 'picked' : 'pending'}`}>
          {selection?.resolved ? (isSkipSelected ? 'skipped' : 'picked') : 'needs a pick'}
        </span>
      </div>

      <div className="brv-options" role="radiogroup" aria-label={`Candidates for ${match.parsedSong.title}`}>
        {options.map((c) => {
          const isExactDup = exactTrackIds.includes(c.id);
          const nearDupWarning = nearDuplicateTrackIds[c.id];
          return (
            <label key={c.id} className={`brv-option ${selectedCandidateId === c.id ? 'brv-option--selected' : ''}`}>
              <input
                type="radio"
                name={groupName}
                checked={selectedCandidateId === c.id}
                onChange={() => onSelectCandidate(originalIndex, c)}
              />
              <Thumb url={c.imageUrl} alt={c.album} />
              <div className="brv-option__info">
                <span className="brv-option__title">
                  {c.title}
                  {isExactDup && <span style={{ color: '#dc2626', marginLeft: '6px', font: '10px var(--mono)' }}>(Already in playlist)</span>}
                  {nearDupWarning && <span style={{ color: '#d97706', marginLeft: '6px', font: '10px var(--mono)' }}>(Already in playlist as "{nearDupWarning}")</span>}
                </span>
                <span className="brv-option__artist">{c.artists || c.artist}</span>
                {c.album && (
                  <span className="brv-option__album">
                    {c.album}{c.releaseYear ? ` (${c.releaseYear})` : ''}{c.durationMs ? ` · ${ms(c.durationMs)}` : ''}
                  </span>
                )}
              </div>
              <span className="brv-option__score">{c.score?.final ?? '—'}</span>
            </label>
          );
        })}

        <label className="brv-option brv-option--manual">
          <input
            type="radio"
            name={groupName}
            checked={manualOpen && selectedCandidateId === null}
            onChange={openManual}
          />
          <span className="brv-option__manual-label">None of these — search manually</span>
        </label>

        {manualOpen && (
          <div className="brv-manual">
            <div className="brv-manual__row">
              <input
                type="text"
                className="brv-manual__input"
                placeholder='Corrected title, e.g. "Dawn Jazz Oikawa"'
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                disabled={!manualSearchEnabled || manualLoading}
              />
              <button
                type="button"
                className="brv-manual__btn"
                onClick={handleManualSubmit}
                disabled={!manualSearchEnabled || manualLoading || !manualText.trim()}
              >
                {manualLoading ? 'Searching…' : 'Search'}
              </button>
            </div>
            {!manualSearchEnabled && <p className="brv-manual__hint">Manual search isn't wired up for this view.</p>}
            {manualError && <p className="brv-manual__error">{manualError}</p>}
            {manualNotice && <p className="brv-manual__notice">{manualNotice}</p>}
          </div>
        )}

        <button
          type="button"
          className={`brv-skip ${isSkipSelected ? 'brv-skip--selected' : ''}`}
          onClick={() => onSelectSkip(originalIndex)}
        >
          {isSkipSelected ? "✓ skipped — won't be added" : 'Skip this song'}
        </button>
      </div>
    </li>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function BatchReviewUI({
  items,
  reviewState,
  onSelectCandidate,
  onSelectSkip,
  onSelectAllHighest,
  onManualSearch,
  exactTrackIds = [],
  nearDuplicateTrackIds = {}
}) {
  const totalCount = items.length;
  const resolvedCount = items.filter(({ originalIndex }) => reviewState[originalIndex]?.resolved).length;
  const allResolved = totalCount > 0 && resolvedCount === totalCount;
  const pendingCount = totalCount - resolvedCount;

  return (
    <div className="brv">
      <div className="brv-toolbar">
        <button
          type="button"
          className="brv-batch-btn"
          onClick={onSelectAllHighest}
        >
          ✨ Select all highest rated candidates
        </button>
      </div>

      <ul className="brv-list">
        {items.map((entry) => (
          <SongReview
            key={entry.originalIndex}
            entry={entry}
            selection={reviewState[entry.originalIndex] ?? null}
            onSelectCandidate={onSelectCandidate}
            onSelectSkip={onSelectSkip}
            onManualSearch={onManualSearch}
            exactTrackIds={exactTrackIds}
            nearDuplicateTrackIds={nearDuplicateTrackIds}
          />
        ))}
      </ul>

      <div className="brv-footer" style={{ borderTop: '1px solid var(--border)', marginTop: '20px' }}>
        <span className="brv-footer__hint">
          {allResolved
            ? 'Everything has a pick.'
            : `${pendingCount} song${pendingCount !== 1 ? 's' : ''} still need${pendingCount === 1 ? 's' : ''} a pick.`}
        </span>
      </div>
    </div>
  );
}