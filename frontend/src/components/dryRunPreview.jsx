import React, { useState, useMemo, useCallback } from 'react';
import './dryRunPreview.css';
import SummaryStickyBar from './import/review/SummaryStickyBar.jsx';
import ReadyTrackSection from './import/review/ReadyTrackSection.jsx';
import ReviewTrackSection from './import/review/ReviewTrackSection.jsx';
import NotFoundSection from './import/review/NotFoundSection.jsx';


/**
 * ConfirmedState
 * Renders fallback view after the user confirms (in legacy or secondary flows).
 */
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

/**
 * DryRunPreview
 * Orchestrates SummaryStickyBar, ReadyTrackSection, ReviewTrackSection, and NotFoundSection.
 */
export default function DryRunPreview({
  resolvedMatches = [],
  onConfirm,
  onBack,
  onManualSearch,
  exactTrackIds = [],
  nearDuplicateTrackIds = {},
  hasPlaylist = true,
}) {
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

  // Partition matches into ready, review, and missing buckets
  const { readyItems, reviewItems, missingItems } = useMemo(() => {
    const ready = [];
    const review = [];
    const missing = [];
    
    (resolvedMatches ?? []).forEach((match, i) => {
      if (!match) return;
      const item = { match, originalIndex: i };
      if (match.status === 'auto') {
        ready.push(item);
      } else if (match.status === 'review') {
        review.push(item);
      } else {
        missing.push(item);
      }
    });
    return { readyItems: ready, reviewItems: review, missingItems: missing };
  }, [resolvedMatches]);

  const handleSelectCandidate = useCallback((originalIndex, candidate) => {
    setReviewState((prev) => {
      if (candidate === null) {
        const next = { ...prev };
        delete next[originalIndex];
        return next;
      }
      return {
        ...prev,
        [originalIndex]: {
          resolved: true,
          chosen: candidate,
          skipped: false,
        },
      };
    });
  }, []);

  const handleSelectSkip = useCallback((originalIndex) => {
    setReviewState((prev) => {
      if (prev[originalIndex]?.skipped) {
        const next = { ...prev };
        delete next[originalIndex];
        return next;
      }
      return {
        ...prev,
        [originalIndex]: {
          resolved: true,
          chosen: null,
          skipped: true,
        },
      };
    });
  }, []);

  const handleSelectAllHighest = useCallback(() => {
    setReviewState((prev) => {
      const next = { ...prev };
      reviewItems.forEach(({ match, originalIndex }) => {
        const options = match.topCandidates?.length
          ? match.topCandidates
          : (match.allCandidates ?? []).slice(0, 3);
        if (options && options.length > 0) {
          next[originalIndex] = {
            resolved: true,
            chosen: options[0],
            skipped: false,
          };
        }
      });
      return next;
    });
  }, [reviewItems]);

  const reviewPendingCount = reviewItems.filter(
    ({ originalIndex }) => !reviewState[originalIndex]?.resolved
  ).length;

  // Compile final tracks with selections applied
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
                resolutionMethod: 'batch-review-pick',
              };
            }
            return { ...match, status: 'auto', chosen: rs.chosen, userPicked: true };
          }
          if (rs.skipped) {
            return {
              ...match,
              status: 'skipped',
              chosen: null,
              resolutionMethod: match.status === 'review' ? 'batch-review-skip' : undefined,
            };
          }
        }
      }
      return match;
    });
  }, [resolvedMatches, reviewState]);

  function handleConfirm() {
    onConfirm?.(resolvedForCommit);
  }

  // Count active ready/resolved tracks
  const finalReadyCount = useMemo(() => {
    return resolvedForCommit.filter(
      (m) => m && (m.status === 'auto' || m.status === 'resolved-by-review')
    ).length;
  }, [resolvedForCommit]);

  return (
    <div className="drp">
      {/* Sticky top progress/action bar */}
      <SummaryStickyBar
        readyCount={finalReadyCount}
        reviewPendingCount={reviewPendingCount}
        missingCount={missingItems.length}
        onConfirm={handleConfirm}
        hasPlaylist={hasPlaylist}
      />

      {/* Auto-resolved tracks collapsible list */}
      <ReadyTrackSection
        items={readyItems}
        reviewState={reviewState}
        onReviewChange={handleSelectCandidate}
        exactTrackIds={exactTrackIds}
        nearDuplicateTrackIds={nearDuplicateTrackIds}
      />

      {/* Ambiguous candidates picking checklist */}
      <ReviewTrackSection
        items={reviewItems}
        reviewState={reviewState}
        onSelectCandidate={handleSelectCandidate}
        onSelectSkip={handleSelectSkip}
        onSelectAllHighest={handleSelectAllHighest}
        onManualSearch={onManualSearch}
        exactTrackIds={exactTrackIds}
        nearDuplicateTrackIds={nearDuplicateTrackIds}
      />

      {/* Missing tracks list */}
      <NotFoundSection items={missingItems} />
    </div>
  );
}