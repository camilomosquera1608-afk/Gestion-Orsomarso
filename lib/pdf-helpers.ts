// PDF Helpers - Automatic metric hiding and data consistency
import type { CompetitionReportData } from './competition-report';

/**
 * Check if a metric has meaningful data
 */
export function hasMeaningfulData(value: number | undefined | null): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== 'number') return false;
  if (!Number.isFinite(value)) return false;
  return value > 0;
}

/**
 * Check if GPS data is available for a report
 */
export function hasGPSData(report: CompetitionReportData): boolean {
  const { stats, rows } = report;
  
  if (!stats) return false;
  
  return (
    hasMeaningfulData(stats.totalDistance) ||
    hasMeaningfulData(stats.playerLoad) ||
    hasMeaningfulData(stats.highSpeedDistance) ||
    hasMeaningfulData(stats.sprints) ||
    hasMeaningfulData(stats.acc) ||
    hasMeaningfulData(stats.dcc) ||
    hasMeaningfulData(stats.rhie) ||
    rows.some(row => 
      hasMeaningfulData(row.totalDistance) ||
      hasMeaningfulData(row.playerLoad) ||
      hasMeaningfulData(row.highSpeedDistance)
    )
  );
}

/**
 * Check if xG data is available
 */
export function hasXGData(report: CompetitionReportData): boolean {
  // This would check if eyeball stats contain xG data
  // For now, return false as placeholder
  return false;
}

/**
 * Check if eyeball stats are available
 */
export function hasEyeballData(report: CompetitionReportData): boolean {
  return !!report.match.eyeballStats;
}

/**
 * Normalize opponent name across the report
 * Ensures consistency between cover and internal pages
 */
export function normalizeOpponentName(report: CompetitionReportData): string {
  const { match } = report;
  
  // Use the opponent from the match summary as the source of truth
  let opponent = match.opponent || '';
  
  // Remove common variations and normalize
  opponent = opponent
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^FC\s+/i, '')
    .replace(/^Club\s+/i, '')
    .replace(/\s+FC$/i, '')
    .replace(/\s+Club$/i, '');
  
  return opponent;
}

/**
 * Get consistent opponent name for all sections
 */
export function getConsistentOpponent(report: CompetitionReportData): {
  cover: string;
  internal: string;
  isConsistent: boolean;
} {
  const normalized = normalizeOpponentName(report);
  const coverName = report.match.opponent || '';
  const internalName = normalized;
  
  return {
    cover: coverName,
    internal: internalName,
    isConsistent: coverName === internalName,
  };
}

/**
 * Filter out empty metrics from an object
 */
export function filterEmptyMetrics<T extends Record<string, any>>(
  data: T,
  checkFn: (value: any) => boolean = hasMeaningfulData
): Partial<T> {
  const result: Partial<T> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (checkFn(value)) {
      result[key as keyof T] = value;
    }
  }
  
  return result;
}

/**
 * Get available metrics for a report section
 */
export function getAvailableMetrics(report: CompetitionReportData) {
  return {
    hasGPS: hasGPSData(report),
    hasXG: hasXGData(report),
    hasEyeball: hasEyeballData(report),
    hasGoals: hasMeaningfulData(report.stats?.goals),
    hasAssists: hasMeaningfulData(report.stats?.assists),
    hasCards: hasMeaningfulData(report.stats?.yellowCards) || hasMeaningfulData(report.stats?.redCards),
    hasDistance: hasMeaningfulData(report.stats?.totalDistance),
    hasPlayerLoad: hasMeaningfulData(report.stats?.playerLoad),
    hasHSR: hasMeaningfulData(report.stats?.highSpeedDistance),
    hasSprints: hasMeaningfulData(report.stats?.sprints),
    hasNeuromuscular: hasMeaningfulData(report.stats?.acc) || hasMeaningfulData(report.stats?.dcc) || hasMeaningfulData(report.stats?.rhie),
  };
}

/**
 * Format number for PDF display
 */
export function formatPDFNumber(value: number | undefined | null, decimals = 1): string {
  if (!hasMeaningfulData(value)) return '—';
  return (value as number).toFixed(decimals);
}

/**
 * Format percentage for PDF display
 */
export function formatPDFPercentage(value: number | undefined | null, decimals = 0): string {
  if (!hasMeaningfulData(value)) return '—';
  return `${(value as number).toFixed(decimals)}%`;
}

/**
 * Get tone based on performance threshold
 */
export function getPerformanceTone(
  value: number,
  thresholds: { good: number; warning: number },
  higherIsBetter = true
): 'green' | 'amber' | 'gray' {
  if (higherIsBetter) {
    if (value >= thresholds.good) return 'green';
    if (value >= thresholds.warning) return 'amber';
    return 'gray';
  } else {
    if (value <= thresholds.good) return 'green';
    if (value <= thresholds.warning) return 'amber';
    return 'gray';
  }
}

/**
 * Validate report data consistency
 */
export function validateReportConsistency(report: CompetitionReportData): {
  isConsistent: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check opponent name consistency
  const opponentCheck = getConsistentOpponent(report);
  if (!opponentCheck.isConsistent) {
    issues.push(`Inconsistencia en nombre del rival: "${opponentCheck.cover}" vs "${opponentCheck.internal}"`);
  }
  
  // Check for negative values that shouldn't be negative
  if (report.stats?.totalDistance && report.stats.totalDistance < 0) {
    issues.push('Distancia total negativa');
  }
  
  if (report.stats?.goals && report.stats.goals < 0) {
    issues.push('Goles negativos');
  }
  
  // Check for impossible values
  if (report.stats?.minutes && report.stats.minutes > 270) {
    issues.push('Minutos totales exceden límite razonable (270 min)');
  }
  
  return {
    isConsistent: issues.length === 0,
    issues,
  };
}
