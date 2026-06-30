import React from 'react';

/**
 * MetricCard presentational component
 */
function MetricCard({ label, value, highlightType = 'default' }) {
  let cardClass = 'rpt-metric-card';
  if (highlightType === 'success') {
    cardClass += ' rpt-metric-card--success';
  } else if (highlightType === 'warning') {
    cardClass += ' rpt-metric-card--warning';
  }

  return (
    <div className={cardClass}>
      <span className="rpt-metric-card__value">{value}</span>
      <span className="rpt-metric-card__label">{label}</span>
    </div>
  );
}

/**
 * MetricsDashboard
 * Renders a row of metric highlights for the import job run.
 */
export default function MetricsDashboard({ runMetrics }) {
  if (!runMetrics) return null;

  // Determine highlight type for cache hit rate
  const isHighCacheHit = runMetrics.cacheHitRate >= 0.5;

  return (
    <div className="rpt-dashboard">
      <h3 className="rpt-dashboard__title">IMPORT SUMMARY</h3>
      
      <div className="rpt-dashboard__grid">
        {/* Latency */}
        <MetricCard 
          label="Avg latency" 
          value={`${runMetrics.avgLatencyMs}ms`} 
        />

        {/* Confidence */}
        <MetricCard 
          label="Avg confidence" 
          value={`${runMetrics.avgTopConfidence}%`} 
        />

        {/* Cache Hit Rate */}
        <MetricCard 
          label="Cache hit rate" 
          value={`${Math.round(runMetrics.cacheHitRate * 100)}%`}
          highlightType={isHighCacheHit ? 'success' : 'default'}
        />

        {/* LLM Fallback */}
        <MetricCard 
          label="LLM fallback" 
          value={`${Math.round(runMetrics.llmFallbackRate * 100)}%`} 
        />

        {/* Retries */}
        <MetricCard 
          label="Retries" 
          value={runMetrics.retryCount} 
          highlightType={runMetrics.retryCount > 0 ? 'warning' : 'default'}
        />
      </div>
    </div>
  );
}
