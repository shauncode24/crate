import { useState, useCallback } from 'react';
import { parseHeuristic } from '../extraction/parseHeuristic.js';
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
    label: 'Bulleted · em dash · by',
    text: `• Bohemian Rhapsody — Queen
• Stairway to Heaven by Led Zeppelin
* Blinding Lights`,
  },
  {
    label: 'Noise stripping',
    text: `Shape of You (Official Video) [Lyrics] - Ed Sheeran
1) Midnight Rain (Taylor's Version) — Taylor Swift
02. Can't Help Myself (Remaster) by Four Tops`,
  },
  {
    label: 'Plain titles (no artist)',
    text: `Redbone
Motion Sickness
This Must Be the Place`,
  },
];

function Badge({ found }) {
  return (
    <span className={`badge ${found ? 'badge--split' : 'badge--unsplit'}`}>
      {found ? 'split' : 'no delimiter'}
    </span>
  );
}

export default function ParserPlayground() {
  const [input, setInput] = useState(SAMPLES[0].text);
  const [results, setResults] = useState(() => parseHeuristic(SAMPLES[0].text));

  const run = useCallback((text) => {
    setInput(text);
    setResults(parseHeuristic(text));
  }, []);

  const handleChange = (e) => run(e.target.value);

  const loadSample = (text) => run(text);

  return (
    <div className="playground">
      <header className="pg-header">
        <h1>Parser playground</h1>
        <p className="pg-subtitle">Phase 2 — heuristic extraction</p>
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
        {/* Input */}
        <section className="pg-pane">
          <label className="pane-label" htmlFor="raw-input">
            Raw input
          </label>
          <textarea
            id="raw-input"
            className="pg-textarea"
            value={input}
            onChange={handleChange}
            placeholder="Paste a song list here…"
            spellCheck={false}
          />
          <p className="pane-hint">
            {input.split('\n').filter((l) => l.trim()).length} non-empty lines
          </p>
        </section>

        {/* Output */}
        <section className="pg-pane">
          <div className="pane-label-row">
            <span className="pane-label">Parsed output</span>
            <span className="pane-count">
              {results.length} song{results.length !== 1 ? 's' : ''}
              {' · '}
              {results.filter((r) => r.delimiterFound).length} split
              {' · '}
              {results.filter((r) => !r.delimiterFound).length} flagged
            </span>
          </div>

          {results.length === 0 ? (
            <p className="empty-state">No lines to parse yet.</p>
          ) : (
            <ol className="result-list">
              {results.map((r, i) => (
                <li key={i} className={`result-item ${!r.delimiterFound ? 'result-item--flagged' : ''}`}>
                  <div className="result-row">
                    <Badge found={r.delimiterFound} />
                    <div className="result-fields">
                      <div className="result-field">
                        <span className="field-label">title</span>
                        <span className="field-value">{r.title}</span>
                      </div>
                      {r.artist !== null && (
                        <div className="result-field">
                          <span className="field-label">artist</span>
                          <span className="field-value">{r.artist}</span>
                        </div>
                      )}
                      {!r.delimiterFound && (
                        <div className="result-field result-field--note">
                          <span className="field-label">→</span>
                          <span className="field-value field-value--muted">
                            needs AI lookup (Phase 3)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="result-raw">{r.rawText}</div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}