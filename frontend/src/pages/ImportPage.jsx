import TopNav         from '../components/layout/TopNav.jsx';
import StepBreadcrumb from '../components/import/StepBreadcrumb.jsx';
import Step1Input     from '../components/import/Step1Input.jsx';
import Step2Resolve   from '../components/import/Step2Resolve.jsx';
import Step3Preview   from '../components/import/Step3Preview.jsx';
import Step4Report    from '../components/import/Step4Report.jsx';
import { useImportPipeline } from '../components/import/useImportPipeline.js';

import '../components/importPipeline.css';

export default function ImportPage({ isLoggedIn, profile, onLogout }) {
  const {
    songs,
    suggestedName,
    suggestedDesc,
    resolveState,
    resolveError,
    resolveResults,
    batchProgress,
    retryNotice,
    playlists,
    selectedPlaylistId,
    customPlaylistId,
    loadingPlaylists,
    deduplicateEnabled,
    checkingDuplicates,
    pendingMatches,
    exactTrackIds,
    nearDuplicateTrackIds,
    importReport,
    commitState,
    runMetrics,
    activeStep,
    doneSteps,
    resolvedPlaylistId,

    setSelectedPlaylistId,
    setCustomPlaylistId,
    setDeduplicateEnabled,
    setSuggestedName,
    setSuggestedDesc,
    setPendingMatches,
    setActiveStep,
    setDoneSteps,

    handleExtracted,
    handleResolveAll,
    handleManualSearch,
    enterPreview,
    handleConfirm,
    handleRetryFailed,
    resetToInput,
  } = useImportPipeline({ isLoggedIn });

  return (
    <div className="import-page">
      <TopNav displayName={profile?.display_name} onLogout={onLogout} />

      <div className="import-page__inner">
        <StepBreadcrumb current={activeStep} done={doneSteps} onReset={resetToInput} />

        {activeStep === 'input' && (
          <Step1Input onExtracted={handleExtracted} />
        )}

        {activeStep === 'resolve' && (
          <Step2Resolve
            songs={songs}
            isLoggedIn={isLoggedIn}
            resolveState={resolveState}
            resolveError={resolveError}
            resolveResults={resolveResults}
            batchProgress={batchProgress}
            retryNotice={retryNotice}
            playlists={playlists}
            loadingPlaylists={loadingPlaylists}
            selectedPlaylistId={selectedPlaylistId}
            customPlaylistId={customPlaylistId}
            deduplicateEnabled={deduplicateEnabled}
            checkingDuplicates={checkingDuplicates}
            onResolveAll={handleResolveAll}
            onPlaylistChange={setSelectedPlaylistId}
            onCustomPlaylistChange={setCustomPlaylistId}
            onDeduplicateChange={setDeduplicateEnabled}
            onEnterPreview={enterPreview}
            onBack={resetToInput}
          />
        )}

        {activeStep === 'preview' && (
          <Step3Preview
            pendingMatches={pendingMatches}
            resolveResults={resolveResults}
            selectedPlaylistId={resolvedPlaylistId}
            suggestedName={suggestedName}
            suggestedDesc={suggestedDesc}
            exactTrackIds={exactTrackIds}
            nearDuplicateTrackIds={nearDuplicateTrackIds}
            onManualSearch={handleManualSearch}
            onBack={() => { setActiveStep('resolve'); setDoneSteps(prev => prev.filter(s => s !== 'preview')); }}
            onConfirmAll={matches => setPendingMatches(matches)}
            onFinalizeImport={handleConfirm}
            setSuggestedName={setSuggestedName}
            setSuggestedDesc={setSuggestedDesc}
            setPendingMatches={setPendingMatches}
          />
        )}

        {activeStep === 'report' && (
          <Step4Report
            commitState={commitState}
            report={importReport}
            runMetrics={runMetrics}
            playlistId={resolvedPlaylistId}
            onRetry={handleRetryFailed}
            onReset={resetToInput}
          />
        )}
      </div>
    </div>
  );
}