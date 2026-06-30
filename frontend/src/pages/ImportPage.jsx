import { useState, useCallback, useEffect } from 'react';
import { extractSongs }          from '../extraction/extract.js';
import { getValidAccessToken }   from '../auth/spotifyAuth.js';
import DryRunPreview             from '../components/dryRunPreview.jsx';
import { resolveSongs, resolveSongsStream, commitToPlaylist, buildImportReport, summarizeRun } from '../api/resolveApi.js';
import TopNav from '../components/layout/TopNav.jsx';
import StepBreadcrumb from '../components/import/StepBreadcrumb.jsx';
import Step1Input from '../components/import/Step1Input.jsx';
import '../components/importPipeline.css';
// import '../components/layout/import-page.css';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

// ...fetchPlaylistTracks(), ms(), ReportThumb(), MetricCard(), ReportView()
// all stay exactly as they are in importPipeline.jsx — unchanged.

export default function ImportPage({ isLoggedIn, profile, onLogout }) {
  // ── Step 1: extraction ───────────────────────────────────────────────────

  const [rawInput,     setRawInput]     = useState('');
  const [songs,        setSongs]        = useState([]);
  const [extractState, setExtractState] = useState('idle');
  const [extractError, setExtractError] = useState(null);

  const [suggestedName, setSuggestedName] = useState('');
  const [suggestedDesc, setSuggestedDesc] = useState('');
  const [pendingMatches, setPendingMatches] = useState(null);

  // ── Step 2: resolution ───────────────────────────────────────────────────

  const [resolveState,   setResolveState]   = useState('idle');
  const [resolveError,   setResolveError]   = useState(null);
  const [resolveResults, setResolveResults] = useState([]);
  const [batchProgress,  setBatchProgress]  = useState({ completed: 0, total: 0 });
  const [retryNotice,    setRetryNotice]    = useState(null);

  const [sessionLogs,  setSessionLogs]  = useState([]);
  const [runMetrics,   setRunMetrics]   = useState(null);

  // ── Step 3: preview ──────────────────────────────────────────────────────

  const [activeStep,   setActiveStep]   = useState('input');
  const [doneSteps,    setDoneSteps]    = useState([]);
  const [finalMatches, setFinalMatches] = useState(null);

  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [customPlaylistId, setCustomPlaylistId] = useState('');
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [exactTrackIds, setExactTrackIds] = useState([]);
  const [nearDuplicateTrackIds, setNearDuplicateTrackIds] = useState({});
  const [importReport, setImportReport] = useState(null);
  const [commitState, setCommitState] = useState('idle');
  const [existingTrackIds, setExistingTrackIds] = useState(new Set());
  const [deduplicateEnabled, setDeduplicateEnabled] = useState(true);

  // ── full reset, used by both StepBreadcrumb's onReset and the old
  //    "← re-paste" button — same logic as the existing reset handlers ──
  const resetToInput = useCallback(() => {
    setActiveStep('input');
    setDoneSteps([]);
    setExtractState('idle');
    setSongs([]);
    setSuggestedName('');
    setSuggestedDesc('');
    setPendingMatches(null);
    setResolveState('idle');
    setResolveResults([]);
  }, []);

  // ...useEffect(loadPlaylists), handleResolveAll, handleManualSearch,
  // enterPreview, handleConfirm, handleRetryFailed, derived counts —
  // all stay exactly as they are in importPipeline.jsx, unchanged.

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="import-page">
      <TopNav displayName={profile?.display_name} onLogout={onLogout} />

      <div className="import-page__inner">
        <StepBreadcrumb
          current={activeStep}
          done={doneSteps}
          onReset={resetToInput}
        />

        {activeStep === 'input' && (
          <Step1Input
            onExtracted={(rawText, result) => {
              setRawInput(rawText);
              const { songs: extracted, playlistName, playlistDescription } = result;
              const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
              const withRaw = extracted.map((song, i) => ({ ...song, rawText: lines[i] ?? rawText }));
              setSongs(withRaw);
              setSuggestedName(playlistName || '');
              setSuggestedDesc(playlistDescription || '');
              setExtractState('done');
              setActiveStep('resolve');
              setDoneSteps(['input']);
            }}
          />
        )}

        {/* existing resolve / preview / report sections from importPipeline.jsx
            stay unchanged here — just moved under import-page__inner */}
      </div>
    </div>
  );
}