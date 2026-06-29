import { useState, useCallback, useEffect } from 'react';
import { extractSongs }       from '../extraction/extract.js';
import { getValidAccessToken } from '../auth/spotifyAuth.js';
import { resolveSongs, getCacheState, clearCache } from '../api/resolveApi.js';
import { AUTO_ACCEPT_THRESHOLD, REVIEW_FLOOR } from '../config/matchConfig.js';
import './resolverPlayground.css';

// ── Formatting helpers ───────────────────────────────────────────────────────

function ms(durationMs) {
  const m = Math.floor(durationMs / 60000);
  const s = String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0');
  return `${m}:${s}`;
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ── Shared badges ────────────────────────────────────────────────────────────

const RUNG_LABELS = {
  'field-qualified': { short: 'field', title: 'track:"…" artist:"…"' },
  'plain-combined':  { short: 'plain', title: '"title" "artist"'     },
  'title-only':      { short: 'title', title: '"title" only'          },
  'cache':           { short: 'cache', title: 'Returned from server cache — no Spotify call made' },
};

function RungBadge({ rung }) {
  return (
    <span className={`rung-badge rung-badge--${rung}`} title={RUNG_LABELS[rung]?.title ?? rung}>
      {RUNG_LABELS[rung]?.short ?? rung}
    </span>
  );
}

function FlagBadge({ label, active }) {
  if (!active) return null;
  return <span className="flag-badge">{label}</span>;
}

// ── Bucket badge ─────────────────────────────────────────────────────────────

const BUCKET_META = {
  auto:     { label: 'auto',      title: `Score >= ${AUTO_ACCEPT_THRESHOLD} — accepted without review` },
  review:   { label: 'review',    title: `Score >= ${REVIEW_FLOOR} — needs a human pick`              },
  notfound: { label: 'not found', title: `Score < ${REVIEW_FLOOR} — no usable match`                 },
};

function BucketBadge({ status }) {
  const meta = BUCKET_META[status];
  return (
    <span className={`bucket-badge bucket-badge--${status}`} title={meta.title}>
      {meta.label}
    </span>
  );
}

// ── Score breakdown (collapsible) ────────────────────────────────────────────

// Components returned by the backend scorer (each 0–1).
// weight: each component's contribution to the weighted average.
const COMPONENTS = [
  { key: 'title',      label: 'title',      weight: 0.40, color: 'var(--score-title)'  },
  { key: 'artist',     label: 'artist',     weight: 0.25, color: 'var(--score-artist)' },
  { key: 'popularity', label: 'popularity', weight: 0.35, color: 'var(--score-pop)'    },
];

function ScoreBreakdown({ score, showScorerTag }) {
  const [open, setOpen] = useState(false);

  const band =
    score.final >= AUTO_ACCEPT_THRESHOLD ? 'strong'
    : score.final >= REVIEW_FLOOR        ? 'likely'
    : score.final >= 0.30                ? 'weak'
    : 'poor';

  return (
    <div className="score-breakdown">
      <button
        className={`score-summary score-summary--${band}`}
        onClick={() => setOpen((o) => !o)}
        title="Click to see score breakdown"
      >
        {showScorerTag && <span className="score-rank">top pick</span>}
        <span className="score-final">{score.final}</span>
        <span className={`score-band score-band--${band}`}>{band}</span>
        <div className="score-bar" aria-hidden="true">
          {COMPONENTS.map((c) => {
            // Each segment width = component_value × its weight (contribution to final)
            const contribution = Math.max(0, score[c.key]) * c.weight;
            return (
              <div
                key={c.key}
                className="score-bar__seg"
                style={{ width: `${contribution * 100}%`, background: c.color }}
              />
            );
          })}
          {score.modifierFactor < 1 && (
            <div
              className="score-bar__penalty"
              style={{ width: `${(1 - score.modifierFactor) * score.final * 100}%` }}
              title={`Modifier penalty (×${score.modifierFactor})`}
            />
          )}
        </div>
        <span className="score-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <table className="score-table" cellSpacing={0}>
          <tbody>
            {COMPONENTS.map((c) => {
              const val = Math.max(0, score[c.key]);
              const pct = Math.round(val * 100);
              return (
                <tr key={c.key}>
                  <td className="score-row__label">{c.label}</td>
                  <td className="score-row__bar-cell">
                    <div className="score-row__track">
                      <div className="score-row__fill" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                  </td>
                  <td className="score-row__val">
                    {pct}%
                    <span className="score-row__max"> ×{c.weight}</span>
                  </td>
                </tr>
              );
            })}
            {score.modifierFactor < 1 && (
              <tr className="score-row--penalty">
                <td className="score-row__label">modifier</td>
                <td className="score-row__bar-cell" />
                <td className="score-row__val score-row__val--neg">×{score.modifierFactor}</td>
              </tr>
            )}
            <tr className="score-row--total">
              <td className="score-row__label">final</td>
              <td />
              <td className="score-row__val">{score.final}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Candidate card ───────────────────────────────────────────────────────────

function CandidateCard({ candidate, isSelected, isReviewHighlight }) {
  const cardClass = isSelected
    ? 'candidate-card--selected'
    : isReviewHighlight
    ? 'candidate-card--review-highlight'
    : '';

  return (
    <li className={`candidate-card ${cardClass}`}>
      <div className="candidate-row">
        <div className="candidate-info">
          {candidate.imageUrl && (
            <img className="candidate-image" src={candidate.imageUrl} alt={candidate.album} />
          )}
          <div className="candidate-main">
            <div className="candidate-title" title={candidate.title}>{candidate.title}</div>
            <div className="candidate-artist" title={candidate.artists || candidate.artist}>
              {candidate.artists || candidate.artist}
            </div>
            <div className="candidate-album" title={candidate.album}>
              {candidate.album}{candidate.releaseYear && ` (${candidate.releaseYear})`}
            </div>
          </div>
        </div>
        <div className="candidate-meta">
          <span className="meta-pop" title="Spotify popularity">★ {candidate.popularity}</span>
          <span className="meta-dur">{ms(candidate.durationMs)}</span>
          <RungBadge rung={candidate.queryRung} />
          <FlagBadge label="live"  active={candidate.isLive}  />
          <FlagBadge label="remix" active={candidate.isRemix} />
        </div>
      </div>
      <ScoreBreakdown score={candidate.score} showScorerTag={isSelected} />
    </li>
  );
}

// ── Resolved match panel ──────────────────────────────────────────────────────

function MatchPanel({ match }) {
  const { status, chosen, allCandidates } = match;
  let headerLabel, headerClass, headerExtra;
  if (status === 'auto') {
    headerLabel = 'Auto-accepted'; headerClass = 'auto-label';
    headerExtra = <span className="auto-score">score {chosen.score.final}</span>;
  } else if (status === 'review') {
    headerLabel = 'Needs review — pick the right match'; headerClass = 'review-label';
    headerExtra = <span className="review-hint">highlighting top 3 candidates</span>;
  } else {
    headerLabel = `No match found (all candidates scored below ${REVIEW_FLOOR})`; headerClass = 'notfound-label';
    headerExtra = <span className="notfound-hint">all candidates listed below</span>;
  }
  return (
    <div className={`candidates-panel candidates-panel--${status}`}>
      <div className="panel-header">
        <span className={headerClass}>{headerLabel}</span>
        {headerExtra}
      </div>
      {allCandidates.length === 0 ? (
        <p className="no-candidates">No Spotify results found.</p>
      ) : (
        <ol className="candidates-list">
          {allCandidates.map((c, i) => (
            <CandidateCard
              key={c.id} candidate={c}
              isSelected={status === 'auto' && i === 0}
              isReviewHighlight={status === 'review' && i < 3}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Cache Panel ───────────────────────────────────────────────────────────────

function CachePanel({ refreshTrigger }) {
  const [stats,   setStats]   = useState({ hits: 0, misses: 0, size: 0, hitRate: 0 });
  const [entries, setEntries] = useState([]);
  const [open,    setOpen]    = useState(false);
  const [error,   setError]   = useState(null);

  async function refresh() {
    try {
      const data = await getCacheState();
      setStats(data.stats);
      setEntries(data.entries);
    } catch (e) { setError(e.message); }
  }

  useEffect(() => { refresh(); }, [refreshTrigger]);

  async function handleClear() {
    try { await clearCache(); await refresh(); }
    catch (e) { setError(e.message); }
  }

  const hitPct = (stats.hits + stats.misses) === 0 ? '—' : `${Math.round(stats.hitRate * 100)}%`;

  return (
    <div className="cache-panel">
      <div className="cache-panel__header">
        <span className="rp-step-label">phase 7 — match cache</span>
        <div className="cache-panel__stats">
          <span className="cache-stat cache-stat--hits">{stats.hits} hit{stats.hits !== 1 ? 's' : ''}</span>
          <span className="cache-stat cache-stat--misses">{stats.misses} miss{stats.misses !== 1 ? 'es' : ''}</span>
          <span className="cache-stat cache-stat--rate">{hitPct} hit rate</span>
          <span className="cache-stat cache-stat--size">{stats.size} stored</span>
        </div>
        <div className="cache-panel__actions">
          <button className="cache-btn" onClick={() => setOpen(o => !o)} disabled={entries.length === 0}>
            {open ? 'hide entries' : `inspect (${entries.length})`}
          </button>
          <button className="cache-btn cache-btn--danger" onClick={handleClear} disabled={stats.size === 0}>
            clear cache
          </button>
        </div>
      </div>
      {error && <p className="rp-error">{error}</p>}
      {open && entries.length > 0 && (
        <ul className="cache-entries">
          {entries.map(({ key, match }) => {
            const [titlePart, artistPart] = key.split('|');
            const score = match.status === 'auto'
              ? match.chosen?.score?.final
              : match.topCandidates?.[0]?.score?.final ?? null;
            return (
              <li key={key} className="cache-entry">
                <span className="cache-entry__key">
                  <span className="cache-entry__title">{titlePart || '—'}</span>
                  {artistPart && <span className="cache-entry__artist"> / {artistPart}</span>}
                </span>
                <span className={`cache-entry__status cache-entry__status--${match.status}`}>{match.status}</span>
                {score != null && <span className="cache-entry__score">{score}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {open && entries.length === 0 && <p className="cache-empty">No entries yet.</p>}
    </div>
  );
}

// ── Song row ─────────────────────────────────────────────────────────────────

function SongRow({ song, index, isLoggedIn, onResolved }) {
  const [status,    setStatus]    = useState('idle');
  const [match,     setMatch]     = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [error,     setError]     = useState(null);
  const [expanded,  setExpanded]  = useState(false);

  async function resolve() {
    if (!isLoggedIn) { setError('Log in with Spotify first.'); setStatus('error'); return; }
    setStatus('loading'); setError(null); setFromCache(false);
    try {
      const token = await getValidAccessToken();
      const { results } = await resolveSongs(
        [{ title: song.title, artist: song.artist, rawText: song.rawText }],
        token,
      );
      const resolved = results[0];
      setMatch(resolved);
      setFromCache(resolved?.fromCache === true);
      setStatus('done');
      setExpanded(true);
      onResolved?.();
    } catch (err) { setError(err.message); setStatus('error'); }
  }

  const headerRung = fromCache ? 'cache'
    : match?.status === 'auto' ? match?.chosen?.queryRung
    : match?.topCandidates?.[0]?.queryRung;

  return (
    <li className="song-row">
      <div className="song-row__header">
        <span className="song-row__index">{index + 1}</span>
        <div className="song-row__info">
          <span className="song-row__title">{song.title}</span>
          {song.artist && <span className="song-row__artist">{song.artist}</span>}
        </div>
        <div className="song-row__actions">
          {status === 'done' && match && <BucketBadge status={match.status} />}
          {fromCache && <span className="cache-hit-badge" title="Served from server cache">cache</span>}
          {status === 'done' && match?.chosen && (
            <span className="song-row__topscore">{match.chosen.score.final}</span>
          )}
          {status === 'done' && match?.status === 'review' && (
            <span className="song-row__topscore">{match.topCandidates[0]?.score.final}</span>
          )}
          {headerRung && <RungBadge rung={headerRung} />}
          {status === 'error' && <span className="song-row__err" title={error}>error</span>}
          <button
            className={`resolve-btn resolve-btn--${status}`}
            onClick={status === 'done' ? () => setExpanded(e => !e) : resolve}
            disabled={status === 'loading'}
          >
            {status === 'idle' && 'Search'}
            {status === 'loading' && '…'}
            {status === 'done' && (expanded ? 'hide' : 'show')}
            {status === 'error' && 'retry'}
          </button>
        </div>
      </div>
      {status === 'error' && <p className="song-row__error-msg">{error}</p>}
      {status === 'done' && match && expanded && <MatchPanel match={match} />}
    </li>
  );
}

// ── Main playground ───────────────────────────────────────────────────────────

export default function ResolverPlayground({ isLoggedIn }) {
  const [rawInput,     setRawInput]     = useState('');
  const [songs,        setSongs]        = useState([]);
  const [parseStatus,  setParseStatus]  = useState('idle');
  const [parseError,   setParseError]   = useState(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const notifyResolved = useCallback(() => setRefreshCount(n => n + 1), []);

  const handleExtract = useCallback(async () => {
    if (!rawInput.trim() || parseStatus === 'loading') return;
    setParseStatus('loading'); setParseError(null); setSongs([]);
    try {
      const result = await extractSongs(rawInput);
      const lines  = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
      setSongs(result.map((song, i) => ({ ...song, rawText: lines[i] ?? rawInput })));
      setParseStatus('done');
    } catch (err) { setParseError(err.message); setParseStatus('error'); }
  }, [rawInput, parseStatus]);

  return (
    <div className="rp">
      <header className="rp-header">
        <h1>Resolver playground</h1>
        <p className="rp-subtitle">LLM extraction → Spotify search → scoring → bucketing → cache</p>
      </header>

      <CachePanel refreshTrigger={refreshCount} />

      <section className="rp-section">
        <span className="rp-step-label">step 1 — extract songs</span>
        <div className="rp-extract-row">
          <textarea
            className="rp-textarea"
            value={rawInput}
            onChange={(e) => { setRawInput(e.target.value); setSongs([]); setParseStatus('idle'); setParseError(null); }}
            placeholder={'Paste a song list, e.g.\nSnowfall - Oneheart\nPainted Skies - Elaine\nDawn - Jazz Oikawa'}
            spellCheck={false}
          />
          <button className="rp-extract-btn" onClick={handleExtract} disabled={parseStatus === 'loading' || !rawInput.trim()}>
            {parseStatus === 'loading' ? 'Extracting…' : 'Extract'}
          </button>
        </div>
        {parseStatus === 'error' && <p className="rp-error">{parseError}</p>}
      </section>

      {parseStatus === 'done' && songs.length > 0 && (
        <section className="rp-section">
          <div className="rp-step-header">
            <span className="rp-step-label">step 2 — resolve & bucket</span>
            <span className="rp-song-count">{songs.length} song{songs.length !== 1 ? 's' : ''}</span>
          </div>
          {!isLoggedIn && <p className="rp-login-hint">Log in with Spotify (nav bar) to enable search.</p>}
          <ul className="rp-song-list">
            {songs.map((song, i) => (
              <SongRow key={i} song={song} index={i} isLoggedIn={isLoggedIn} onResolved={notifyResolved} />
            ))}
          </ul>
        </section>
      )}

      {parseStatus === 'done' && songs.length === 0 && <p className="rp-empty">No songs found in that input.</p>}

      <section className="rp-legend">
        <span className="rp-step-label">bucket thresholds</span>
        <div className="rp-legend-items">
          <div className="rp-legend-item"><BucketBadge status="auto" /><span>score &gt;= {AUTO_ACCEPT_THRESHOLD} — accepted automatically</span></div>
          <div className="rp-legend-item"><BucketBadge status="review" /><span>score &gt;= {REVIEW_FLOOR} — top 3 candidates surfaced for review</span></div>
          <div className="rp-legend-item"><BucketBadge status="notfound" /><span>score below {REVIEW_FLOOR} — no usable match</span></div>
        </div>
        <span className="rp-step-label" style={{ marginTop: 16 }}>score components</span>
        <div className="rp-legend-items">
          {COMPONENTS.map((c) => (
            <div key={c.key} className="rp-legend-item">
              <span className="legend-swatch" style={{ background: c.color }} />
              <span>{c.label} (weight {c.weight})</span>
            </div>
          ))}
          <div className="rp-legend-item">
            <span className="legend-swatch legend-swatch--penalty" />
            <span>modifier ×0.60 if live/remix not requested</span>
          </div>
        </div>
        <span className="rp-step-label" style={{ marginTop: 16 }}>query ladder</span>
        <div className="rp-legend-items">
          {Object.entries(RUNG_LABELS).map(([rung, { title }]) => (
            <div key={rung} className="rp-legend-item"><RungBadge rung={rung} /><span>{title}</span></div>
          ))}
        </div>
      </section>
    </div>
  );
}