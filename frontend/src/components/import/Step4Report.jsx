import { useState } from 'react';
import './Step4Report.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function ms(durationMs) {
  if (!durationMs) return '';
  const m = Math.floor(durationMs / 60000);
  const s = String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0');
  return `${m}:${s}`;
}

function ReportThumb({ url, alt }) {
  if (url) return <img src={url} alt={alt} className="rpt-thumb" />;
  return <div className="rpt-thumb rpt-thumb--placeholder">♪</div>;
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="rpt-metric">
      <span className="rpt-metric__value">{value}</span>
      <span className="rpt-metric__label">{label}</span>
      {sub && <span className="rpt-metric__sub">{sub}</span>}
    </div>
  );
}

// ── Track list item ───────────────────────────────────────────────────────────

function TrackItem({ item, danger }) {
  return (
    <li className={`rpt-track ${danger ? 'rpt-track--danger' : ''}`}>
      <div className="rpt-track__row">
        <ReportThumb url={item.imageUrl} alt={item.album} />
        <div className="rpt-track__info">
          <div className="rpt-track__top">
            <strong className="rpt-track__title">{item.title}</strong>
            {item.confidence != null && (
              <span className={`rpt-track__badge rpt-track__badge--${item.confidence >= 90 ? 'hi' : item.confidence >= 70 ? 'mid' : 'lo'}`}>
                {item.confidence}% Match
              </span>
            )}
          </div>
          <span className="rpt-track__artist">{item.artists || item.artist}</span>
          {item.album && (
            <span className="rpt-track__album">
              {item.album}{item.releaseYear ? ` (${item.releaseYear})` : ''}{item.durationMs ? ` · ${ms(item.durationMs)}` : ''}
            </span>
          )}
          {item.matchedWith && (
            <div className="rpt-track__skipped">↳ Skipped: {item.matchedWith}</div>
          )}
          {item.error && (
            <div className="rpt-track__error">Reason (Chunk #{item.chunk + 1}): {item.error}</div>
          )}
        </div>
      </div>
      {item.score && (
        <details className="rpt-track__score">
          <summary>Confidence Score Breakdown</summary>
          <div className="rpt-track__score-grid">
            <div>Title similarity: <strong>{Math.round((item.score.title ?? 0) * 100)}%</strong></div>
            <div>Artist similarity: <strong>{Math.round((item.score.artist ?? 0) * 100)}%</strong></div>
            <div>Popularity weight: <strong>{Math.round((item.score.popularity ?? 0) * 100)}%</strong></div>
            <div>Modifier factor: <strong>{item.score.modifierFactor ?? 1}</strong></div>
          </div>
        </details>
      )}
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Step4Report — import result dashboard.
 *
 * Props:
 *   commitState  'running' | 'done'
 *   report       ImportReport | null
 *   runMetrics   RunMetrics | null
 *   playlistId   string
 *   onRetry      () => void
 *   onReset      () => void
 */
export default function Step4Report({ commitState, report, runMetrics, playlistId, onRetry, onReset }) {
  const [activeTab, setActiveTab] = useState('added');
  const [copied,    setCopied]    = useState(false);

  if (commitState === 'running') {
    return (
      <div className="rpt-loading">
        <div className="rpt-loading__spinner spin" aria-hidden="true" />
        <h2 className="rpt-loading__title">Adding songs to Spotify…</h2>
        <p className="rpt-loading__sub">Please don't close or refresh this page.</p>
      </div>
    );
  }

  if (!report) return null;

  const { added, skippedDuplicate, notFound, failed, counts } = report;
  const playlistUrl = playlistId ? `https://open.spotify.com/playlist/${playlistId}` : null;
  const hasFailures = failed.length > 0;

  function handleCopyNotFound() {
    navigator.clipboard.writeText(notFound.map(i => i.rawText).join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const TABS = [
    { key: 'added',    label: 'Added',     count: counts.added,            color: 'var(--success)' },
    { key: 'skipped',  label: 'Skipped',   count: counts.skippedDuplicate, color: 'var(--text-muted)' },
    { key: 'notFound', label: 'Not Found', count: counts.notFound,         color: 'var(--warning)' },
    { key: 'failed',   label: 'Failed',    count: counts.failed,           color: 'var(--danger)' },
  ];

  return (
    <div className="rpt">
      {/* Overview card */}
      <div className="rpt-overview">
        <span className="rpt-overview__icon">{hasFailures ? '⚠' : '✓'}</span>
        <h2 className={`rpt-overview__title ${hasFailures ? '' : 'rpt-overview__title--success'}`}>
          {hasFailures ? 'Import completed with warnings' : 'Import successful!'}
        </h2>
        <p className="rpt-overview__sub">Reconciled {counts.total} total tracks.</p>
        {playlistUrl && counts.added > 0 && (
          <a href={playlistUrl} target="_blank" rel="noopener noreferrer" className="rpt-open-link">
            Open playlist on Spotify ↗
          </a>
        )}
      </div>

      {/* Run metrics */}
      {runMetrics && (
        <div className="rpt-metrics">
          <div className="rpt-metrics__label">Run metrics</div>
          <div className="rpt-metrics__grid">
            <MetricCard label="Avg latency"    value={`${runMetrics.avgLatencyMs}ms`} />
            <MetricCard label="Avg confidence" value={`${runMetrics.avgTopConfidence}%`} />
            <MetricCard label="Cache hit rate" value={`${Math.round(runMetrics.cacheHitRate * 100)}%`} sub={runMetrics.cacheHitRate >= 0.9 ? '✓ cache working' : null} />
            <MetricCard label="LLM fallback"   value={`${Math.round(runMetrics.llmFallbackRate * 100)}%`} />
            <MetricCard label="429 retries"    value={runMetrics.retryCount} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="rpt-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`rpt-tab ${activeTab === tab.key ? 'rpt-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <span className="rpt-tab__badge" style={activeTab === tab.key ? { background: tab.color, color: '#fff' } : {}}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rpt-tab-panel">
        {activeTab === 'added' && (
          <>
            <h3 className="rpt-tab-panel__heading">Added to Playlist ({added.length})</h3>
            {added.length === 0
              ? <p className="rpt-empty">No tracks were added.</p>
              : <ul className="rpt-track-list">{added.map((item, idx) => <TrackItem key={idx} item={item} />)}</ul>
            }
          </>
        )}

        {activeTab === 'skipped' && (
          <>
            <h3 className="rpt-tab-panel__heading">Skipped Duplicates ({skippedDuplicate.length})</h3>
            {skippedDuplicate.length === 0
              ? <p className="rpt-empty">No tracks were skipped as duplicates.</p>
              : <ul className="rpt-track-list">{skippedDuplicate.map((item, idx) => <TrackItem key={idx} item={item} />)}</ul>
            }
          </>
        )}

        {activeTab === 'notFound' && (
          <>
            <div className="rpt-tab-panel__header-row">
              <h3 className="rpt-tab-panel__heading">Not Found ({notFound.length})</h3>
              {notFound.length > 0 && (
                <button className="rpt-copy-btn" onClick={handleCopyNotFound}>
                  {copied ? 'Copied ✓' : 'Copy All'}
                </button>
              )}
            </div>
            {notFound.length === 0
              ? <p className="rpt-empty">No tracks were not found.</p>
              : (
                <>
                  <p className="rpt-empty" style={{ marginBottom: '12px' }}>These queries didn't yield matches. Copy them to retry or search manually.</p>
                  <ul className="rpt-notfound-list">
                    {notFound.map((item, idx) => <li key={idx} className="rpt-notfound-item">{item.rawText}</li>)}
                  </ul>
                </>
              )
            }
          </>
        )}

        {activeTab === 'failed' && (
          <>
            <h3 className="rpt-tab-panel__heading">Failed Commits ({failed.length})</h3>
            {failed.length === 0
              ? <p className="rpt-empty">No tracks failed to write.</p>
              : (
                <>
                  <p className="rpt-empty" style={{ marginBottom: '12px' }}>These songs could not be written to Spotify due to API/network failures.</p>
                  <ul className="rpt-track-list" style={{ marginBottom: '16px' }}>
                    {failed.map((item, idx) => <TrackItem key={idx} item={item} danger />)}
                  </ul>
                  <button className="rpt-retry-btn" onClick={onRetry}>Retry Failed Chunks</button>
                </>
              )
            }
          </>
        )}
      </div>

      <button className="rpt-reset-btn" onClick={onReset}>← Import another list</button>
    </div>
  );
}
