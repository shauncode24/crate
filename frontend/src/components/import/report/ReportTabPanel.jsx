import React, { useState } from 'react';

// Formats milliseconds into M:SS duration strings
function ms(durationMs) {
  if (!durationMs) return '';
  const m = Math.floor(durationMs / 60000);
  const s = String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0');
  return `${m}:${s}`;
}

// Presentational subcomponent: Track Thumbnail
function TrackThumb({ url }) {
  if (url) return <img src={url} alt="Album cover" className="panel-track-thumb" />;
  return <div className="panel-track-thumb panel-track-thumb--placeholder">♪</div>;
}

// Presentational subcomponent: Single Track Row
function TrackItemRow({ item, isDanger = false }) {
  return (
    <li className={`panel-track-row ${isDanger ? 'panel-track-row--danger' : ''}`}>
      <TrackThumb url={item.imageUrl} />
      <div className="panel-track-row__info">
        <div className="panel-track-row__header">
          <strong className="panel-track-row__title">{item.title}</strong>
          {item.confidence != null && (
            <span className={`panel-track-row__badge panel-track-row__badge--${item.confidence >= 90 ? 'hi' : item.confidence >= 70 ? 'mid' : 'lo'}`}>
              {item.confidence}% Match
            </span>
          )}
        </div>
        
        <span className="panel-track-row__artists">
          {item.artists || item.artist || 'Unknown Artist'}
        </span>
        
        {item.album && (
          <span className="panel-track-row__album">
            {item.album}{item.releaseYear ? ` (${item.releaseYear})` : ''}
            {item.durationMs ? ` · ${ms(item.durationMs)}` : ''}
          </span>
        )}

        {item.matchedWith && (
          <div className="panel-track-row__skipped-note">
            ↳ Skipped: {item.matchedWith}
          </div>
        )}

        {item.error && (
          <div className="panel-track-row__error-note">
            Reason: {item.error}
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * ReportTabPanel
 * Renders tab selectors in a card-box with a collapsible arrow on the far-right.
 */
export default function ReportTabPanel({ report, onRetry }) {
  const [activeTab, setActiveTab] = useState('added');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!report) return null;

  const { added = [], skippedDuplicate = [], notFound = [], failed = [], counts } = report;

  // Copies the raw track query lines to the clipboard
  function handleCopyNotFound() {
    const rawList = notFound.map(track => track.rawText || track.title).join('\n');
    navigator.clipboard.writeText(rawList);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const TABS = [
    { key: 'added', label: 'Added', count: counts.added },
    { key: 'skipped', label: 'Skipped', count: counts.skippedDuplicate },
    { key: 'notFound', label: 'Notfound', count: counts.notFound },
    { key: 'failed', label: 'Failed', count: counts.failed },
  ];

  return (
    <div className="rpt-panel">
      {/* Tabs Header with far-right collapse arrow toggle */}
      <div className={`rpt-panel__tabs-header ${isCollapsed ? 'rpt-panel__tabs-header--collapsed' : ''}`}>
        <div className="rpt-panel__tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`rpt-panel__tab-btn ${activeTab === tab.key ? 'rpt-panel__tab-btn--active' : ''}`}
              onClick={() => {
                setActiveTab(tab.key);
                setIsCollapsed(false); // Auto-expand when a tab is clicked
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Collapsible toggle arrow button */}
        <button
          type="button"
          className="rpt-panel__collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
        >
          <svg 
            className={`rpt-panel__collapse-chevron ${isCollapsed ? 'rpt-panel__collapse-chevron--collapsed' : ''}`} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      </div>

      {/* Tab Panel Body Content (hidden when collapsed) */}
      {!isCollapsed && (
        <div className="rpt-panel__content">
          {/* ADDED TAB */}
          {activeTab === 'added' && (
            <div className="tab-pane">
              {added.length === 0 ? (
                <p className="tab-pane__empty-state">No tracks were added.</p>
              ) : (
                <ul className="tab-pane__track-list">
                  {added.map((item, idx) => (
                    <TrackItemRow key={idx} item={item} />
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* SKIPPED TAB */}
          {activeTab === 'skipped' && (
            <div className="tab-pane">
              {skippedDuplicate.length === 0 ? (
                <p className="tab-pane__empty-state">No tracks were skipped.</p>
              ) : (
                <ul className="tab-pane__track-list">
                  {skippedDuplicate.map((item, idx) => (
                    <TrackItemRow key={idx} item={item} />
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* NOT FOUND TAB */}
          {activeTab === 'notFound' && (
            <div className="tab-pane">
              <div className="tab-pane__action-header">
                {notFound.length > 0 && (
                  <button 
                    type="button" 
                    className="tab-pane__copy-btn" 
                    onClick={handleCopyNotFound}
                  >
                    <svg className="tab-pane__copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    {copied ? 'Copied ✓' : 'Copy list'}
                  </button>
                )}
              </div>

              {notFound.length === 0 ? (
                <p className="tab-pane__empty-state">No tracks were not found.</p>
              ) : (
                <ul className="tab-pane__raw-list">
                  {notFound.map((item, idx) => (
                    <li key={idx} className="tab-pane__raw-item">
                      {item.rawText || item.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* FAILED TAB */}
          {activeTab === 'failed' && (
            <div className="tab-pane">
              {failed.length === 0 ? (
                <p className="tab-pane__empty-state">No tracks failed to write.</p>
              ) : (
                <div className="tab-pane__failures">
                  <p className="tab-pane__warning-note">
                    These songs could not be written to Spotify due to API or connection problems.
                  </p>
                  <ul className="tab-pane__track-list">
                    {failed.map((item, idx) => (
                      <TrackItemRow key={idx} item={item} isDanger={true} />
                    ))}
                  </ul>
                  <button 
                    type="button" 
                    className="tab-pane__retry-btn" 
                    onClick={onRetry}
                  >
                    Retry writing failed tracks
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
