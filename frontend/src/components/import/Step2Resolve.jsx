import React from 'react';
import './Step2Resolve.css';
import SearchProgressCard from './resolve/SearchProgressCard.jsx';
import MatchStatusGrid from './resolve/MatchStatusGrid.jsx';
import ImportSettingsCard from './resolve/ImportSettingsCard.jsx';
import ExtractedSongsPanel from './resolve/ExtractedSongsPanel.jsx';
import ResultChipsGrid from './resolve/ResultChipsGrid.jsx';

/**
 * Step2Resolve — Spotify batch-search and playlist-selector screen.
 * Orchestrates SearchProgressCard, MatchStatusGrid, ImportSettingsCard, 
 * ExtractedSongsPanel, and ResultChipsGrid.
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
  const autoCount = resolveResults.filter((r) => r?.status === 'auto').length;
  const reviewCount = resolveResults.filter((r) => r?.status === 'review').length;
  const missingCount = resolveResults.filter((r) => r?.status === 'notfound').length;

  return (
    <div className="step2">
      {/* Extracted track chips collapsible accordion */}
      <ExtractedSongsPanel
        songs={songs}
        resolveState={resolveState}
        resolveResults={resolveResults}
        onBack={onBack}
      />

      {/* Spotify search progress indicator, rates limits, and controls */}
      <SearchProgressCard
        resolveState={resolveState}
        batchProgress={batchProgress}
        retryNotice={retryNotice}
        resolveError={resolveError}
        onResolveAll={onResolveAll}
        isLoggedIn={isLoggedIn}
      />

      {/* Dynamic match quality metrics row (Ready, Need Review, Not Found) */}
      {resolveState !== 'idle' && (
        <MatchStatusGrid
          autoCount={autoCount}
          reviewCount={reviewCount}
          missingCount={missingCount}
          resolveState={resolveState}
        />
      )}

      {/* Import options (target playlist & dups check) after resolution completes */}
      {resolveState === 'done' && (
        <ImportSettingsCard
          playlists={playlists}
          loadingPlaylists={loadingPlaylists}
          selectedPlaylistId={selectedPlaylistId}
          customPlaylistId={customPlaylistId}
          deduplicateEnabled={deduplicateEnabled}
          checkingDuplicates={checkingDuplicates}
          onPlaylistChange={onPlaylistChange}
          onCustomPlaylistChange={onCustomPlaylistChange}
          onDeduplicateChange={onDeduplicateChange}
          onEnterPreview={onEnterPreview}
        />
      )}

    </div>
  );
}
