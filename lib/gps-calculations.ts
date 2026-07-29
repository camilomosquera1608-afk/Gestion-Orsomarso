// GPS Calculations System - Automatic Derived Metrics
// Professional calculation system for GPS-derived metrics and team statistics

import type {
  GPSEditRow,
  GPSEditableData,
  GPSCalculatedMetrics
} from './gps-editor-types';

/**
 * Calculate team averages from GPS data
 */
export function calculateTeamAverages(rows: GPSEditRow[]): {
  totalDistance: number;
  metersPerMinute: number;
  highSpeedDistance: number;
  playerLoad: number;
  sprints: number;
  acc: number;
  dcc: number;
  rhie: number;
  maxVelocity: number;
} {
  const validRows = rows.filter(row => !row.isDeleted);
  
  if (validRows.length === 0) {
    return {
      totalDistance: 0,
      metersPerMinute: 0,
      highSpeedDistance: 0,
      playerLoad: 0,
      sprints: 0,
      acc: 0,
      dcc: 0,
      rhie: 0,
      maxVelocity: 0,
    };
  }
  
  const totals = validRows.reduce((acc, row) => {
    const data = row.currentData;
    return {
      totalDistance: acc.totalDistance + data.totalDistance,
      metersPerMinute: acc.metersPerMinute + data.metersPerMinute,
      highSpeedDistance: acc.highSpeedDistance + data.highSpeedDistance,
      playerLoad: acc.playerLoad + data.playerLoad,
      sprints: acc.sprints + data.sprints,
      acc: acc.acc + data.acc,
      dcc: acc.dcc + data.dcc,
      rhie: acc.rhie + data.rhie,
      maxVelocity: acc.maxVelocity + data.maxVelocity,
    };
  }, {
    totalDistance: 0,
    metersPerMinute: 0,
    highSpeedDistance: 0,
    playerLoad: 0,
    sprints: 0,
    acc: 0,
    dcc: 0,
    rhie: 0,
    maxVelocity: 0,
  });
  
  const count = validRows.length;
  
  return {
    totalDistance: totals.totalDistance / count,
    metersPerMinute: totals.metersPerMinute / count,
    highSpeedDistance: totals.highSpeedDistance / count,
    playerLoad: totals.playerLoad / count,
    sprints: totals.sprints / count,
    acc: totals.acc / count,
    dcc: totals.dcc / count,
    rhie: totals.rhie / count,
    maxVelocity: totals.maxVelocity / count,
  };
}

/**
 * Calculate rankings for a specific metric
 */
export function calculateRankings(
  rows: GPSEditRow[],
  metric: keyof GPSEditableData,
  ascending: boolean = false
): GPSEditRow[] {
  const validRows = rows.filter(row => !row.isDeleted);
  
  return [...validRows].sort((a, b) => {
    const aValue = a.currentData[metric] as number;
    const bValue = b.currentData[metric] as number;
    
    if (ascending) {
      return aValue - bValue;
    } else {
      return bValue - aValue;
    }
  });
}

/**
 * Get top performers for each metric
 */
export function getTopPerformers(rows: GPSEditRow[]): {
  totalDistance: GPSEditRow | null;
  metersPerMinute: GPSEditRow | null;
  highSpeedDistance: GPSEditRow | null;
  playerLoad: GPSEditRow | null;
  sprints: GPSEditRow | null;
  maxVelocity: GPSEditRow | null;
  acc: GPSEditRow | null;
  dcc: GPSEditRow | null;
  rhie: GPSEditRow | null;
} {
  const validRows = rows.filter(row => !row.isDeleted);
  
  if (validRows.length === 0) {
    return {
      totalDistance: null,
      metersPerMinute: null,
      highSpeedDistance: null,
      playerLoad: null,
      sprints: null,
      maxVelocity: null,
      acc: null,
      dcc: null,
      rhie: null,
    };
  }
  
  return {
    totalDistance: calculateRankings(rows, 'totalDistance')[0] || null,
    metersPerMinute: calculateRankings(rows, 'metersPerMinute')[0] || null,
    highSpeedDistance: calculateRankings(rows, 'highSpeedDistance')[0] || null,
    playerLoad: calculateRankings(rows, 'playerLoad')[0] || null,
    sprints: calculateRankings(rows, 'sprints')[0] || null,
    maxVelocity: calculateRankings(rows, 'maxVelocity')[0] || null,
    acc: calculateRankings(rows, 'acc')[0] || null,
    dcc: calculateRankings(rows, 'dcc')[0] || null,
    rhie: calculateRankings(rows, 'rhie')[0] || null,
  };
}

/**
 * Calculate percentiles for a player within the team
 */
export function calculatePlayerPercentile(
  playerRow: GPSEditRow,
  allRows: GPSEditRow[],
  metric: keyof GPSEditableData
): number {
  const validRows = allRows.filter(row => !row.isDeleted);
  
  if (validRows.length === 0) return 0;
  
  const playerValue = playerRow.currentData[metric] as number;
  const values = validRows.map(row => row.currentData[metric] as number);
  
  const sortedValues = [...values].sort((a, b) => a - b);
  const playerIndex = sortedValues.indexOf(playerValue);
  
  if (playerIndex === -1) return 0;
  
  return (playerIndex / (sortedValues.length - 1)) * 100;
}

/**
 * Calculate comprehensive GPS metrics
 */
export function calculateComprehensiveMetrics(
  rows: GPSEditRow[]
): GPSCalculatedMetrics {
  const validRows = rows.filter(row => !row.isDeleted);
  
  const teamAverage = calculateTeamAverages(rows);
  const rankings = {
    totalDistance: calculateRankings(rows, 'totalDistance'),
    metersPerMinute: calculateRankings(rows, 'metersPerMinute'),
    highSpeedDistance: calculateRankings(rows, 'highSpeedDistance'),
    playerLoad: calculateRankings(rows, 'playerLoad'),
    sprints: calculateRankings(rows, 'sprints'),
  };
  const leaders = getTopPerformers(rows);
  
  return {
    teamAverage,
    rankings,
    leaders,
  };
}

/**
 * Calculate derived metrics from base data
 * Automatically calculates m/min and playerLoad/min when base values change
 */
export function calculateDerivedMetrics(data: GPSEditableData): GPSEditableData {
  const derived = { ...data };
  
  // Calculate meters per minute if not provided or if base values changed
  if (data.minutes > 0) {
    if (!data.metersPerMinute || data.metersPerMinute === 0) {
      derived.metersPerMinute = data.totalDistance / data.minutes;
    }
    
    // Calculate player load per minute if not provided or if base values changed
    if (!data.playerLoadPerMin || data.playerLoadPerMin === 0) {
      derived.playerLoadPerMin = data.playerLoad / data.minutes;
    }
  }
  
  return derived;
}

/**
 * Recalculate all derived metrics for a row
 */
export function recalculateRowMetrics(row: GPSEditRow): GPSEditRow {
  const derivedData = calculateDerivedMetrics(row.currentData);
  
  return {
    ...row,
    currentData: derivedData,
  };
}

/**
 * Recalculate all derived metrics for multiple rows
 */
export function recalculateAllMetrics(rows: GPSEditRow[]): GPSEditRow[] {
  return rows.map(row => recalculateRowMetrics(row));
}

/**
 * Calculate team totals
 */
export function calculateTeamTotals(rows: GPSEditRow[]): {
  totalDistance: number;
  totalPlayerLoad: number;
  totalSprints: number;
  totalAcc: number;
  totalDcc: number;
  totalRhie: number;
  totalMinutes: number;
} {
  const validRows = rows.filter(row => !row.isDeleted);
  
  return validRows.reduce((acc, row) => {
    const data = row.currentData;
    return {
      totalDistance: acc.totalDistance + data.totalDistance,
      totalPlayerLoad: acc.totalPlayerLoad + data.playerLoad,
      totalSprints: acc.totalSprints + data.sprints,
      totalAcc: acc.totalAcc + data.acc,
      totalDcc: acc.totalDcc + data.dcc,
      totalRhie: acc.totalRhie + data.rhie,
      totalMinutes: acc.totalMinutes + data.minutes,
    };
  }, {
    totalDistance: 0,
    totalPlayerLoad: 0,
    totalSprints: 0,
    totalAcc: 0,
    totalDcc: 0,
    totalRhie: 0,
    totalMinutes: 0,
  });
}

/**
 * Calculate intensity metrics
 */
export function calculateIntensityMetrics(rows: GPSEditRow[]): {
  highIntensityDistance: number;
  highIntensityPercentage: number;
  sprintDistance: number;
  sprintPercentage: number;
  averageIntensity: number;
} {
  const validRows = rows.filter(row => !row.isDeleted);
  
  if (validRows.length === 0) {
    return {
      highIntensityDistance: 0,
      highIntensityPercentage: 0,
      sprintDistance: 0,
      sprintPercentage: 0,
      averageIntensity: 0,
    };
  }
  
  const totals = validRows.reduce((acc, row) => {
    const data = row.currentData;
    return {
      highIntensityDistance: acc.highIntensityDistance + data.highSpeedDistance,
      sprintDistance: acc.sprintDistance + data.sprintDistance,
      totalDistance: acc.totalDistance + data.totalDistance,
      totalPlayerLoad: acc.totalPlayerLoad + data.playerLoad,
    };
  }, {
    highIntensityDistance: 0,
    sprintDistance: 0,
    totalDistance: 0,
    totalPlayerLoad: 0,
  });
  
  const highIntensityPercentage = totals.totalDistance > 0
    ? (totals.highIntensityDistance / totals.totalDistance) * 100
    : 0;
  
  const sprintPercentage = totals.totalDistance > 0
    ? (totals.sprintDistance / totals.totalDistance) * 100
    : 0;
  
  const averageIntensity = validRows.length > 0
    ? totals.totalPlayerLoad / validRows.length
    : 0;
  
  return {
    highIntensityDistance: totals.highIntensityDistance,
    highIntensityPercentage,
    sprintDistance: totals.sprintDistance,
    sprintPercentage,
    averageIntensity,
  };
}

/**
 * Calculate workload metrics
 */
export function calculateWorkloadMetrics(rows: GPSEditRow[]): {
  acuteWorkload: number;
  chronicWorkload: number;
  acuteChronicRatio: number;
  averagePlayerLoad: number;
  totalWorkload: number;
} {
  const validRows = rows.filter(row => !row.isDeleted);
  
  if (validRows.length === 0) {
    return {
      acuteWorkload: 0,
      chronicWorkload: 0,
      acuteChronicRatio: 0,
      averagePlayerLoad: 0,
      totalWorkload: 0,
    };
  }
  
  const totalPlayerLoad = validRows.reduce((acc, row) => acc + row.currentData.playerLoad, 0);
  const averagePlayerLoad = totalPlayerLoad / validRows.length;
  
  // Simplified acute/chronic calculation (would need historical data for real implementation)
  const acuteWorkload = averagePlayerLoad * 7; // 7-day acute
  const chronicWorkload = averagePlayerLoad * 28; // 28-day chronic
  const acuteChronicRatio = chronicWorkload > 0 ? acuteWorkload / chronicWorkload : 0;
  
  return {
    acuteWorkload,
    chronicWorkload,
    acuteChronicRatio,
    averagePlayerLoad,
    totalWorkload: totalPlayerLoad,
  };
}

/**
 * Format GPS metric for display
 */
export function formatGPSMetric(
  value: number,
  metric: keyof GPSEditableData
): string {
  const formatters: Record<string, (value: number) => string> = {
    totalDistance: (v) => `${(v / 1000).toFixed(1)} km`,
    metersPerMinute: (v) => `${v.toFixed(1)} m/min`,
    highSpeedDistance: (v) => `${(v / 1000).toFixed(2)} km`,
    sprintDistance: (v) => `${(v / 1000).toFixed(2)} km`,
    maxVelocity: (v) => `${v.toFixed(1)} m/s`,
    playerLoad: (v) => v.toFixed(0),
    playerLoadPerMin: (v) => v.toFixed(1),
    minutes: (v) => `${v.toFixed(0)} min`,
    sprints: (v) => v.toFixed(0),
    acc: (v) => v.toFixed(0),
    dcc: (v) => v.toFixed(0),
    rhie: (v) => v.toFixed(0),
    hsr: (v) => v.toFixed(0),
    ima: (v) => v.toFixed(0),
  };
  
  const formatter = formatters[metric];
  return formatter ? formatter(value) : value.toString();
}
