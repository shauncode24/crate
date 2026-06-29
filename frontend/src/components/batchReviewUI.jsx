/**
 * batchReviewUI.jsx — Phase 10: Batch Review UI
 *
 * Resolves every ⚠ "needs review" item in one screen instead of a
 * pop-up per song. For each song:
 *   - radio options for its top 3 candidates (title / artist / score)
 *   - a "none of these — search manually" radio that reveals a free-text
 *     input; submitting it calls onManualSearch(originalIndex, text),
 *     which re-runs the resolver (Phase 5/6) against the corrected text
 *     and swaps in the new candidates as fresh radio options
 *
 * "Confirm All" stays disabled until every song has a pick (a candidate,
 * a manual-search result, or an explicit skip). On confirm it hands the
 * parent a { [originalIndex]: ResolvedMatch } map where every picked song
 * carries status: 'resolved-by-review' + resolutionMethod:
 * 'batch-review-pick' (skips carry 'skipped' / 'batch-review-skip') — so
 * there are zero review items left afterward.
 *
 * Props:
 *   items          — [{ match: ResolvedMatch, originalIndex }], review-bucket only
 *   onManualSearch — async (originalIndex, text) => ResolvedMatch-like result.
 *                    Optional — manual search disables itself (with a hint) if omitted.
 *   onConfirmAll   — ({ [originalIndex]: ResolvedMatch }) => void
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

function SongReview({ entry, selection, onSelectCandidate, onSelectSkip, onManualSearch }) {
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
  const isSkipSelected      = selection?.type === 'skip';
  const selectedCandidateId = selection?.type === 'candidate' ? selection.candidate.id : null;
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
        </div>
        <span className={`brv-song__status brv-song__status--${selection ? 'picked' : 'pending'}`}>
          {selection ? (isSkipSelected ? 'skipped' : 'picked') : 'needs a pick'}
        </span>
      </div>

      <div className="brv-options" role="radiogroup" aria-label={`Candidates for ${match.parsedSong.title}`}>
        {options.map((c) => (
          <label key={c.id} className={`brv-option ${selectedCandidateId === c.id ? 'brv-option--selected' : ''}`}>
            <input
              type="radio"
              name={groupName}
              checked={selectedCandidateId === c.id}
              onChange={() => onSelectCandidate(originalIndex, c)}
            />
            <Thumb url={c.imageUrl} alt={c.album} />
            <div className="brv-option__info">
              <span className="brv-option__title">{c.title}</span>
              <span className="brv-option__artist">{c.artists || c.artist}</span>
              {c.album && (
                <span className="brv-option__album">
                  {c.album}{c.releaseYear ? ` (${c.releaseYear})` : ''}{c.durationMs ? ` · ${ms(c.durationMs)}` : ''}
                </span>
              )}
            </div>
            <span className="brv-option__score">{c.score?.final ?? '—'}</span>
          </label>
        ))}

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

export default function BatchReviewUI({ items, onManualSearch, onConfirmAll }) {
  const [selections, setSelections] = useState({}); // { [originalIndex]: { type: 'candidate'|'skip', candidate? } }

  const handleSelectCandidate = useCallback((originalIndex, candidate) => {
    setSelections((prev) => {
      if (candidate === null) {
        const next = { ...prev };
        delete next[originalIndex];
        return next;
      }
      return { ...prev, [originalIndex]: { type: 'candidate', candidate } };
    });
  }, []);

  const handleSelectSkip = useCallback((originalIndex) => {
    setSelections((prev) => {
      if (prev[originalIndex]?.type === 'skip') {
        const next = { ...prev };
        delete next[originalIndex];
        return next;
      }
      return { ...prev, [originalIndex]: { type: 'skip' } };
    });
  }, []);

  const allSelected   = items.length > 0 && items.every(({ originalIndex }) => Boolean(selections[originalIndex]));
  const pendingCount  = items.filter(({ originalIndex }) => !selections[originalIndex]).length;

  function handleConfirmAll() {
    if (!allSelected) return;
    const resultsMap = {};
    items.forEach(({ match, originalIndex }) => {
      const sel = selections[originalIndex];
      resultsMap[originalIndex] =
        sel.type === 'candidate'
          ? { ...match, status: 'resolved-by-review', chosen: sel.candidate, resolutionMethod: 'batch-review-pick' }
          : { ...match, status: 'skipped', chosen: null, resolutionMethod: 'batch-review-skip' };
    });
    onConfirmAll?.(resultsMap);
  }

  return (
    <div className="brv">
      <ul className="brv-list">
        {items.map((entry) => (
          <SongReview
            key={entry.originalIndex}
            entry={entry}
            selection={selections[entry.originalIndex] ?? null}
            onSelectCandidate={handleSelectCandidate}
            onSelectSkip={handleSelectSkip}
            onManualSearch={onManualSearch}
          />
        ))}
      </ul>
      <div className="brv-footer">
        <span className="brv-footer__hint">
          {allSelected
            ? 'Everything has a pick.'
            : `${pendingCount} song${pendingCount !== 1 ? 's' : ''} still need${pendingCount === 1 ? 's' : ''} a pick.`}
        </span>
        <button
          type="button"
          className={`brv-confirm-btn ${allSelected ? 'brv-confirm-btn--unlocked' : ''}`}
          onClick={handleConfirmAll}
          disabled={!allSelected}
        >
          Confirm All ({items.length})
        </button>
      </div>
    </div>
  );
}