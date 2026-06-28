import { useState, useCallback } from 'react';
import { parseHeuristic } from '../extraction/parseHeuristic.js';
import './songsInput.css';
import { needsLLMFallback, extractWithLLM } from '../extraction/llmFallback.js';

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
    label: 'Prose / mixed',
    text: `been on a huge Phoebe Bridgers kick lately, Motion Sickness on repeat
Redbone
This Must Be the Place
honestly can't stop listening to Stick Season by Noah Kahan`,
  },
];

function computeConfidence(song) {
  if (song.delimiterFound) return 'high';
  const words = song.rawText.trim().split(/\s+/);
  if (words.length <= 6) return 'title-only';
  return 'low';
}

function initRow(song) {
  const confidence = computeConfidence(song);
  return {
    ...song,
    confidence,
    llmStatus: needsLLMFallback(song) ? 'pending' : null,
    llmSongs: null,
    llmError: null,
  };
}

function ConfidenceBadge({ confidence }) {
  const map = {
    high:         { label: 'split',       cls: 'badge--high' },
    'title-only': { label: 'title only',  cls: 'badge--mid'  },
    low:          { label: 'low conf.',   cls: 'badge--low'  },
  };
  const { label, cls } = map[confidence];
  return <span className={`badge ${cls}`}>{label}</span>;
}

function LLMStatusBadge({ status }) {
  if (!status) return null;
  const map = {
    pending: { label: '→ LLM queued', cls: 'badge--llm-pending' },
    running: { label: '⟳ LLM…',       cls: 'badge--llm-running' },
    done:    { label: '✓ LLM done',   cls: 'badge--llm-done'    },
    error:   { label: '✕ LLM error',  cls: 'badge--llm-error'   },
  };
  const { label, cls } = map[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

function ResultCard({ row }) {
  const showLLMResult = row.llmStatus === 'done' && row.llmSongs;

  return (
    <li className={`result-item result-item--${row.confidence}`}>
      <div className="result-row">
        <div className="result-badges">
          <ConfidenceBadge confidence={row.confidence} />
          <LLMStatusBadge status={row.llmStatus} />
        </div>

        <div className="result-fields">
          {/* Heuristic result */}
          <div className={`result-source ${row.confidence === 'low' && showLLMResult ? 'result-source--dim' : ''}`}>
            {row.confidence === 'low' && showLLMResult && (
              <span className="source-label">heuristic</span>
            )}
            <div className="result-field">
              <span className="field-label">title</span>
              <span className="field-value">{row.title}</span>
            </div>
            {row.artist && (
              <div className="result-field">
                <span className="field-label">artist</span>
                <span className="field-value">{row.artist}</span>
              </div>
            )}
            {row.confidence === 'low' && row.llmStatus === 'pending' && (
              <div className="result-field">
                <span className="field-label" />
                <span className="field-value field-value--muted">queued for LLM</span>
              </div>
            )}
          </div>

          {/* LLM running shimmer */}
          {row.llmStatus === 'running' && (
            <div className="result-source result-source--llm">
              <span className="source-label">LLM</span>
              <div className="result-field">
                <span className="field-label" />
                <span className="field-value field-value--muted llm-shimmer">extracting…</span>
              </div>
            </div>
          )}

          {/* LLM result */}
          {showLLMResult && (
            <div className="result-source result-source--llm">
              <span className="source-label">LLM</span>
              {row.llmSongs.length === 0 ? (
                <div className="result-field">
                  <span className="field-label" />
                  <span className="field-value field-value--muted">no songs found</span>
                </div>
              ) : (
                row.llmSongs.map((s, i) => (
                  <div key={i} className={`llm-song ${row.llmSongs.length > 1 ? 'llm-song--multi' : ''}`}>
                    <div className="result-field">
                      <span className="field-label">title</span>
                      <span className="field-value field-value--accent">{s.title}</span>
                    </div>
                    {s.artist && (
                      <div className="result-field">
                        <span className="field-label">artist</span>
                        <span className="field-value field-value--accent">{s.artist}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* LLM error */}
          {row.llmStatus === 'error' && (
            <div className="result-source result-source--error">
              <span className="source-label">LLM error</span>
              <div className="result-field">
                <span className="field-label" />
                <span className="field-value field-value--error">{row.llmError}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="result-raw">{row.rawText}</div>
    </li>
  );
}

export default function ParserPlayground() {
  const [input, setInput] = useState(SAMPLES[0].text);
  const [rows, setRows] = useState(() =>
    parseHeuristic(SAMPLES[0].text).map(initRow)
  );
  const [llmRunning, setLlmRunning] = useState(false);

  const run = useCallback((text) => {
    setInput(text);
    setRows(parseHeuristic(text).map(initRow));
  }, []);

  const handleChange = (e) => run(e.target.value);

  async function runLLM() {
    if (llmRunning) return;
    setLlmRunning(true);

    // Snapshot indices of pending rows before we start mutating state
    const pendingIndices = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.llmStatus === 'pending')
      .map(({ i }) => i);

    // Mark all pending as running
    setRows((prev) =>
      prev.map((r) => (r.llmStatus === 'pending' ? { ...r, llmStatus: 'running' } : r))
    );

    await Promise.all(
      pendingIndices.map(async (idx) => {
        const rawText = rows[idx].rawText;
        try {
          const llmSongs = await extractWithLLM(rawText);
          setRows((prev) =>
            prev.map((r, i) => (i === idx ? { ...r, llmStatus: 'done', llmSongs } : r))
          );
        } catch (err) {
          setRows((prev) =>
            prev.map((r, i) =>
              i === idx ? { ...r, llmStatus: 'error', llmError: err.message } : r
            )
          );
        }
      })
    );

    setLlmRunning(false);
  }

  const highCount  = rows.filter((r) => r.confidence === 'high').length;
  const midCount   = rows.filter((r) => r.confidence === 'title-only').length;
  const lowCount   = rows.filter((r) => r.confidence === 'low').length;
  const pendingCount = rows.filter((r) => r.llmStatus === 'pending').length;

  return (
    <div className="playground">
      <header className="pg-header">
        <h1>Parser playground</h1>
        <p className="pg-subtitle">Phase 2 + 3 — heuristic extraction &amp; LLM fallback</p>
      </header>

      <div className="pg-samples">
        {SAMPLES.map((s) => (
          <button
            key={s.label}
            className={`sample-btn ${input === s.text ? 'sample-btn--active' : ''}`}
            onClick={() => run(s.text)}
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
            onChange={handleChange}
            placeholder="Paste a song list here…"
            spellCheck={false}
          />
          <p className="pane-hint">
            {input.split('\n').filter((l) => l.trim()).length} non-empty lines
          </p>
        </section>

        <section className="pg-pane">
          <div className="pane-label-row">
            <span className="pane-label">Parsed output</span>
            <span className="pane-count">
              {highCount > 0 && <><span className="count-high">{highCount} split</span>{(midCount > 0 || lowCount > 0) && ' · '}</>}
              {midCount > 0 && <><span className="count-mid">{midCount} title-only</span>{lowCount > 0 && ' · '}</>}
              {lowCount > 0 && <span className="count-low">{lowCount} low conf.</span>}
              {rows.length === 0 && '—'}
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="empty-state">No lines to parse yet.</p>
          ) : (
            <>
              <ol className="result-list">
                {rows.map((row, i) => <ResultCard key={i} row={row} />)}
              </ol>

              {pendingCount > 0 && (
                <div className="llm-cta">
                  <p className="llm-cta-text">
                    {pendingCount} line{pendingCount !== 1 ? 's' : ''} flagged for LLM extraction
                  </p>
                  <button className="llm-btn" onClick={runLLM} disabled={llmRunning}>
                    {llmRunning ? 'Extracting…' : 'Run LLM fallback'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}