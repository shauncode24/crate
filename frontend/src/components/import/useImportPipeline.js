import { useState, useCallback, useEffect } from 'react';
import { getValidAccessToken } from '../../auth/spotifyAuth.js';
import { resolveSongsStream, commitToPlaylist, buildImportReport, summarizeRun, resolveSongs } from '../../api/resolveApi.js';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

async function fetchPlaylistTracks(playlistId, token) {
  let tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=next,items(track(id,name,artists(name)))&limit=100`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Failed to fetch playlist tracks: ${res.statusText}`);
    const data = await res.json();
    for (const item of (data.items ?? [])) {
      if (item.track) tracks.push({ id: item.track.id, title: item.track.name, artist: item.track.artists?.[0]?.name ?? '' });
    }
    url = data.next;
  }
  return tracks;
}

export function useImportPipeline({ isLoggedIn }) {
  // ── Step 1: extracted songs ───────────────────────────────────────────────
  const [songs, setSongs] = useState([]);
  const [suggestedName, setSuggestedName] = useState('');
  const [suggestedDesc, setSuggestedDesc] = useState('');

  // ── Step 2: resolution ────────────────────────────────────────────────────
  const [resolveState, setResolveState] = useState('idle');
  const [resolveError, setResolveError] = useState(null);
  const [resolveResults, setResolveResults] = useState([]);
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0 });
  const [retryNotice, setRetryNotice] = useState(null);
  const [sessionLogs, setSessionLogs] = useState([]);
  const [runMetrics, setRunMetrics] = useState(null);

  // ── Step 2: playlist selection ────────────────────────────────────────────
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [customPlaylistId, setCustomPlaylistId] = useState('');
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [deduplicateEnabled, setDeduplicateEnabled] = useState(true);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // ── Step 3: preview ───────────────────────────────────────────────────────
  const [pendingMatches, setPendingMatches] = useState(null);
  const [exactTrackIds, setExactTrackIds] = useState([]);
  const [nearDuplicateTrackIds, setNearDuplicateTrackIds] = useState({});
  const [existingTrackIds, setExistingTrackIds] = useState(new Set());

  // ── Step 4: report ────────────────────────────────────────────────────────
  const [importReport, setImportReport] = useState(null);
  const [commitState, setCommitState] = useState('idle');

  // ── Nav ───────────────────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState('input');
  const [doneSteps, setDoneSteps] = useState([]);

  // ── Full reset ────────────────────────────────────────────────────────────
  const resetToInput = useCallback(() => {
    setActiveStep('input');
    setDoneSteps([]);
    setSongs([]);
    setSuggestedName('');
    setSuggestedDesc('');
    setPendingMatches(null);
    setResolveState('idle');
    setResolveResults([]);
    setImportReport(null);
    setSessionLogs([]);
    setRunMetrics(null);
    setExactTrackIds([]);
    setNearDuplicateTrackIds({});
    setExistingTrackIds(new Set());
  }, []);

  // ── Load playlists when resolution completes ──────────────────────────────
  useEffect(() => {
    if (activeStep !== 'resolve' || resolveState !== 'done') return;
    async function load() {
      if (!isLoggedIn) return;
      setLoadingPlaylists(true);
      try {
        const token = await getValidAccessToken();
        const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setPlaylists((await res.json()).items ?? []);
      } catch (err) { console.error('Failed to load playlists:', err); }
      finally { setLoadingPlaylists(false); }
    }
    load();
  }, [activeStep, resolveState, isLoggedIn]);

  // ── Handler: Step1 extracted ──────────────────────────────────────────────
  const handleExtracted = useCallback((rawText, result) => {
    const { songs: extracted, playlistName, playlistDescription } = result;
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    setSongs(extracted.map((song, i) => ({ ...song, rawText: lines[i] ?? rawText })));
    setSuggestedName(playlistName || '');
    setSuggestedDesc(playlistDescription || '');
    setResolveState('idle');
    setResolveResults([]);
    setActiveStep('resolve');
    setDoneSteps(['input']);
  }, []);

  // ── Handler: Step2 resolve all ────────────────────────────────────────────
  const handleResolveAll = useCallback(async () => {
    if (!isLoggedIn) { setResolveError('Log in with Spotify to search.'); return; }
    if (songs.length === 0) return;

    setResolveState('running');
    setResolveError(null);
    setRetryNotice(null);
    setBatchProgress({ completed: 0, total: songs.length });
    setResolveResults([]);
    setSessionLogs([]);
    setRunMetrics(null);

    const collectedLogs = [];
    let totalRetries = 0;

    try {
      const token = await getValidAccessToken();
      const results = new Array(songs.length).fill(null);

      await resolveSongsStream(songs, token, (event) => {
        if (event.type === 'progress') setBatchProgress({ completed: event.completed, total: event.total });
        if (event.type === 'retry') {
          totalRetries += 1;
          setRetryNotice(event);
          setTimeout(() => setRetryNotice(cur => cur === event ? null : cur), event.waitSeconds * 1000);
        }
        if (event.type === 'result') {
          const r = event.result;
          results[event.index] = r;
          if (r) collectedLogs[event.index] = {
            rawText:           r.parsedSong?.rawText ?? r.parsedSong?.title ?? '',
            queryRung:         r.queryRung ?? (r.fromCache ? 'cache' : 'search'),
            topCandidateScore: r.chosen?.score?.final ?? (r.topCandidates?.[0]?.score?.final ?? 0),
            cacheHit:          Boolean(r.fromCache),
            latencyMs:         r.latencyMs ?? 0,
          };
          setResolveResults([...results]);
        }
        if (event.type === 'done') setResolveResults(event.results);
      }, null);

      const logs = collectedLogs.filter(Boolean);
      setSessionLogs(logs);
      setRunMetrics(summarizeRun(logs, songs, totalRetries));
      setResolveState('done');
      setDoneSteps(prev => [...prev.filter(s => s !== 'resolve'), 'resolve']);
    } catch (err) {
      setResolveError(err.message);
      setResolveState('error');
    }
  }, [songs, isLoggedIn]);

  // ── Handler: Step2 manual search ──────────────────────────────────────────
  const handleManualSearch = useCallback(async (originalIndex, correctedText) => {
    if (!isLoggedIn) throw new Error('Log in with Spotify to search.');
    const text = correctedText.trim();
    if (!text) throw new Error('Enter a search term first.');
    const token = await getValidAccessToken();
    const { results } = await resolveSongs([{ title: text, artist: null, rawText: text }], token);
    return results[0];
  }, [isLoggedIn]);

  // ── Handler: Step2 → Step3 transition (runs duplicate check) ─────────────
  const enterPreview = useCallback(async () => {
    const playlistId = selectedPlaylistId === 'custom' ? customPlaylistId : selectedPlaylistId;

    if (!playlistId || !deduplicateEnabled) {
      setExactTrackIds([]);
      setNearDuplicateTrackIds({});
      setExistingTrackIds(new Set());
      setActiveStep('preview');
      setDoneSteps(prev => [...new Set([...prev, 'resolve'])]);
      return;
    }

    setCheckingDuplicates(true);
    try {
      const token = await getValidAccessToken();
      const existingTracks = await fetchPlaylistTracks(playlistId, token);
      const res = await fetch(`${API_BASE}/api/resolve/check-duplicates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resolvedMatches: resolveResults, existingTracks }),
      });
      if (!res.ok) throw new Error('Duplicate check failed.');
      const dupData = await res.json();
      setExactTrackIds(dupData.exactTrackIds ?? []);
      setNearDuplicateTrackIds(dupData.nearDuplicateTrackIds ?? {});
      const exactSet = new Set(dupData.exact);
      const nearMap  = new Map(Object.entries(dupData.nearDuplicate).map(([k, v]) => [Number(k), v]));
      setResolveResults(prev => prev.map((m, i) => {
        if (!m) return null;
        if (exactSet.has(i)) return { ...m, isDuplicate: true, duplicateReason: 'exact' };
        if (nearMap.has(i)) return { ...m, duplicateWarning: `Already in playlist as "${nearMap.get(i)}"` };
        return m;
      }));
      setExistingTrackIds(new Set(existingTracks.map(t => t.id).filter(Boolean)));
    } catch (err) {
      console.error('Duplicate check error:', err);
      setExactTrackIds([]);
      setNearDuplicateTrackIds({});
    } finally {
      setCheckingDuplicates(false);
      setActiveStep('preview');
      setDoneSteps(prev => [...new Set([...prev, 'resolve'])]);
    }
  }, [selectedPlaylistId, customPlaylistId, deduplicateEnabled, resolveResults]);

  // ── Handler: Step3 finalize import (Spotify write) ────────────────────────
  const handleConfirm = useCallback(async (matches) => {
    setDoneSteps(prev => [...new Set([...prev, 'preview'])]);
    setCommitState('running');
    setActiveStep('report');

    const activeMatches  = (matches ?? []).filter(m => m && m.status !== 'skipped' && m.chosen?.id);
    const tracksToCommit = activeMatches.filter(m => !existingTrackIds.has(m.chosen.id));
    const duplicateInfo  = { exactTrackIds, nearDuplicateTrackIds };

    if (tracksToCommit.length === 0) {
      setImportReport(buildImportReport(matches, duplicateInfo, { succeededChunks: [], failedChunks: [] }));
      setCommitState('done');
      return;
    }

    const commitItems = tracksToCommit.map(m => ({
      ...m.chosen,
      uri:    m.chosen.uri || `spotify:track:${m.chosen.id}`,
      title:  m.chosen.title,
      artist: m.chosen.artists || m.chosen.artist || 'Unknown Artist',
    }));

    try {
      const token = await getValidAccessToken();
      let playlistId = selectedPlaylistId === 'custom' ? customPlaylistId : selectedPlaylistId;

      if (!playlistId) {
        const userRes = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!userRes.ok) throw new Error('Could not retrieve Spotify profile.');
        const { id: userId } = await userRes.json();
        const finalName = suggestedName.trim() || `Crate Import — ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
        const finalDesc = suggestedDesc.trim() || 'Imported via Crate';
        const plRes = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: finalName, description: finalDesc, public: false }),
        });
        if (!plRes.ok) throw new Error('Failed to create new playlist on Spotify.');
        const plData = await plRes.json();
        playlistId = plData.id;
        setSelectedPlaylistId(playlistId);
      }

      const uris = commitItems.map(item => item.uri);
      const result = await commitToPlaylist(token, playlistId, uris);
      setImportReport(buildImportReport(matches, duplicateInfo, result));
      setCommitState('done');
    } catch (err) {
      console.error('Commit failed:', err);
      const totalChunks = Math.ceil(commitItems.length / 100);
      setImportReport(buildImportReport(matches, duplicateInfo, {
        succeededChunks: [],
        failedChunks: Array.from({ length: totalChunks }, (_, c) => ({ index: c, error: err.message || 'Network error' })),
      }));
      setCommitState('done');
    }
  }, [existingTrackIds, exactTrackIds, nearDuplicateTrackIds, selectedPlaylistId, customPlaylistId, suggestedName, suggestedDesc]);

  // ── Handler: Step4 retry failed chunks ───────────────────────────────────
  const handleRetryFailed = useCallback(async () => {
    if (!importReport || importReport.failed.length === 0) return;
    setCommitState('running');
    const retryItems = [...importReport.failed];
    const uris = retryItems.map(item => item.uri);
    const chunkSize = 100;
    try {
      const token = await getValidAccessToken();
      const playlistId = selectedPlaylistId === 'custom' ? customPlaylistId : selectedPlaylistId;
      const result = await commitToPlaylist(token, playlistId, uris);
      const newlySucceeded = result.succeededChunks.flatMap(idx => retryItems.slice(idx * chunkSize, idx * chunkSize + chunkSize));
      const newlyFailed    = result.failedChunks.flatMap(f => retryItems.slice(f.index * chunkSize, f.index * chunkSize + chunkSize).map(item => ({ ...item, error: f.error })));
      setImportReport(prev => !prev ? null : {
        ...prev,
        added:  [...prev.added, ...newlySucceeded],
        failed: newlyFailed,
        counts: { ...prev.counts, added: prev.added.length + newlySucceeded.length, failed: newlyFailed.length },
      });
    } catch (err) {
      console.error('Retry failed:', err);
      setImportReport(prev => !prev ? null : { ...prev, failed: prev.failed.map(item => ({ ...item, error: err.message || 'Retry error' })) });
    } finally {
      setCommitState('done');
    }
  }, [importReport, selectedPlaylistId, customPlaylistId]);

  const resolvedPlaylistId = selectedPlaylistId === 'custom' ? customPlaylistId : selectedPlaylistId;

  return {
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
  };
}
