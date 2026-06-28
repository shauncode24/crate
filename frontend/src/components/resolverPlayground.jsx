import { useState, useCallback } from 'react';
import { extractSongs } from '../extraction/extract.js';
import { SpotifyResolver } from '../resolver/spotifyResolver.js';
import './resolverPlayground.css';

const resolver = new SpotifyResolver(8);

const RUNG_LABELS = {
  'field-qualified': { short: 'field', title: 'track:"…" artist:"…"' },
  'plain-combined':  { short: 'plain', title: '"title" "artist"'     },
  'title-only':      { short: 'title', title: '"title" only'          },
};

function ms(durationMs) {
  const m = Math.floor(durationMs / 60000);
  const s = String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0');
  return `${m}:${s}`;
}

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

function CandidateCard({ candidate }) {
  return (
    <li className="candidate-card">
      <div className="candidate-body">
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
        <span className="meta-pop" title="Spotify popularity">
          ★ {candidate.popularity}
        </span>
        <span className="meta-dur">{ms(candidate.durationMs)}</span>
        <RungBadge rung={candidate.queryRung} />
        <FlagBadge label="live"  active={candidate.isLive}  />
        <FlagBadge label="remix" active={candidate.isRemix} />
      </div>
    </li>
  );
}

function SongRow({ song, index, isLoggedIn }) {
  const [status, setStatus]       = useState('idle'); // idle | loading | done | error
  const [candidates, setCandidates] = useState([]);
  const [error, setError]         = useState(null);
  const [expanded, setExpanded]   = useState(false);

  async function resolve() {
    if (!isLoggedIn) {
      setError('Log in with Spotify first (see below).');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const results = await resolver.search(song.title, song.artist);
      setCandidates(results);
      setStatus('done');
      setExpanded(true);
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  const topRung = candidates[0]?.queryRung;

  return (
    <li className="song-row">
      <div className="song-row__header">
        <span className="song-row__index">{index + 1}</span>
        <div className="song-row__info">
          <span className="song-row__title">{song.title}</span>
          {song.artist && <span className="song-row__artist">{song.artist}</span>}
        </div>
        <div className="song-row__actions">
          {status === 'done' && topRung && <RungBadge rung={topRung} />}
          {status === 'done' && (
            <span className="song-row__count">
              {candidates.length} hit{candidates.length !== 1 ? 's' : ''}
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
          {candidates.length === 0 ? (
            <p className="no-candidates">No Spotify results found.</p>
          ) : (
            <ol className="candidates-list">
              {candidates.map((c) => (
                <CandidateCard key={c.id} candidate={c} />
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}

export default function ResolverPlayground({ isLoggedIn }) {
  const [rawInput, setRawInput]   = useState('');
  const [songs, setSongs]         = useState([]);
  const [parseStatus, setParseStatus] = useState('idle');
  const [parseError, setParseError]   = useState(null);

  const handleExtract = useCallback(async () => {
    if (!rawInput.trim() || parseStatus === 'loading') return;
    setParseStatus('loading');
    setParseError(null);
    setSongs([]);
    try {
      const result = await extractSongs(rawInput);
      setSongs(result);
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
        <p className="rp-subtitle">LLM extraction → Spotify search · three-rung query ladder</p>
      </header>

      {/* ── Step 1: paste + extract ─────────────────────────────────────── */}
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
            placeholder="Paste a song list, e.g.&#10;Snowfall - Øneheart&#10;Painted Skies - Elaine&#10;Dawn - Jazz Oikawa"
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
        {parseStatus === 'error' && (
          <p className="rp-error">{parseError}</p>
        )}
      </section>

      {/* ── Step 2: resolve each song ───────────────────────────────────── */}
      {parseStatus === 'done' && songs.length > 0 && (
        <section className="rp-section">
          <div className="rp-step-header">
            <span className="rp-step-label">step 2 — resolve on Spotify</span>
            <span className="rp-song-count">{songs.length} song{songs.length !== 1 ? 's' : ''}</span>
          </div>

          {!isLoggedIn && (
            <p className="rp-login-hint">
              Log in with Spotify (below) to enable search.
            </p>
          )}

          <ul className="rp-song-list">
            {songs.map((song, i) => (
              <SongRow
                key={i}
                song={song}
                index={i}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </ul>
        </section>
      )}

      {parseStatus === 'done' && songs.length === 0 && (
        <p className="rp-empty">No songs found in that input.</p>
      )}

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <section className="rp-legend">
        <span className="rp-step-label">query ladder</span>
        <div className="rp-legend-items">
          <div className="rp-legend-item">
            <RungBadge rung="field-qualified" />
            <span>track:"…" artist:"…" — most precise, may return 0</span>
          </div>
          <div className="rp-legend-item">
            <RungBadge rung="plain-combined" />
            <span>"title" "artist" — keyword fallback</span>
          </div>
          <div className="rp-legend-item">
            <RungBadge rung="title-only" />
            <span>"title" only — last resort</span>
          </div>
        </div>
      </section>
    </div>
  );
}