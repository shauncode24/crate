import React from 'react';

/**
 * ReportFooterActions
 * Renders retry buttons and reset flow triggers at the bottom.
 */
export default function ReportFooterActions({ hasFailures = false, onRetry, onReset }) {
  return (
    <div className="rpt-footer">
      {hasFailures && (
        <button 
          type="button" 
          className="rpt-footer__retry-btn" 
          onClick={onRetry}
        >
          <svg className="rpt-footer__retry-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Retry failed tracks
        </button>
      )}

      <button 
        type="button" 
        className="rpt-footer__reset-btn" 
        onClick={onReset}
      >
        Import another list
      </button>
    </div>
  );
}
