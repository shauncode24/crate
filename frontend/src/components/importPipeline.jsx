/**
 * importPipeline.jsx — Phase 9: Full import pipeline
 *
 * Sequential flow:
 *   Step 1 — Paste songs, AI extracts them (LLM → [{title, artist}])
 *   Step 2 — Batch resolve against Spotify with rate-limit handling
 *   Step 3 — Dry-run preview: review ambiguous matches, confirm to commit
 *
 * This is the "real" end-to-end experience. The Resolver playground
 * (resolver tab) still exists as a developer scratchpad. This tab is what
 * a real user would see.
 *
 * Props:
 *   isLoggedIn  — from App auth state
 */

import { useState, useCallback, useEffect } from 'react';
import { extractSongs }          from '../extraction/extract.js';
import { getValidAccessToken }   from '../auth/spotifyAuth.js';
import DryRunPreview             from './dryRunPreview.jsx';
import { resolveSongs, resolveSongsStream } from '../api/resolveApi.js';
import './importPipeline.css';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

async function fetchPlaylistTracks(playlistId, token) {
  let tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=next,items(track(id,name,artists(name)))&limit=100`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch playlist tracks: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.items) {
      for (const item of data.items) {
        if (item.track) {
          tracks.push({
            id: item.track.id,
            title: item.track.name,
            artist: item.track.artists?.[0]?.name ?? ''
          });
        }
      }
    }
    url = data.next;
  }
  return tracks;
}

// ── Pipeline step IDs ────────────────────────────────────────────────────────

const STEPS = [
  { id: 'input',   label: 'Paste songs'    },
  { id: 'resolve', label: 'Spotify search' },
  { id: 'preview', label: 'Review & confirm' },
  { id: 'report',  label: 'Import report'  },
];

// ── Step breadcrumb ───────────────────────────────────────────────────────────

function StepNav({ current, done }) {
  const doneSet = new Set(done);
  return (
    <nav className="ip-steps" aria-label="Import steps">
      {STEPS.map((step, i) => {
        const isDone   = doneSet.has(step.id);
        const isActive = step.id === current;
        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <span className="ip-step-sep" aria-hidden="true">›</span>}
            <div
              className={`ip-step ${isActive ? 'ip-step--active' : ''} ${isDone ? 'ip-step--done' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="ip-step__num">{isDone ? '✓' : i + 1}</span>
              {step.label}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// ── Main pipeline component ───────────────────────────────────────────────────

export default function ImportPipeline({ isLoggedIn }) {
  // ── Step 1: extraction ───────────────────────────────────────────────────

  const [rawInput,     setRawInput]     = useState('');
  const [songs,        setSongs]        = useState([]);   // [{title, artist, rawText}]
  const [extractState, setExtractState] = useState('idle'); // idle | loading | done | error
  const [extractError, setExtractError] = useState(null);

  // ── Step 2: resolution ───────────────────────────────────────────────────

  const [resolveState,   setResolveState]   = useState('idle'); // idle | running | done | error
  const [resolveError,   setResolveError]   = useState(null);
  const [resolveResults, setResolveResults] = useState([]);     // ResolvedMatch[]
  const [batchProgress,  setBatchProgress]  = useState({ completed: 0, total: 0 });
  const [retryNotice,    setRetryNotice]    = useState(null);

  // ── Step 3: preview ──────────────────────────────────────────────────────

  const [activeStep,   setActiveStep]   = useState('input');
  const [doneSteps,    setDoneSteps]    = useState([]);
  const [finalMatches, setFinalMatches] = useState(null);

  // Playlist selection & duplicate detection
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [customPlaylistId, setCustomPlaylistId] = useState('');
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [exactTrackIds, setExactTrackIds] = useState([]);
  const [nearDuplicateTrackIds, setNearDuplicateTrackIds] = useState({});
  const [succeededUris, setSucceededUris] = useState([]);
  const [failedUris, setFailedUris] = useState([]);
  const [commitState, setCommitState] = useState('idle');
  const [existingTrackIds, setExistingTrackIds] = useState(new Set());
  const [deduplicateEnabled, setDeduplicateEnabled] = useState(true);

  // Fetch user playlists when resolution completes
  useEffect(() => {
    async function loadPlaylists() {
      if (!isLoggedIn) return;
      setLoadingPlaylists(true);
      try {
        const token = await getValidAccessToken();
        const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPlaylists(data.items ?? []);
        }
      } catch (err) {
        console.error('Failed to load playlists:', err);
      } finally {
        setLoadingPlaylists(false);
      }
    }
    if (activeStep === 'resolve' && resolveState === 'done') {
      loadPlaylists();
    }
  }, [activeStep, resolveState, isLoggedIn]);

  // ── Step 1 handler ────────────────────────────────────────────────────────

  const handleExtract = useCallback(async () => {
    if (!rawInput.trim() || extractState === 'loading') return;

    setExtractState('loading');
    setExtractError(null);
    setSongs([]);
    setResolveState('idle');
    setResolveResults([]);
    setDoneSteps([]);

    try {
      const extracted = await extractSongs(rawInput);
      const lines = rawInput.split('\n').map((l) => l.trim()).filter(Boolean);
      const withRaw = extracted.map((song, i) => ({
        ...song,
        rawText: lines[i] ?? rawInput,
      }));
      setSongs(withRaw);
      setExtractState('done');
      setActiveStep('resolve');
      setDoneSteps(['input']);
    } catch (err) {
      setExtractError(err.message);
      setExtractState('error');
    }
  }, [rawInput, extractState]);

  // ── Step 2 handler ────────────────────────────────────────────────────────

  const handleResolveAll = useCallback(async () => {
    if (!isLoggedIn) {
      setResolveError('Log in with Spotify (nav bar) to search.');
      return;
    }
    if (songs.length === 0) return;

    setResolveState('running');
    setResolveError(null);
    setRetryNotice(null);
    setBatchProgress({ completed: 0, total: songs.length });
    setResolveResults([]);

    try {
      const token = await getValidAccessToken();
      const results = new Array(songs.length).fill(null);

      await resolveSongsStream(
        songs,
        token,
        (event) => {
          if (event.type === 'progress') {
            setBatchProgress({ completed: event.completed, total: event.total });
          }
          if (event.type === 'retry') {
            setRetryNotice(event);
            setTimeout(() => {
              setRetryNotice((cur) => (cur === event ? null : cur));
            }, event.waitSeconds * 1000);
          }
          if (event.type === 'result') {
            results[event.index] = event.result;
            // Incremental update so the progress is visible
            setResolveResults([...results]);
          }
          if (event.type === 'done') {
            setResolveResults(event.results);
          }
        },
        null, // no 429 simulation in the import pipeline
      );

      setResolveState('done');
      setDoneSteps((prev) => [...prev.filter((s) => s !== 'resolve'), 'resolve']);
    } catch (err) {
      setResolveError(err.message);
      setResolveState('error');
    }
  }, [songs, isLoggedIn]);

    const handleManualSearch = useCallback(async (originalIndex, correctedText) => {
    if (!isLoggedIn) throw new Error('Log in with Spotify (nav bar) to search.');
    const text = correctedText.trim();
    if (!text) throw new Error('Enter a search term first.');
    const token = await getValidAccessToken();
    const { results } = await resolveSongs([{ title: text, artist: null, rawText: text }], token);
    return results[0];
    }, [isLoggedIn]);

  // ── Step 3: enter preview ─────────────────────────────────────────────────

  async function enterPreview() {
    const playlistId = selectedPlaylistId === 'custom' ? customPlaylistId : selectedPlaylistId;
    if (!playlistId) {
      setExactTrackIds([]);
      setNearDuplicateTrackIds({});
      setExistingTrackIds(new Set());
      setActiveStep('preview');
      setDoneSteps((prev) => [...new Set([...prev, 'resolve'])]);
      return;
    }

    if (!deduplicateEnabled) {
      setExactTrackIds([]);
      setNearDuplicateTrackIds({});
      setExistingTrackIds(new Set());
      setActiveStep('preview');
      setDoneSteps((prev) => [...new Set([...prev, 'resolve'])]);
      return;
    }

    setCheckingDuplicates(true);
    try {
      const token = await getValidAccessToken();
      const existingTracks = await fetchPlaylistTracks(playlistId, token);

      const res = await fetch(`${API_BASE}/api/resolve/check-duplicates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          resolvedMatches: resolveResults,
          existingTracks: existingTracks
        })
      });
      if (!res.ok) throw new Error('Duplicate check failed.');

      const dupData = await res.json();
      setExactTrackIds(dupData.exactTrackIds ?? []);
      setNearDuplicateTrackIds(dupData.nearDuplicateTrackIds ?? {});

      const exactSet = new Set(dupData.exact);
      const nearMap = new Map(Object.entries(dupData.nearDuplicate).map(([k, v]) => [Number(k), v]));

      setResolveResults((prev) =>
        prev.map((match, i) => {
          if (!match) return null;
          if (exactSet.has(i)) {
            return {
              ...match,
              isDuplicate: true,
              duplicateReason: 'exact'
            };
          }
          if (nearMap.has(i)) {
            return {
              ...match,
              duplicateWarning: `Already in playlist as "${nearMap.get(i)}"`
            };
          }
          return match;
        })
      );
      setExistingTrackIds(new Set(existingTracks.map(t => t.id).filter(Boolean)));
    } catch (err) {
      console.error("Duplicate check error:", err);
      setExactTrackIds([]);
      setNearDuplicateTrackIds({});
    } finally {
      setCheckingDuplicates(false);
      setActiveStep('preview');
      setDoneSteps((prev) => [...new Set([...prev, 'resolve'])]);
    }
  }

  // ── Step 3: confirm ───────────────────────────────────────────────────────

  async function handleConfirm(matches) {
    setFinalMatches(matches);
    setDoneSteps((prev) => [...new Set([...prev, 'preview'])]);
    setCommitState('running');
    setActiveStep('report');

    const activeMatches = (matches ?? []).filter(
      (m) => m && m.status !== 'skipped' && m.chosen && m.chosen.id
    );

    // Idempotency: filter out tracks that are already in the target playlist
    const tracksToCommit = activeMatches.filter((m) => !existingTrackIds.has(m.chosen.id));

    if (tracksToCommit.length === 0) {
      setCommitState('done');
      setSucceededUris([]);
      setFailedUris([]);
      return;
    }

    const commitItems = tracksToCommit.map((m) => ({
      uri: m.chosen.uri || `spotify:track:${m.chosen.id}`,
      title: m.chosen.title,
      artist: m.chosen.artists || m.chosen.artist || 'Unknown Artist',
    }));

    try {
      const token = await getValidAccessToken();
      let playlistId = selectedPlaylistId === 'custom' ? customPlaylistId : selectedPlaylistId;
      
      // Dynamic playlist creation if no target playlist is selected
      if (!playlistId) {
        const userRes = await fetch("https://api.spotify.com/v1/me", {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!userRes.ok) throw new Error("Could not retrieve Spotify profile to create a new playlist.");
        const userData = await userRes.json();
        const userId = userData.id;

        const dateStr = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
        const plRes = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: `Crate Import — ${dateStr}`,
            description: 'Imported via Crate',
            public: false
          })
        });
        if (!plRes.ok) throw new Error("Failed to create new playlist on Spotify.");
        const plData = await plRes.json();
        playlistId = plData.id;
        
        // Persist the new playlist ID in state so the report link and retry operations target it correctly
        setSelectedPlaylistId(playlistId);
      }

      const uris = commitItems.map((item) => item.uri);
      const result = await import('../api/resolveApi.js').then((m) =>
        m.commitToPlaylist(token, playlistId, uris)
      );

      const newlySucceeded = [];
      const newlyFailed = [];
      const chunkSize = 100;

      result.succeededChunks.forEach((idx) => {
        newlySucceeded.push(...commitItems.slice(idx * chunkSize, idx * chunkSize + chunkSize));
      });

      result.failedChunks.forEach((f) => {
        const chunkItems = commitItems.slice(f.index * chunkSize, f.index * chunkSize + chunkSize);
        newlyFailed.push(...chunkItems.map((item) => ({ ...item, error: f.error })));
      });

      setSucceededUris(newlySucceeded);
      setFailedUris(newlyFailed);
      setCommitState('done');
    } catch (err) {
      console.error('Commit failed:', err);
      setFailedUris(
        commitItems.map((item) => ({
          ...item,
          error: err.message || 'Verification or network error',
        }))
      );
      setCommitState('done');
    }
  }

  async function handleRetryFailed() {
    if (failedUris.length === 0) return;
    setCommitState('running');

    const retryItems = [...failedUris];
    const uris = retryItems.map((item) => item.uri);
    const chunkSize = 100;

    try {
      const token = await getValidAccessToken();
      const playlistId = selectedPlaylistId === 'custom' ? customPlaylistId : selectedPlaylistId;

      const result = await import('../api/resolveApi.js').then((m) =>
        m.commitToPlaylist(token, playlistId, uris)
      );

      const newlySucceeded = [];
      const newlyFailed = [];

      result.succeededChunks.forEach((idx) => {
        newlySucceeded.push(...retryItems.slice(idx * chunkSize, idx * chunkSize + chunkSize));
      });

      result.failedChunks.forEach((f) => {
        const chunkItems = retryItems.slice(f.index * chunkSize, f.index * chunkSize + chunkSize);
        newlyFailed.push(...chunkItems.map((item) => ({ ...item, error: f.error })));
      });

      setSucceededUris((prev) => [...prev, ...newlySucceeded]);
      setFailedUris(newlyFailed);
      setCommitState('done');
    } catch (err) {
      console.error('Retry failed:', err);
      setCommitState('done');
      setFailedUris((prev) =>
        prev.map((item) => ({
          ...item,
          error: err.message || 'Retry verification or network error',
        }))
      );
    }
  }

  // ── Derived counts ─────────────────────────────────────────────────────────

  const resolvedCount  = resolveResults.filter(Boolean).length;
  const batchPct       = batchProgress.total
    ? Math.round((batchProgress.completed / batchProgress.total) * 100)
    : 0;

  const autoCount      = resolveResults.filter((r) => r?.status === 'auto').length;
  const reviewCount    = resolveResults.filter((r) => r?.status === 'review').length;
  const missingCount   = resolveResults.filter((r) => r?.status === 'notfound').length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ip">
      <header className="ip-header">
        <h1>Import playlist</h1>
        <p className="ip-subtitle">paste → extract → match → review → confirm</p>
      </header>

      <StepNav current={activeStep} done={doneSteps} />

      {/* ── Step 1: paste & extract ── */}
      {activeStep === 'input' && (
        <section className="ip-input-section">
          <span className="ip-input-label">Paste your song list</span>
          <div className="ip-input-row">
            <textarea
              className="ip-textarea"
              value={rawInput}
              onChange={(e) => {
                setRawInput(e.target.value);
                if (extractState !== 'idle') {
                  setExtractState('idle');
                  setExtractError(null);
                  setSongs([]);
                }
              }}
              placeholder={
                'Paste anything — numbered lists, bullet points, prose:\n\n' +
                '1. Snowfall - Øneheart\n' +
                '2. Painted Skies - Elaine\n' +
                'been obsessed with Stick Season by Noah Kahan'
              }
              spellCheck={false}
            />
            <button
              className="ip-extract-btn"
              onClick={handleExtract}
              disabled={extractState === 'loading' || !rawInput.trim()}
            >
              {extractState === 'loading' ? 'Extracting…' : 'Extract songs →'}
            </button>
          </div>
          {extractState === 'error' && (
            <p className="ip-extract-error">{extractError}</p>
          )}
        </section>
      )}

      {/* ── Extracted songs preview (shown while on resolve step) ── */}
      {activeStep === 'resolve' && songs.length > 0 && (
        <div className="ip-extracted-list">
          <div className="ip-extracted-header">
            <span className="ip-extracted-label">Extracted songs</span>
            <span className="ip-extracted-count">{songs.length} found</span>
            <button
              style={{
                font: '11px/1 var(--mono)',
                background: 'none',
                border: 'none',
                color: 'var(--text)',
                opacity: 0.5,
                cursor: 'pointer',
                padding: '0',
                textDecoration: 'underline',
              }}
              onClick={() => {
                setActiveStep('input');
                setDoneSteps([]);
                setExtractState('idle');
                setSongs([]);
                setResolveState('idle');
                setResolveResults([]);
              }}
            >
              ← re-paste
            </button>
          </div>
          <div className="ip-song-chips">
            {songs.map((s, i) => (
              <div key={i} className="ip-song-chip">
                {s.title}
                {s.artist && <span className="ip-song-chip__artist">— {s.artist}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: resolve ── */}
      {activeStep === 'resolve' && (
        <section className="ip-resolve-section">
          <div className="ip-resolve-header">
            <span className="ip-resolve-label">Spotify search</span>
            {resolveState === 'idle' && (
              <button
                className="ip-resolve-btn"
                onClick={handleResolveAll}
                disabled={!isLoggedIn}
              >
                Search Spotify →
              </button>
            )}
            {resolveState === 'running' && (
              <span className="ip-progress-label">
                {batchProgress.completed}/{batchProgress.total} resolved…
              </span>
            )}
          </div>

          {!isLoggedIn && (
            <p className="ip-login-hint">Log in with Spotify (nav bar) to enable search.</p>
          )}

          {resolveState === 'running' && (
            <div>
              <div className="ip-progress-track">
                <div className="ip-progress-fill" style={{ width: `${batchPct}%` }} />
              </div>
            </div>
          )}

          {retryNotice && (
            <p className="ip-retry-banner">
              ⏳ Rate-limited on "{retryNotice.title}" — retrying in {retryNotice.waitSeconds}s
            </p>
          )}

          {resolveState === 'error' && (
            <p className="ip-resolve-error">{resolveError}</p>
          )}

          {resolveState === 'done' && (
            <>
              <div className="ip-playlist-selector" style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                  Target Spotify Playlist:
                </label>
                {loadingPlaylists ? (
                  <div style={{ color: 'var(--text-muted)' }}>Loading your playlists...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px' }}>
                    <select
                      style={{
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--input-bg)',
                        color: 'var(--text)',
                        width: '100%',
                      }}
                      value={selectedPlaylistId}
                      onChange={(e) => setSelectedPlaylistId(e.target.value)}
                    >
                      <option value="">-- No target playlist (optional) --</option>
                      <option value="custom">-- Enter Playlist ID manually --</option>
                      {playlists.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name} ({pl.tracks?.total ?? 0} tracks)
                        </option>
                      ))}
                    </select>

                    {selectedPlaylistId === 'custom' && (
                      <input
                        type="text"
                        placeholder="Paste Spotify Playlist ID here"
                        style={{
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border)',
                          background: 'var(--input-bg)',
                          color: 'var(--text)',
                          width: '100%',
                        }}
                        value={customPlaylistId}
                        onChange={(e) => setCustomPlaylistId(e.target.value.trim())}
                      />
                    )}
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginTop: '6px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      <input
                        type="checkbox"
                        checked={deduplicateEnabled}
                        onChange={(e) => setDeduplicateEnabled(e.target.checked)}
                      />
                      Check playlist for duplicates before importing
                    </label>
                  </div>
                )}
              </div>

              <div className="ip-resolve-done-row" style={{ marginTop: '16px' }}>
                <span className="ip-resolve-done-summary">
                  <strong>{autoCount}</strong> auto · {reviewCount} need review · {missingCount} not found
                </span>
                <button
                  className="ip-preview-btn"
                  onClick={enterPreview}
                  disabled={checkingDuplicates || (selectedPlaylistId === 'custom' && !customPlaylistId)}
                >
                  {checkingDuplicates ? 'Checking duplicates...' : 'Review & confirm →'}
                </button>
              </div>
            </>
          )}

          {(resolveState === 'running' || resolveState === 'done') && resolveResults.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {resolveResults.map((r, i) => (
                r && (
                  <span
                    key={i}
                    style={{
                      font: '11px/1 var(--mono)',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      border: '1px solid var(--border)',
                      background: r.status === 'auto'
                        ? 'rgba(34,197,94,0.1)'
                        : r.status === 'review'
                        ? 'rgba(245,158,11,0.1)'
                        : 'var(--code-bg)',
                      color: r.status === 'auto'
                        ? '#16a34a'
                        : r.status === 'review'
                        ? '#b45309'
                        : 'var(--text)',
                    }}
                    title={r.parsedSong?.title}
                  >
                    {r.status === 'auto' ? '✓' : r.status === 'review' ? '⚠' : '✗'}{' '}
                    {r.parsedSong?.title?.slice(0, 20) ?? `#${i + 1}`}
                  </span>
                )
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Step 3: dry-run preview ── */}
      {activeStep === 'preview' && (
        <DryRunPreview
          resolvedMatches={resolveResults}
          onConfirm={handleConfirm}
          onManualSearch={handleManualSearch}
          onBack={() => {
            setActiveStep('resolve');
            setDoneSteps((prev) => prev.filter((s) => s !== 'preview'));
          }}
          exactTrackIds={exactTrackIds}
          nearDuplicateTrackIds={nearDuplicateTrackIds}
          hasPlaylist={Boolean(selectedPlaylistId === 'custom' ? customPlaylistId : selectedPlaylistId)}
        />
      )}

      {/* ── Step 4: Import report ── */}
      {activeStep === 'report' && (
        <section className="ip-report-section" style={{ padding: '24px 0' }}>
          {commitState === 'running' ? (
            <div className="ip-commit-loading" style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', maxWidth: '600px', margin: '0 auto' }}>
              <div className="spinner" style={{ marginBottom: '16px', fontSize: '32px', animation: 'spin 2s linear infinite' }}>⏳</div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Adding songs to Spotify...</h2>
              <p style={{ color: 'var(--text-muted)', margin: '0' }}>Please don't close or refresh this page.</p>
            </div>
          ) : (
            <ImportReport
              succeeded={succeededUris}
              failed={failedUris}
              playlistId={selectedPlaylistId === 'custom' ? customPlaylistId : selectedPlaylistId}
              onRetry={handleRetryFailed}
              onReset={() => {
                setActiveStep('input');
                setDoneSteps([]);
                setExtractState('idle');
                setSongs([]);
                setResolveState('idle');
                setResolveResults([]);
                setSucceededUris([]);
                setFailedUris([]);
              }}
            />
          )}
        </section>
      )}
    </div>
  );
}

function ImportReport({ succeeded, failed, playlistId, onRetry, onReset }) {
  const hasFailures = failed.length > 0;
  const playlistUrl = playlistId ? `https://open.spotify.com/playlist/${playlistId}` : null;

  return (
    <div className="ip-report">
      <div className="ip-report__card" style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '600px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>
            {hasFailures ? '⚠' : '✓'}
          </span>
          <h2 style={{ fontSize: '24px', margin: '0 0 8px 0', color: hasFailures ? 'var(--text)' : '#16a34a' }}>
            {hasFailures ? 'Import completed with warnings' : 'Import successful!'}
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '0' }}>
            {succeeded.length} song{succeeded.length !== 1 ? 's' : ''} added to your playlist.
          </p>
        </div>

        {playlistUrl && succeeded.length > 0 && (
          <a
            href={playlistUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ip-preview-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              textAlign: 'center',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            Open playlist on Spotify ↗
          </a>
        )}

        {hasFailures && (
          <div style={{
            border: '1px solid rgba(239, 68, 68, 0.2)',
            background: 'rgba(239, 68, 68, 0.05)',
            borderRadius: '6px',
            padding: '16px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#ef4444' }}>
              Failed Tracks ({failed.length})
            </h3>
            <ul style={{
              margin: '0',
              padding: '0 0 0 20px',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              color: 'var(--text)',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {failed.map((f, i) => (
                <li key={i}>
                  <strong>{f.title}</strong> {f.artist && `— ${f.artist}`}
                  <div style={{ fontSize: '11px', color: '#ef4444', fontStyle: 'italic', marginTop: '2px' }}>
                    Reason: {f.error}
                  </div>
                </li>
              ))}
            </ul>
            <button
              onClick={onRetry}
              className="ip-preview-btn"
              style={{
                marginTop: '16px',
                background: '#ef4444',
                borderColor: '#ef4444',
                color: '#fff',
                width: '100%',
                cursor: 'pointer'
              }}
            >
              Retry Failed Chunks
            </button>
          </div>
        )}

        <button
          onClick={onReset}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text)',
            padding: '10px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            width: '100%'
          }}
        >
          Import another list
        </button>
      </div>
    </div>
  );
}