import React, { useState } from 'react';

// Duration formatter helper
function ms(durationMs) {
  if (!durationMs) return '';
  const m = Math.floor(durationMs / 60000);
  const s = String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0');
  return `${m}:${s}`;
}

// Subcomponent: Thumbnail
function Thumb({ url }) {
  if (url) return <img className="review-thumb" src={url} alt="Album artwork" />;
  return <div className="review-thumb review-thumb--placeholder">♪</div>;
}

// Subcomponent: Candidate item picker option
function CandidateOption({ candidate, isSelected, exactTrackIds, nearDuplicateTrackIds, onSelect }) {
  const isExactDup = exactTrackIds.includes(candidate.id);
  const nearDupWarning = nearDuplicateTrackIds[candidate.id];

  return (
    <button
      type="button"
      className={`review-candidate-card ${isSelected ? 'review-candidate-card--selected' : ''}`}
      onClick={() => onSelect(candidate)}
    >
      <Thumb url={candidate.imageUrl} />
      <div className="review-candidate-card__info">
        <span className="review-candidate-card__title">
          {candidate.title}
          {isExactDup && <span className="review-duplicate-badge review-duplicate-badge--danger">Already in playlist</span>}
          {nearDupWarning && <span className="review-duplicate-badge review-duplicate-badge--warning">Already in playlist as "{nearDupWarning}"</span>}
        </span>
        <span className="review-candidate-card__meta">
          {candidate.artists || candidate.artist}
        </span>
        <span className="review-candidate-card__submeta">
          {candidate.album}{candidate.releaseYear ? ` (${candidate.releaseYear})` : ''}
          {candidate.durationMs ? ` · ${ms(candidate.durationMs)}` : ''}
        </span>
      </div>
      <div className="review-candidate-card__aside">
        <span className="review-candidate-card__score">{candidate.score?.final ?? '—'}</span>
        <span className="review-candidate-card__radio">
          <span className="review-candidate-card__radio-inner" />
        </span>
      </div>
    </button>
  );
}

// Subcomponent: Inline picker for alternate matches
function InlineAlternatesPicker({
  candidates = [],
  selectedId,
  onSelect,
  onSkip,
  exactTrackIds = [],
  nearDuplicateTrackIds = {},
}) {
  const [showAll, setShowAll] = useState(false);

  const shown = showAll ? candidates : candidates.slice(0, 3);
  const hasMore = candidates.length > shown.length;

  return (
    <div className="review-alternates-picker">
      <span className="review-alternates-picker__label">Select alternative version</span>
      <div className="review-alternates-list">
        {shown.map((c) => (
          <CandidateOption
            key={c.id}
            candidate={c}
            isSelected={c.id === selectedId}
            exactTrackIds={exactTrackIds}
            nearDuplicateTrackIds={nearDuplicateTrackIds}
            onSelect={onSelect}
          />
        ))}
      </div>

      <div className="review-alternates-actions">
        {hasMore && (
          <button
            type="button"
            className="review-text-btn"
            onClick={() => setShowAll(true)}
          >
            Show all {candidates.length} search results
          </button>
        )}
        <button type="button" className="review-text-btn review-text-btn--danger" onClick={onSkip}>
          Skip — none of these are correct
        </button>
      </div>
    </div>
  );
}

// Subcomponent: Single Ready Track item
function ReadyTrackItem({
  match,
  originalIndex,
  reviewState,
  onReviewChange,
  exactTrackIds,
  nearDuplicateTrackIds,
}) {
  const [expanded, setExpanded] = useState(false);
  const state = reviewState[originalIndex];
  const isOverridden = state !== undefined;
  const isSkipped = state?.skipped;
  const currentTrack = isSkipped ? null : (state?.chosen ?? match.chosen);

  const candidates = match.allCandidates ?? [];
  const hasAlternatives = candidates.length > 1;

  return (
    <div className={`ready-track-item ${isSkipped ? 'ready-track-item--skipped' : ''} ${isOverridden ? 'ready-track-item--overridden' : ''}`}>
      <div className="ready-track-item__main">
        {isSkipped ? (
          <div className="ready-track-item__skipped">
            <span className="ready-track-item__skipped-label">
              {match.isDuplicate ? 'Skipped (Duplicate)' : 'Skipped'}
            </span>
            <span className="ready-track-item__skipped-title">
              {match.parsedSong.title}{match.parsedSong.artist && ` — ${match.parsedSong.artist}`}
            </span>
          </div>
        ) : (
          <>
            <Thumb url={currentTrack?.imageUrl} />
            <div className="ready-track-item__info">
              <span className="ready-track-item__title">
                {currentTrack?.title}
                {isOverridden && <span className="ready-track-item__badge ready-track-item__badge--override">Overridden</span>}
                {match.duplicateWarning && (
                  <span className="ready-track-item__badge ready-track-item__badge--warning">
                    Already in playlist
                  </span>
                )}
              </span>
              <span className="ready-track-item__subtext">
                {currentTrack?.artists || currentTrack?.artist || 'Unknown Artist'}
                {currentTrack?.album && ` · ${currentTrack.album}`}
              </span>
            </div>
            
            <div className="ready-track-item__meta">
              <span className="ready-track-item__score" title="Match quality score">
                {currentTrack?.score?.final ?? '—'}
              </span>
            </div>
          </>
        )}

        {hasAlternatives && (
          <button
            type="button"
            className="ready-track-item__toggle"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Hide alternates' : 'Show alternates'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="ready-track-item__expansion">
          <InlineAlternatesPicker
            candidates={candidates}
            selectedId={isSkipped ? null : (state?.chosen?.id ?? match.chosen.id)}
            onSelect={(candidate) => {
              if (candidate?.id === match.chosen.id) {
                onReviewChange(originalIndex, undefined); // reset to default
              } else {
                onReviewChange(originalIndex, {
                  resolved: true,
                  chosen: candidate,
                  skipped: false,
                });
              }
            }}
            onSkip={() => {
              onReviewChange(originalIndex, {
                resolved: true,
                chosen: null,
                skipped: true,
              });
            }}
            exactTrackIds={exactTrackIds}
            nearDuplicateTrackIds={nearDuplicateTrackIds}
          />
          {isOverridden && (
            <button
              type="button"
              className="review-reset-btn"
              onClick={() => onReviewChange(originalIndex, undefined)}
            >
              Reset to original auto-match
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Main Component: ReadyTrackSection
export default function ReadyTrackSection({
  items = [],
  reviewState,
  onReviewChange,
  exactTrackIds,
  nearDuplicateTrackIds,
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (items.length === 0) return null;

  const activeCount = items.filter(({ originalIndex }) => !reviewState[originalIndex]?.skipped).length;

  return (
    <div className={`collapsible-section collapsible-section--ready ${isOpen ? 'collapsible-section--open' : ''}`}>
      {/* Header */}
      <div className="collapsible-section__header" onClick={() => setIsOpen(!isOpen)}>
        <div className="collapsible-section__title-group">
          <div className="collapsible-section__icon-wrapper">
            <svg className="collapsible-section__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="collapsible-section__title">Ready to add</span>
          <span className="collapsible-section__badge">{activeCount}</span>
        </div>
        <svg className="collapsible-section__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Body List */}
      {isOpen && (
        <div className="collapsible-section__body">
          <div className="ready-tracks-list">
            {items.map(({ match, originalIndex }) => (
              <ReadyTrackItem
                key={originalIndex}
                match={match}
                originalIndex={originalIndex}
                reviewState={reviewState}
                onReviewChange={onReviewChange}
                exactTrackIds={exactTrackIds}
                nearDuplicateTrackIds={nearDuplicateTrackIds}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
