import { useState, useCallback } from 'react';
import { extractSongs }    from '../extraction/extract.js';
import { SpotifyResolver } from '../resolver/spotifyResolver.js';
import { rankCandidates }  from '../scorer/scorer.js';
import { bucketMatch }     from '../matcher/matcher.js';
import { AUTO_ACCEPT_THRESHOLD, REVIEW_FLOOR } from '../matcher/matchConfig.js';
import './resolverPlayground.css';

const resolver = new SpotifyResolver(8);

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
  auto:     { label: 'auto',      title: `Score ≥ ${AUTO_ACCEPT_THRESHOLD} — accepted without review` },
  review:   { label: 'review',    title: `Score ≥ ${REVIEW_FLOOR} — needs a human pick`              },
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

const COMPONENTS = [
  { key: 'titleMatch',      label: 'title',    max: 45, color: 'var(--score-title)'   },
  { key: 'artistMatch',     label: 'artist',   max: 35, color: 'var(--score-artist)'  },
  { key: 'albumMatch',      label: 'album',    max: 10, color: 'var(--score-album)'   },
  { key: 'popularity',      label: 'pop',      max: 5,  color: 'var(--score-pop)'     },
  { key: 'modifierPenalty', label: 'modifier', max: 0,  color: 'var(--score-penalty)' },
];

const SCORE_BUDGET = 95;

function ScoreBreakdown({ score, rank, showScorerTag }) {
  const [open, setOpen] = useState(false);

  const band =
    score.final >= AUTO_ACCEPT_THRESHOLD ? 'strong'
    : score.final >= REVIEW_FLOOR        ? 'likely'
    : score.final >= 30                  ? 'weak'
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
          {COMPONENTS.filter((c) => c.key !== 'modifierPenalty').map((c) => {
            const val = Math.max(0, score[c.key]);
            return (
              <div
                key={c.key}
                className="score-bar__seg"
                style={{ width: `${(val / SCORE_BUDGET) * 100}%`, background: c.color }}
              />
            );
          })}
          {score.modifierPenalty < 0 && (
            <div
              className="score-bar__penalty"
              style={{ width: `${(Math.abs(score.modifierPenalty) / SCORE_BUDGET) * 100}%` }}
            />
          )}
        </div>

        <span className="score-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <table className="score-table" cellSpacing={0}>
          <tbody>
            {COMPONENTS.map((c) => {
              const val = score[c.key];
              const isNeg = val < 0;
              const pct = c.max > 0 ? Math.round((Math.max(0, val) / c.max) * 100) : 0;
              return (
                <tr key={c.key} className={isNeg ? 'score-row--penalty' : ''}>
                  <td className="score-row__label">{c.label}</td>
                  <td className="score-row__bar-cell">
                    {c.max > 0 && (
                      <div className="score-row__track">
                        <div
                          className="score-row__fill"
                          style={{ width: `${pct}%`, background: c.color }}
                        />
                      </div>
                    )}
                  </td>
                  <td className={`score-row__val ${isNeg ? 'score-row__val--neg' : ''}`}>
                    {isNeg ? fmt(val) : `+${fmt(val)}`}
                    {c.max > 0 && <span className="score-row__max"> / {c.max}</span>}
                  </td>
                </tr>
              );
            })}
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

function CandidateCard({ candidate, rank, isSelected, isReviewHighlight }) {
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
            <img
              className="candidate-image"
              src={candidate.imageUrl}
              alt={candidate.album}
            />
          )}
          <div className="candidate-main">
            <div className="candidate-title" title={candidate.title}>{candidate.title}</div>
            <div className="candidate-artist" title={candidate.artists || candidate.artist}>
              {candidate.artists || candidate.artist}
            </div>
            <div className="candidate-album" title={candidate.album}>
              {candidate.album}
              {candidate.releaseYear && ` (${candidate.releaseYear})`}
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
      <ScoreBreakdown score={candidate.score} rank={rank} showScorerTag={isSelected} />
    </li>
  );
}

// ── Resolved match panel (what Phase 6 adds) ─────────────────────────────────

function MatchPanel({ match }) {
  const { status, chosen, allCandidates } = match;

  let headerLabel = '';
  let headerClass = '';
  let headerExtra = null;

  if (status === 'auto') {
    headerLabel = 'Auto-accepted';
    headerClass = 'auto-label';
    headerExtra = <span className="auto-score">score {chosen.score.final}</span>;
  } else if (status === 'review') {
    headerLabel = 'Needs review — pick the right match';
    headerClass = 'review-label';
    headerExtra = <span className="review-hint">highlighting top 3 candidates</span>;
  } else {
    headerLabel = `No match found (all candidates scored below ${REVIEW_FLOOR})`;
    headerClass = 'notfound-label';
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
          {allCandidates.map((c, i) => {
            const isSelected = status === 'auto' && i === 0;
            const isReviewHighlight = status === 'review' && i < 3;
            return (
              <CandidateCard
                key={c.id}
                candidate={c}
                rank={i}
                isSelected={isSelected}
                isReviewHighlight={isReviewHighlight}
              />
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ── Song row ─────────────────────────────────────────────────────────────────

function SongRow({ song, index, isLoggedIn }) {
  const [status,   setStatus]   = useState('idle');
  const [match,    setMatch]    = useState(null);   // ResolvedMatch
  const [error,    setError]    = useState(null);
  const [expanded, setExpanded] = useState(false);

  async function resolve() {
    if (!isLoggedIn) {
      setError('Log in with Spotify first.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const candidates  = await resolver.search(song.title, song.artist);
      const songWithRaw = {
        ...song,
        rawText: song.rawText ?? `${song.title}${song.artist ? ` ${song.artist}` : ''}`,
      };
      const ranked   = rankCandidates(songWithRaw, candidates);
      const resolved = bucketMatch(songWithRaw, ranked);
      setMatch(resolved);
      setStatus('done');
      setExpanded(true);
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

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
          {status === 'done' && match?.chosen && (
            <span className="song-row__topscore" title="Auto-accepted score">
              {match.chosen.score.final}
            </span>
          )}
          {status === 'done' && match?.status === 'review' && (
            <span className="song-row__topscore" title="Top candidate score">
              {match.topCandidates[0]?.score.final}
            </span>
          )}
          {status === 'done' && match?.topCandidates?.[0]?.queryRung && (
            <RungBadge rung={match.topCandidates[0].queryRung} />
          )}
          {status === 'done' && match?.chosen?.queryRung && (
            <RungBadge rung={match.chosen.queryRung} />
          )}
          {status === 'error' && (
            <span className="song-row__err" title={error}>error</span>
          )}
          <button
            className={`resolve-btn resolve-btn--${status}`}
            onClick={status === 'done' ? () => setExpanded((e) => !e) : resolve}
            disabled={status === 'loading'}
          >
            {status === 'idle'    && 'Search'}
            {status === 'loading' && '…'}
            {status === 'done'    && (expanded ? 'hide' : 'show')}
            {status === 'error'   && 'retry'}
          </button>
        </div>
      </div>

      {status === 'error' && (
        <p className="song-row__error-msg">{error}</p>
      )}

      {status === 'done' && match && expanded && (
        <MatchPanel match={match} />
      )}
    </li>
  );
}

// ── Main playground ───────────────────────────────────────────────────────────

export default function ResolverPlayground({ isLoggedIn }) {
  const [rawInput,     setRawInput]     = useState('');
  const [songs,        setSongs]        = useState([]);
  const [parseStatus,  setParseStatus]  = useState('idle');
  const [parseError,   setParseError]   = useState(null);

  const handleExtract = useCallback(async () => {
    if (!rawInput.trim() || parseStatus === 'loading') return;
    setParseStatus('loading');
    setParseError(null);
    setSongs([]);
    try {
      const result = await extractSongs(rawInput);
      const lines  = rawInput.split('\n').map((l) => l.trim()).filter(Boolean);
      const withRaw = result.map((song, i) => ({
        ...song,
        rawText: lines[i] ?? rawInput,
      }));
      setSongs(withRaw);
      setParseStatus('done');
    } catch (err) {
      setParseError(err.message);
      setParseStatus('error');
    }
  }, [rawInput, parseStatus]);

  return (
    <div className="rp">
      <header className="rp-header">
        <h1>Resolver playground</h1>
        <p className="rp-subtitle">
          LLM extraction → Spotify search → scoring → bucketing
        </p>
      </header>

      {/* ── Step 1: extract ── */}
      <section className="rp-section">
        <span className="rp-step-label">step 1 — extract songs</span>
        <div className="rp-extract-row">
          <textarea
            className="rp-textarea"
            value={rawInput}
            onChange={(e) => {
              setRawInput(e.target.value);
              setSongs([]);
              setParseStatus('idle');
              setParseError(null);
            }}
            placeholder={
              'Paste a song list, e.g.\n' +
              'Snowfall - Øneheart\n' +
              'Painted Skies - Elaine\n' +
              'Dawn - Jazz Oikawa'
            }
            spellCheck={false}
          />
          <button
            className="rp-extract-btn"
            onClick={handleExtract}
            disabled={parseStatus === 'loading' || !rawInput.trim()}
          >
            {parseStatus === 'loading' ? 'Extracting…' : 'Extract'}
          </button>
        </div>
        {parseStatus === 'error' && <p className="rp-error">{parseError}</p>}
      </section>

      {/* ── Step 2: resolve & bucket ── */}
      {parseStatus === 'done' && songs.length > 0 && (
        <section className="rp-section">
          <div className="rp-step-header">
            <span className="rp-step-label">step 2 — resolve & bucket</span>
            <span className="rp-song-count">
              {songs.length} song{songs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {!isLoggedIn && (
            <p className="rp-login-hint">Log in with Spotify (nav bar) to enable search.</p>
          )}

          <ul className="rp-song-list">
            {songs.map((song, i) => (
              <SongRow key={i} song={song} index={i} isLoggedIn={isLoggedIn} />
            ))}
          </ul>
        </section>
      )}

      {parseStatus === 'done' && songs.length === 0 && (
        <p className="rp-empty">No songs found in that input.</p>
      )}

      {/* ── Legend ── */}
      <section className="rp-legend">
        <span className="rp-step-label">bucket thresholds</span>
        <div className="rp-legend-items">
          <div className="rp-legend-item">
            <BucketBadge status="auto" />
            <span>score ≥ {AUTO_ACCEPT_THRESHOLD} — accepted automatically</span>
          </div>
          <div className="rp-legend-item">
            <BucketBadge status="review" />
            <span>score ≥ {REVIEW_FLOOR} — top {3} candidates surfaced for review</span>
          </div>
          <div className="rp-legend-item">
            <BucketBadge status="notfound" />
            <span>score &lt; {REVIEW_FLOOR} — no usable match</span>
          </div>
        </div>

        <span className="rp-step-label" style={{ marginTop: 16 }}>score components</span>
        <div className="rp-legend-items">
          {COMPONENTS.map((c) => (
            <div key={c.key} className="rp-legend-item">
              {c.max > 0
                ? <span className="legend-swatch" style={{ background: c.color }} />
                : <span className="legend-swatch legend-swatch--penalty" />
              }
              <span>
                {c.label}
                {c.max > 0
                  ? ` (0–${c.max} pts)`
                  : ` (−15 if live/remix and not requested)`}
              </span>
            </div>
          ))}
        </div>

        <span className="rp-step-label" style={{ marginTop: 16 }}>query ladder</span>
        <div className="rp-legend-items">
          {Object.entries(RUNG_LABELS).map(([rung, { title }]) => (
            <div key={rung} className="rp-legend-item">
              <RungBadge rung={rung} />
              <span>{title}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}