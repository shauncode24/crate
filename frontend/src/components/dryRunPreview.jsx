/**
 * dryRunPreview.jsx — Phase 9: Dry-Run Preview
 *
 * Shows the full proposed playlist state before any Spotify write call.
 * Three sections:
 *   ✓ Ready to add    — auto-accepted matches
 *   ⚠ Needs review   — inline candidate picker; gating the Confirm button
 *   ✗ Not found      — raw text shown for manual follow-up
 *
 * The "Confirm Import" button stays disabled until every review item has
 * been resolved (picked or explicitly skipped). That gating is the purpose
 * of this phase.
 *
 * Props:
 *   resolvedMatches  — array of ResolvedMatch objects from the resolution pipeline
 *   onConfirm(finalMatches) — called when the user commits; receives the full
 *                             resolved list with any user overrides applied
 *   onBack()         — navigate back to the resolver (optional)
 */

import { useState, useMemo, useCallback } from 'react';
import './dryRunPreview.css';
import BatchReviewUI from './batchReviewUI.jsx';

// ── Helpers ──────────────────────────────────────────────────────────────────

function ms(durationMs) {
  if (!durationMs) return '';
  const m = Math.floor(durationMs / 60000);
  const s = String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0');
  return `${m}:${s}`;
}

function Thumb({ url, alt }) {
  if (url) return <img className="drp-ready-item__thumb" src={url} alt={alt} />;
  return <div className="drp-ready-item__thumb-placeholder">♪</div>;
}

function CandidateThumb({ url, alt }) {
  if (url) return <img className="drp-candidate-option__thumb" src={url} alt={alt} />;
  return <div className="drp-candidate-option__thumb-placeholder">♪</div>;
}

// ── Collapsible section shell ────────────────────────────────────────────────

function Section({ icon, title, badge, badgeVariant, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="drp-section">
      <div className="drp-section-header" onClick={() => setOpen((o) => !o)} role="button" tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen((o) => !o)}>
        <span className="drp-section-icon">{icon}</span>
        <span className="drp-section-title">{title}</span>
        <span className={`drp-section-badge drp-section-badge--${badgeVariant}`}>{badge}</span>
        <span className={`drp-section-chevron ${open ? 'drp-section-chevron--open' : ''}`}>▼</span>
      </div>
      {open && <div className="drp-section-body">{children}</div>}
    </div>
  );
}

// ── Ready section ─────────────────────────────────────────────────────────────

function ReadyItem({ match, originalIndex, reviewState, onReviewChange, exactTrackIds, nearDuplicateTrackIds }) {
  const [expanded, setExpanded] = useState(false);
  const state = reviewState[originalIndex];
  const isOverridden = state !== undefined;
  const isSkipped = state?.skipped;
  const c = isSkipped ? null : (state?.chosen ?? match.chosen);

  const candidates = match.allCandidates ?? [];
  const hasAlternatives = candidates.length > 1;

  return (
    <li className={`drp-ready-item-wrapper ${isOverridden ? 'drp-ready-item-wrapper--overridden' : ''} ${isSkipped ? 'drp-ready-item-wrapper--skipped' : ''}`}>
      <div className="drp-ready-item">
        {isSkipped ? (
          <div className="drp-ready-item__skipped-placeholder">
            <span>{match.isDuplicate ? '[Duplicate - Skipped]' : '[Skipped]'} {match.parsedSong.title}{match.parsedSong.artist && ` — ${match.parsedSong.artist}`}</span>
          </div>
        ) : (
          <>
            <Thumb url={c?.imageUrl} alt={c?.album} />
            <div className="drp-ready-item__info">
              <span className="drp-ready-item__title">
                {c?.title}
                {isOverridden && <span className="drp-ready-item__override-badge">Overridden</span>}
                {match.duplicateWarning && (
                  <span className="drp-ready-item__warning-badge" style={{ color: '#d97706', marginLeft: '6px', fontSize: '11px', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '3px' }}>
                    ⚠ {match.duplicateWarning}
                  </span>
                )}
              </span>
              <span className="drp-ready-item__artist">{c?.artists || c?.artist}</span>
            </div>
            <div className="drp-ready-item__meta">
              <span className="drp-ready-item__score">{c?.score?.final}</span>
              {match.fromCache && <span className="cache-hit-badge">cache</span>}
            </div>
          </>
        )}

        {hasAlternatives && (
          <button
            type="button"
            className={`drp-ready-item__toggle-btn ${expanded ? 'drp-ready-item__toggle-btn--active' : ''}`}
            onClick={() => setExpanded(!expanded)}
            title="View alternative matches from Spotify"
          >
            {expanded ? 'Hide Alternatives' : 'Alternatives'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="drp-ready-item__alternatives">
          <CandidatePicker
            candidates={candidates}
            selectedId={isSkipped ? null : (state?.chosen?.id ?? match.chosen.id)}
            onSelect={(candidate) => {
              if (candidate?.id === match.chosen.id) {
                onReviewChange(originalIndex, undefined);
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
              className="drp-ready-item__reset-btn"
              onClick={() => onReviewChange(originalIndex, undefined)}
            >
              Reset to original auto-match
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function ReadySection({ items, reviewState, onReviewChange, exactTrackIds, nearDuplicateTrackIds }) {
  if (items.length === 0) return null;
  const activeCount = items.filter(({ originalIndex }) => !reviewState[originalIndex]?.skipped).length;
  const badgeText = activeCount === items.length
    ? `${items.length} track${items.length !== 1 ? 's' : ''}`
    : `${activeCount}/${items.length} track${items.length !== 1 ? 's' : ''}`;

  return (
    <Section
      icon="✓"
      title="Ready to add"
      badge={badgeText}
      badgeVariant="ready"
    >
      <ol className="drp-ready-list">
        {items.map(({ match, originalIndex }) => (
          <ReadyItem
            key={originalIndex}
            match={match}
            originalIndex={originalIndex}
            reviewState={reviewState}
            onReviewChange={onReviewChange}
            exactTrackIds={exactTrackIds}
            nearDuplicateTrackIds={nearDuplicateTrackIds}
          />
        ))}
      </ol>
    </Section>
  );
}

// ── Candidate picker for a single review item ────────────────────────────────

function CandidatePicker({ candidates, selectedId, onSelect, onSkip, exactTrackIds = [], nearDuplicateTrackIds = {} }) {
  const [showAll, setShowAll] = useState(false);
  
  // Show top 3 candidates; expand if user clicks Show All
  const shown = showAll ? candidates : candidates.slice(0, 3);
  const hasMore = candidates.length > shown.length;

  return (
    <div className="drp-candidate-picker">
      <span className="drp-candidate-picker__label">Pick the right match</span>
      <ul className="drp-candidate-options">
        {shown.map((c) => {
          const isSelected = c.id === selectedId;
          const isExactDup = exactTrackIds.includes(c.id);
          const nearDupWarning = nearDuplicateTrackIds[c.id];
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`drp-candidate-option ${isSelected ? 'drp-candidate-option--selected' : ''}`}
                onClick={() => onSelect(isSelected ? null : c)}
              >
                <CandidateThumb url={c.imageUrl} alt={c.album} />
                <div className="drp-candidate-option__info">
                  <span className="drp-candidate-option__title">
                    {c.title}
                    {isExactDup && <span style={{ color: '#dc2626', marginLeft: '6px', font: '10px var(--mono)' }}>(Already in playlist)</span>}
                    {nearDupWarning && <span style={{ color: '#d97706', marginLeft: '6px', font: '10px var(--mono)' }}>(Already in playlist as "{nearDupWarning}")</span>}
                  </span>
                  <span className="drp-candidate-option__artist">{c.artists || c.artist}</span>
                  <span className="drp-candidate-option__album">
                    {c.album}{c.releaseYear ? ` (${c.releaseYear})` : ''} · {ms(c.durationMs)}
                  </span>
                </div>
                <span className="drp-candidate-option__score">{c.score?.final ?? '—'}</span>
                <span className="drp-candidate-option__check">{isSelected ? '✓' : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <button
          type="button"
          className="drp-candidate-picker__more-btn"
          onClick={() => setShowAll(true)}
        >
          Show all {candidates.length} results
        </button>
      )}
      <button type="button" className="drp-candidate-option__skip" onClick={onSkip}>
        Skip — none of these are right
      </button>
    </div>
  );
}

// ── Review section ───────────────────────────────────────────────────────────

function ReviewSection({ items, reviewState, onReviewChange, onManualSearch, exactTrackIds, nearDuplicateTrackIds }) {
  if (items.length === 0) return null;

  return (
    <Section
      icon="⚠"
      title="Needs review"
      badge={`${items.length} pending`}
      badgeVariant="review"
      defaultOpen
    >
      <div className="drp-review-intro">
        <p>
          <strong>{items.length} track{items.length !== 1 ? 's' : ''}</strong> had ambiguous
          Spotify matches. Pick the right version for each one before confirming.
        </p>
      </div>

      <BatchReviewUI
        items={items}
        onManualSearch={onManualSearch}
        exactTrackIds={exactTrackIds}
        nearDuplicateTrackIds={nearDuplicateTrackIds}
        onConfirmAll={(resultsMap) => {
          Object.entries(resultsMap).forEach(([idx, resolvedMatch]) => {
            onReviewChange(Number(idx), {
              resolved: true,
              chosen: resolvedMatch.chosen,
              skipped: resolvedMatch.status === 'skipped',
            });
          });
        }}
      />
    </Section>
  );
}

// ── Not-found section ─────────────────────────────────────────────────────────

function MissingSection({ items }) {
  if (items.length === 0) return null;
  return (
    <Section
      icon="✗"
      title="Not found"
      badge={`${items.length} track${items.length !== 1 ? 's' : ''}`}
      badgeVariant="missing"
      defaultOpen={false}
    >
      {items.length === 0 ? (
        <p className="drp-empty-section">None.</p>
      ) : (
        <ul className="drp-missing-list">
          {items.map(({ match, originalIndex }) => (
            <li key={originalIndex} className="drp-missing-item">
              <div className="drp-missing-item__raw">
                {match.parsedSong.title}
                {match.parsedSong.artist && ` — ${match.parsedSong.artist}`}
              </div>
              <span className="drp-missing-item__hint">search manually</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ readyCount, reviewPendingCount, missingCount, onConfirm, confirmed, hasPlaylist = true }) {
  const canConfirm = reviewPendingCount === 0 && !confirmed;
  const total = readyCount + missingCount; // items that will be added

  const buttonText = confirmed 
    ? 'Imported ✓' 
    : !hasPlaylist
      ? `Import to New Playlist${total ? ` (${total})` : ''}`
      : `Confirm Import${total ? ` (${total})` : ''}`;

  const buttonTitle = reviewPendingCount > 0
    ? `Resolve ${reviewPendingCount} remaining review item${reviewPendingCount !== 1 ? 's' : ''} first`
    : !hasPlaylist
      ? "Create a new playlist and import these tracks"
      : "Import tracks to the selected playlist";

  return (
    <div className="drp-summary-bar">
      <div className="drp-summary-counts">
        <span className="drp-count drp-count--ready">
          <span className="drp-count__icon">✓</span>
          <span className="drp-count__n">{readyCount}</span>
          <span>ready</span>
        </span>
        <span className="drp-count drp-count--review">
          <span className="drp-count__icon">⚠</span>
          <span className="drp-count__n">{reviewPendingCount}</span>
          <span>need{reviewPendingCount !== 1 ? '' : 's'} review</span>
        </span>
        <span className="drp-count drp-count--missing">
          <span className="drp-count__icon">✗</span>
          <span className="drp-count__n">{missingCount}</span>
          <span>not found</span>
        </span>
      </div>
      <div className="drp-summary-divider" />
      <button
        className={`drp-confirm-btn ${canConfirm ? 'drp-confirm-btn--unlocked' : ''}`}
        onClick={onConfirm}
        disabled={!canConfirm}
        title={buttonTitle}
      >
        {buttonText}
      </button>
      {reviewPendingCount > 0 && (
        <span className="drp-confirm-hint">
          resolve {reviewPendingCount} to unlock
        </span>
      )}
      {!hasPlaylist && (
        <span className="drp-confirm-hint" style={{ color: 'var(--text-muted)' }}>
          new playlist will be created
        </span>
      )}
    </div>
  );
}

// ── Confirmed state ───────────────────────────────────────────────────────────

function ConfirmedState({ readyCount, onBack }) {
  return (
    <div className="drp-confirmed">
      <div className="drp-confirmed__icon">🎵</div>
      <h2 className="drp-confirmed__title">
        {readyCount} track{readyCount !== 1 ? 's' : ''} queued for import
      </h2>
      <p className="drp-confirmed__subtitle">
        Playlist write coming in Phase 10 — commit pipeline
      </p>
      {onBack && (
        <button className="drp-confirmed__back" onClick={onBack}>
          ← Back to resolver
        </button>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * DryRunPreview
 *
 * @param {object[]} resolvedMatches  — array of ResolvedMatch (status: auto|review|notfound)
 * @param {function} onConfirm        — called with finalMatches once the user confirms
 * @param {function} [onBack]         — optional back navigation
 */
export default function DryRunPreview({ resolvedMatches, onConfirm, onBack, onManualSearch, exactTrackIds = [], nearDuplicateTrackIds = {}, hasPlaylist = true }) {
  // Review state: { [originalIndex]: { resolved, chosen, skipped } }
  const [reviewState, setReviewState] = useState(() => {
    const initial = {};
    (resolvedMatches ?? []).forEach((match, i) => {
      if (match?.isDuplicate) {
        initial[i] = {
          resolved: true,
          chosen: null,
          skipped: true,
          isDuplicate: true,
        };
      }
    });
    return initial;
  });
  const [confirmed, setConfirmed] = useState(false);

  const handleReviewChange = useCallback((index, state) => {
    setReviewState((prev) => ({ ...prev, [index]: state }));
  }, []);

  // Partition matches into three buckets, keeping original index for correlation
  const { readyItems, reviewItems, missingItems } = useMemo(() => {
    const ready = [], review = [], missing = [];
    (resolvedMatches ?? []).forEach((match, i) => {
      if (!match) return;
      const item = { match, originalIndex: i };
      const rs = reviewState[i];
      if (match.status === 'auto') {
        ready.push(item);
      } else if (match.status === 'review') {
        if (rs?.resolved && rs.chosen) {
          ready.push(item);
        } else {
          review.push(item);
        }
      } else {
        missing.push(item);
      }
    });
    return { readyItems: ready, reviewItems: review, missingItems: missing };
  }, [resolvedMatches, reviewState]);

  const reviewPendingCount = reviewItems.filter(
    ({ originalIndex }) => !reviewState[originalIndex]?.resolved
  ).length;

  // The final tracks that will be added: auto-accepted + user-picked reviews + overrides
  const resolvedForCommit = useMemo(() => {
    return (resolvedMatches ?? []).map((match, i) => {
      if (!match) return null;
      const rs = reviewState[i];
      if (rs !== undefined) {
        if (rs.resolved) {
          if (rs.chosen) {
            if (match.status === 'review') {
              return { 
                ...match, 
                status: 'resolved-by-review', 
                chosen: rs.chosen, 
                resolutionMethod: 'batch-review-pick' 
              };
            }
            return { ...match, status: 'auto', chosen: rs.chosen, userPicked: true };
          }
          if (rs.skipped) {
            return { 
              ...match, 
              status: 'skipped', 
              chosen: null, 
              resolutionMethod: match.status === 'review' ? 'batch-review-skip' : undefined 
            };
          }
        }
      }
      return match;
    });
  }, [resolvedMatches, reviewState]);

  function handleConfirm() {
    setConfirmed(true);
    onConfirm?.(resolvedForCommit);
  }

  // Count truly ready: status === 'auto' or 'resolved-by-review' in resolvedForCommit
  const finalReadyCount = useMemo(() => {
    return resolvedForCommit.filter((m) => m && (m.status === 'auto' || m.status === 'resolved-by-review')).length;
  }, [resolvedForCommit]);

  if (confirmed) {
    return (
      <div className="drp">
        <SummaryBar
          readyCount={finalReadyCount}
          reviewPendingCount={0}
          missingCount={missingItems.length}
          onConfirm={handleConfirm}
          confirmed
          hasPlaylist={hasPlaylist}
        />
        <ConfirmedState readyCount={finalReadyCount} onBack={onBack} />
      </div>
    );
  }

  return (
    <div className="drp">
      <SummaryBar
        readyCount={finalReadyCount}
        reviewPendingCount={reviewPendingCount}
        missingCount={missingItems.length}
        onConfirm={handleConfirm}
        confirmed={false}
        hasPlaylist={hasPlaylist}
      />

      <ReadySection
        items={readyItems}
        reviewState={reviewState}
        onReviewChange={handleReviewChange}
        exactTrackIds={exactTrackIds}
        nearDuplicateTrackIds={nearDuplicateTrackIds}
      />
      <ReviewSection
        items={reviewItems}
        reviewState={reviewState}
        onReviewChange={handleReviewChange}
        onManualSearch={onManualSearch}
        exactTrackIds={exactTrackIds}
        nearDuplicateTrackIds={nearDuplicateTrackIds}
      />
      <MissingSection items={missingItems} />
    </div>
  );
}