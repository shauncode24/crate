import React, { useState } from 'react';

// Duration formatter helper
function ms(durationMs) {
  if (!durationMs) return '';
  const m = Math.floor(durationMs / 60000);
  const s = String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0');
  return `${m}:${s}`;
}

// Subcomponent: Thumbnail
function OptionThumb({ url }) {
  if (url) return <img className="review-thumb" src={url} alt="Album artwork" />;
  return <div className="review-thumb review-thumb--placeholder">♪</div>;
}

// Subcomponent: Candidate Option Radio Card
function CandidateRadioCard({
  candidate,
  groupName,
  isSelected,
  exactTrackIds,
  nearDuplicateTrackIds,
  onSelect,
}) {
  const isExactDup = exactTrackIds.includes(candidate.id);
  const nearDupWarning = nearDuplicateTrackIds[candidate.id];

  return (
    <label className={`review-option-card ${isSelected ? 'review-option-card--selected' : ''}`}>
      <span className="review-option-card__radio-wrapper">
        <input
          type="radio"
          name={groupName}
          checked={isSelected}
          onChange={() => onSelect(candidate)}
          className="review-option-card__radio-input"
        />
        <span className="review-option-card__radio-custom" />
      </span>
      
      <OptionThumb url={candidate.imageUrl} />
      
      <div className="review-option-card__info">
        <span className="review-option-card__title">
          {candidate.title}
          {isExactDup && <span className="review-duplicate-badge review-duplicate-badge--danger">Already in playlist</span>}
          {nearDupWarning && <span className="review-duplicate-badge review-duplicate-badge--warning">Already in playlist as "{nearDupWarning}"</span>}
        </span>
        <span className="review-option-card__artist">
          {candidate.artists || candidate.artist || 'Unknown Artist'}
        </span>
        {candidate.album && (
          <span className="review-option-card__album">
            {candidate.album}{candidate.releaseYear ? ` (${candidate.releaseYear})` : ''}{candidate.durationMs ? ` · ${ms(candidate.durationMs)}` : ''}
          </span>
        )}
      </div>
      
      <span className="review-option-card__score" title="Match confidence score">
        {candidate.score?.final ?? '—'}
      </span>
    </label>
  );
}

// Subcomponent: Single Song Review Block
function SongReviewBlock({
  entry,
  selection,
  onSelectCandidate,
  onSelectSkip,
  onManualSearch,
  exactTrackIds,
  nearDuplicateTrackIds,
}) {
  const { match, originalIndex } = entry;
  const initialOptions = match.topCandidates?.length
    ? match.topCandidates
    : (match.allCandidates ?? []).slice(0, 3);

  const [options, setOptions] = useState(initialOptions);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState(null);
  const [manualNotice, setManualNotice] = useState(null);

  const groupName = `review-radio-group-${originalIndex}`;
  const isSkipSelected = Boolean(selection?.skipped);
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
        setManualNotice(`${fresh.length} match${fresh.length !== 1 ? 'es' : ''} found — select one below.`);
      }
      onSelectCandidate(originalIndex, null); // force a fresh pick
    } catch (err) {
      setManualError(err.message ?? 'Manual search failed.');
    } finally {
      setManualLoading(false);
    }
  }

  return (
    <div className={`song-review-block ${selection?.resolved ? 'song-review-block--resolved' : ''}`}>
      <div className="song-review-block__header">
        <span className="song-review-block__title">
          {originalIndex + 1}. {match.parsedSong.title}
          {match.parsedSong.artist && <span className="song-review-block__artist-header"> by {match.parsedSong.artist}</span>}
        </span>
        
        {/* Resolve status pill badge */}
        <span className={`song-review-block__status-badge ${selection?.resolved ? (isSkipSelected ? 'song-review-block__status-badge--skipped' : 'song-review-block__status-badge--picked') : 'song-review-block__status-badge--pending'}`}>
          {selection?.resolved ? (isSkipSelected ? 'SKIPPED' : 'PICKED') : 'NEEDS PICK'}
        </span>
      </div>

      <div className="song-review-block__body">
        {/* Candidates Radio List */}
        <div className="song-review-options-list">
          {options.map((c) => (
            <CandidateRadioCard
              key={c.id}
              candidate={c}
              groupName={groupName}
              isSelected={selectedCandidateId === c.id}
              exactTrackIds={exactTrackIds}
              nearDuplicateTrackIds={nearDuplicateTrackIds}
              onSelect={(cand) => {
                setManualOpen(false);
                onSelectCandidate(originalIndex, cand);
              }}
            />
          ))}

          {/* Search Manually Radio Option */}
          <label className={`review-option-card review-option-card--manual-trigger ${manualOpen && selectedCandidateId === null ? 'review-option-card--selected' : ''}`}>
            <span className="review-option-card__radio-wrapper">
              <input
                type="radio"
                name={groupName}
                checked={manualOpen && selectedCandidateId === null}
                onChange={openManual}
                className="review-option-card__radio-input"
              />
              <span className="review-option-card__radio-custom" />
            </span>
            <span className="review-option-card__manual-label">Search manually</span>
          </label>

          {/* Expanded Manual Search input box */}
          {manualOpen && (
            <div className="review-manual-search-box">
              <div className="review-manual-search-box__row">
                <input
                  type="text"
                  className="review-manual-input"
                  placeholder='Corrected title, e.g. "Dawn Jazz Oikawa"'
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                  disabled={!manualSearchEnabled || manualLoading}
                />
                <button
                  type="button"
                  className="review-manual-btn"
                  onClick={handleManualSubmit}
                  disabled={!manualSearchEnabled || manualLoading || !manualText.trim()}
                >
                  {manualLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
              {!manualSearchEnabled && <p className="review-manual-error">Manual search is not supported in this environment.</p>}
              {manualError && <p className="review-manual-error">{manualError}</p>}
              {manualNotice && <p className="review-manual-notice">{manualNotice}</p>}
            </div>
          )}
        </div>

        {/* Skip action button */}
        <div className="song-review-block__actions">
          <button
            type="button"
            className={`review-skip-btn ${isSkipSelected ? 'review-skip-btn--skipped' : ''}`}
            onClick={() => onSelectSkip(originalIndex)}
          >
            {isSkipSelected ? "✓ skipped — won't be added" : 'Skip this track'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Component: ReviewTrackSection
export default function ReviewTrackSection({
  items = [],
  reviewState,
  onSelectCandidate,
  onSelectSkip,
  onSelectAllHighest,
  onManualSearch,
  exactTrackIds,
  nearDuplicateTrackIds,
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (items.length === 0) return null;

  const totalCount = items.length;
  const resolvedCount = items.filter(({ originalIndex }) => reviewState[originalIndex]?.resolved).length;
  const pendingCount = totalCount - resolvedCount;

  return (
    <div className={`collapsible-section collapsible-section--review ${isOpen ? 'collapsible-section--open' : ''}`}>
      {/* Header */}
      <div className="collapsible-section__header" onClick={() => setIsOpen(!isOpen)}>
        <div className="collapsible-section__title-group">
          <div className="collapsible-section__icon-wrapper">
            <svg className="collapsible-section__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <span className="collapsible-section__title">Needs review</span>
          <span className="collapsible-section__badge">{totalCount}</span>
        </div>
        <svg className="collapsible-section__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Body container */}
      {isOpen && (
        <div className="collapsible-section__body">
          {/* Subheader Toolbar */}
          <div className="review-toolbar">
            <button
              type="button"
              className="review-toolbar-btn"
              onClick={onSelectAllHighest}
            >
              <svg className="review-toolbar-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Select all highest rated
            </button>
          </div>


          {/* List of track review cards */}
          <div className="review-tracks-list">
            {items.map((entry) => (
              <SongReviewBlock
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
          </div>

          {/* Footer Info Summary */}
          {pendingCount > 0 && (
            <div className="review-section-footer">
              <span className="review-section-footer__hint">
                {pendingCount} track{pendingCount !== 1 ? 's' : ''} still need{pendingCount === 1 ? 's' : ''} a pick.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
