import { useState, useCallback } from 'react';
import { extractSongs } from '../extraction/extract.js';
import { SpotifyResolver } from '../resolver/spotifyResolver.js';
import { rankCandidates } from '../scorer/scorer.js';
import './resolverPlayground.css';

const resolver = new SpotifyResolver(8);

// ── Formatting helpers ───────────────────────────────────────────────────────

function ms(durationMs) {
  const m = Math.floor(durationMs / 60000);
  const s = String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0');
  return `${m}:${s}`;
}

function fmt(n) {
  // Show one decimal unless it's a whole number.
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ── Sub-components ───────────────────────────────────────────────────────────

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

// ── Score breakdown bar ──────────────────────────────────────────────────────

const COMPONENTS = [
  { key: 'titleMatch',      label: 'title',    max: 45,  color: 'var(--score-title)'    },
  { key: 'artistMatch',     label: 'artist',   max: 35,  color: 'var(--score-artist)'   },
  { key: 'albumMatch',      label: 'album',    max: 10,  color: 'var(--score-album)'    },
  { key: 'popularity',      label: 'pop',      max: 5,   color: 'var(--score-pop)'      },
  { key: 'modifierPenalty', label: 'modifier', max: 0,   color: 'var(--score-penalty)'  },
];

// Total positive budget for bar proportions.
const SCORE_BUDGET = 45 + 35 + 10 + 5; // 95

function ScoreBreakdown({ score, rank }) {
  const [open, setOpen] = useState(false);

  // Confidence band label.
  const band =
    score.final >= 80 ? 'strong'
    : score.final >= 60 ? 'likely'
    : score.final >= 40 ? 'weak'
    : 'poor';

  return (
    <div className="score-breakdown">
      {/* ── Summary row ── */}
      <button
        className={`score-summary score-summary--${band}`}
        onClick={() => setOpen((o) => !o)}
        title="Click to see score breakdown"
      >
        {rank === 0 && <span className="score-rank">top pick</span>}
        <span className="score-final">{score.final}</span>
        <span className={`score-band score-band--${band}`}>{band}</span>

        {/* Stacked segment bar */}
        <div className="score-bar" aria-hidden="true">
          {COMPONENTS.filter((c) => c.key !== 'modifierPenalty').map((c) => {
            const val = Math.max(0, score[c.key]);
            const pct = (val / SCORE_BUDGET) * 100;
            return (
              <div
                key={c.key}
                className="score-bar__seg"
                style={{ width: `${pct}%`, background: c.color }}
              />
            );
          })}
          {/* Penalty shown as a dark notch at the right */}
          {score.modifierPenalty < 0 && (
            <div
              className="score-bar__penalty"
              style={{ width: `${(Math.abs(score.modifierPenalty) / SCORE_BUDGET) * 100}%` }}
            />
          )}
        </div>

        <span className="score-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {/* ── Detail table ── */}
      {open && (
        <table className="score-table" cellSpacing={0}>
          <tbody>
            {COMPONENTS.map((c) => {
              const val = score[c.key];
              const isNeg = val < 0;
              const pct = c.max > 0
                ? Math.round((Math.max(0, val) / c.max) * 100)
                : 0;
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

function CandidateCard({ candidate, rank }) {
  return (
    <li className={`candidate-card ${rank === 0 ? 'candidate-card--top' : ''}`}>
      <div className="candidate-body">
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
      <ScoreBreakdown score={candidate.score} rank={rank} />
    </li>
  );
}

// ── Song row ─────────────────────────────────────────────────────────────────

function SongRow({ song, index, isLoggedIn }) {
  const [status, setStatus]         = useState('idle');
  const [ranked, setRanked]         = useState([]);
  const [error, setError]           = useState(null);
  const [expanded, setExpanded]     = useState(false);

  async function resolve() {
    if (!isLoggedIn) {
      setError('Log in with Spotify first.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const candidates = await resolver.search(song.title, song.artist);
      // Pass rawText so the modifier penalty can check the original wording.
      const songWithRaw = { ...song, rawText: song.rawText ?? `${song.title}${song.artist ? ` ${song.artist}` : ''}` };
      const results = rankCandidates(songWithRaw, candidates);
      setRanked(results);
      setStatus('done');
      setExpanded(true);
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  const topRung  = ranked[0]?.queryRung;
  const topScore = ranked[0]?.score?.final;

  return (
    <li className="song-row">
      <div className="song-row__header">
        <span className="song-row__index">{index + 1}</span>
        <div className="song-row__info">
          <span className="song-row__title">{song.title}</span>
          {song.artist && <span className="song-row__artist">{song.artist}</span>}
        </div>
        <div className="song-row__actions">
          {status === 'done' && topRung   && <RungBadge rung={topRung} />}
          {status === 'done' && topScore != null && (
            <span className="song-row__topscore" title="Top candidate score">
              {topScore}
            </span>
          )}
          {status === 'done' && (
            <span className="song-row__count">
              {ranked.length} hit{ranked.length !== 1 ? 's' : ''}
            </span>
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

      {status === 'done' && expanded && (
        <div className="candidates-panel">
          {ranked.length === 0 ? (
            <p className="no-candidates">No Spotify results found.</p>
          ) : (
            <ol className="candidates-list">
              {ranked.map((c, i) => (
                <CandidateCard key={c.id} candidate={c} rank={i} />
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}

// ── Main playground ───────────────────────────────────────────────────────────

export default function ResolverPlayground({ isLoggedIn }) {
  const [rawInput, setRawInput]         = useState('');
  const [songs, setSongs]               = useState([]);
  const [parseStatus, setParseStatus]   = useState('idle');
  const [parseError, setParseError]     = useState(null);

  const handleExtract = useCallback(async () => {
    if (!rawInput.trim() || parseStatus === 'loading') return;
    setParseStatus('loading');
    setParseError(null);
    setSongs([]);
    try {
      const result = await extractSongs(rawInput);
      // Attach the original raw input line as rawText per song so the
      // modifier penalty scorer can inspect it.
      const lines = rawInput.split('\n').map((l) => l.trim()).filter(Boolean);
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
          LLM extraction → Spotify search → explainable scoring
        </p>
      </header>

      {/* Step 1 */}
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

      {/* Step 2 */}
      {parseStatus === 'done' && songs.length > 0 && (
        <section className="rp-section">
          <div className="rp-step-header">
            <span className="rp-step-label">step 2 — resolve & score</span>
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

      {/* Legend */}
      <section className="rp-legend">
        <span className="rp-step-label">score components</span>
        <div className="rp-legend-items">
          {COMPONENTS.map((c) => (
            <div key={c.key} className="rp-legend-item">
              {c.max > 0
                ? <span className="legend-swatch" style={{ background: c.color }} />
                : <span className="legend-swatch legend-swatch--penalty" />
              }
              <span>
                {c.label}
                {c.max > 0 ? ` (0–${c.max} pts)` : " (−15 if live/remix and you didn't ask)"}
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