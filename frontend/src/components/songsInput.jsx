import { useState, useCallback } from 'react';
import { extractSongs } from '../extraction/extract.js';
import './songsInput.css';

const SAMPLES = [
  {
    label: 'Numbered list',
    text: `1. Snowfall - Øneheart
2. Painted Skies - Elaine
3. Dawn - Jazz Oikawa
🎵 honestly so into Elaine right now, painted skies on repeat`,
  },
  {
    label: 'Bulleted',
    text: `• Bohemian Rhapsody — Queen
• Stairway to Heaven by Led Zeppelin
* Blinding Lights`,
  },
  {
    label: 'Noise',
    text: `Shape of You (Official Video) [Lyrics] - Ed Sheeran
1) Midnight Rain (Taylor's Version) — Taylor Swift
02. Can't Help Myself (Remaster) by Four Tops`,
  },
  {
    label: 'Prose',
    text: `been on a huge Phoebe Bridgers kick lately, Motion Sickness on repeat
Redbone
This Must Be the Place
honestly can't stop listening to Stick Season by Noah Kahan`,
  },
];

function ResultCard({ song, index }) {
  return (
    <li className="result-item">
      <div className="result-row">
        <span className="result-index">{index + 1}</span>
        <div className="result-fields">
          <div className="result-field">
            <span className="field-label">title</span>
            <span className="field-value">{song.title}</span>
          </div>
          {song.artist && (
            <div className="result-field">
              <span className="field-label">artist</span>
              <span className="field-value field-value--artist">{song.artist}</span>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export default function ParserPlayground() {
  const [input, setInput] = useState(SAMPLES[0].text);
  const [songs, setSongs] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState(null);

  const loadSample = useCallback((text) => {
    setInput(text);
    setSongs([]);
    setStatus('idle');
    setError(null);
  }, []);

  async function handleExtract() {
    if (!input.trim() || status === 'loading') return;

    setStatus('loading');
    setError(null);
    setSongs([]);

    try {
      const result = await extractSongs(input);
      setSongs(result);
      setStatus('done');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  const lineCount = input.split('\n').filter((l) => l.trim()).length;

  return (
    <div className="playground">
      <header className="pg-header">
        <h1>Parser playground</h1>
        <p className="pg-subtitle">AI extraction — one call, all songs</p>
      </header>

      <div className="pg-samples">
        {SAMPLES.map((s) => (
          <button
            key={s.label}
            className={`sample-btn ${input === s.text ? 'sample-btn--active' : ''}`}
            onClick={() => loadSample(s.text)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="pg-body">
        <section className="pg-pane">
          <label className="pane-label" htmlFor="raw-input">Raw input</label>
          <textarea
            id="raw-input"
            className="pg-textarea"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setSongs([]);
              setStatus('idle');
              setError(null);
            }}
            placeholder="Paste a song list here…"
            spellCheck={false}
          />
          <div className="pane-footer">
            <span className="pane-hint">{lineCount} non-empty line{lineCount !== 1 ? 's' : ''}</span>
            <button
              className="extract-btn"
              onClick={handleExtract}
              disabled={status === 'loading' || !input.trim()}
            >
              {status === 'loading' ? 'Extracting…' : 'Extract songs'}
            </button>
          </div>
        </section>

        <section className="pg-pane">
          <div className="pane-label-row">
            <span className="pane-label">Extracted songs</span>
            {status === 'done' && (
              <span className="pane-count">
                {songs.length} song{songs.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {status === 'idle' && (
            <p className="empty-state">Results will appear here.</p>
          )}

          {status === 'loading' && (
            <div className="loading-state">
              <span className="loading-shimmer">Asking AI…</span>
            </div>
          )}

          {status === 'error' && (
            <p className="error-state">{error}</p>
          )}

          {status === 'done' && songs.length === 0 && (
            <p className="empty-state">No songs found in that input.</p>
          )}

          {status === 'done' && songs.length > 0 && (
            <ol className="result-list">
              {songs.map((song, i) => (
                <ResultCard key={i} song={song} index={i} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}