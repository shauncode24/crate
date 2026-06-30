import React, { useState } from 'react';
import './Step4Report.css';
import ImportHeader from './report/ImportHeader.jsx';
import MetricsDashboard from './report/MetricsDashboard.jsx';
import ReportTabPanel from './report/ReportTabPanel.jsx';
import ReportFooterActions from './report/ReportFooterActions.jsx';

/**
 * Step4Report — import result dashboard.
 * Orchestrates ImportHeader, MetricsDashboard, ReportTabPanel, and ReportFooterActions.
 */
export default function Step4Report({
  commitState = 'idle',
  report = null,
  runMetrics = null,
  playlistId = '',
  onRetry,
  onReset,
}) {
  const [activeTab, setActiveTab] = useState('added');

  // Loading indicator view
  if (commitState === 'running') {
    return (
      <div className="rpt-loading">
        <div className="rpt-loading__spinner" aria-hidden="true" />
        <h2 className="rpt-loading__title">Adding songs to Spotify…</h2>
        <p className="rpt-loading__sub">Please do not close or refresh this page.</p>
      </div>
    );
  }

  if (!report) return null;

  const hasFailures = (report.failed ?? []).length > 0;
  const addedCount = report.counts?.added ?? 0;

  return (
    <div className="rpt">
      {/* 1. Header confirmation circle & open Spotify button */}
      <ImportHeader 
        addedCount={addedCount} 
        playlistId={playlistId} 
        hasFailures={hasFailures} 
      />

      {/* 2. Run metrics dashboard summary cards */}
      <MetricsDashboard runMetrics={runMetrics} />

      {/* 3. Detailed track categories list tabs */}
      <ReportTabPanel 
        report={report} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onRetry={onRetry} 
      />

      {/* 4. Footer retry / import another list actions */}
      <ReportFooterActions 
        hasFailures={hasFailures} 
        onRetry={onRetry} 
        onReset={onReset} 
      />
    </div>
  );
}
