import { Player, DailyInternalLoadRecord, DailyExternalLoadRecord, DailyWellnessRecord, CompetitionRecord } from '@/lib/schemas';

export interface PerformanceMetrics {
  playerId: string;
  playerName: string;
  position: string;
  category: string;
  
  // Load Metrics
  avgWeeklyLoad: number;
  maxWeeklyLoad: number;
  loadTrend: 'increasing' | 'decreasing' | 'stable';
  acuteChronicRatio: number;
  
  // Wellness Metrics
  avgWellness: number;
  wellnessTrend: 'increasing' | 'decreasing' | 'stable';
  wellnessAdherence: number;
  
  // Physical Metrics
  avgDistance: number;
  avgMaxVelocity: number;
  avgHSR: number;
  avgSprintDistance: number;
  
  // Competition Metrics
  avgMinutesPlayed: number;
  goalsPer90: number;
  assistsPer90: number;
  
  // Injury Risk
  injuryRiskScore: number;
  fatigueLevel: number;
  
  // Progress vs Targets
  loadTargetProgress: number;
  wellnessTargetProgress: number;
  
  // Percentiles (vs position group)
  loadPercentile: number;
  wellnessPercentile: number;
  physicalPercentile: number;
}

export interface PlayerDNA {
  playerId: string;
  playerName: string;
  
  // Key performance indicators
  keyMetrics: {
    label: string;
    value: number;
    target: number;
    status: 'above' | 'below' | 'on_track' | 'stable';
  }[];
  
  // Strengths
  strengths: string[];
  
  // Areas for improvement
  weaknesses: string[];
  
  // Optimal training zones
  optimalZones: {
    weeklyLoad: { min: number; max: number };
    hsr: { min: number; max: number };
    sprintDistance: { min: number; max: number };
    wellness: { min: number; max: number };
  };
  
  // Recovery profile
  recoveryProfile: {
    optimalRestDays: number;
    recoveryRate: 'fast' | 'normal' | 'slow';
    postMatchRecoveryTime: number;
  };
}

export interface PerformanceComparison {
  playerId: string;
  playerName: string;
  comparisonToPosition: PerformanceMetrics;
  comparisonToCategory: PerformanceMetrics;
  comparisonToTeam: PerformanceMetrics;
  ranking: {
    position: number;
    category: number;
    team: number;
  };
}

/**
 * Calculate comprehensive performance metrics for a player
 */
export function calculatePerformanceMetrics(
  player: Player,
  internalLoads: DailyInternalLoadRecord[],
  externalLoads: DailyExternalLoadRecord[],
  wellnessRecords: DailyWellnessRecord[],
  competitionRecords: CompetitionRecord[],
  referenceDate: string,
  daysToAnalyze: number = 28
): PerformanceMetrics {
  const startDate = getStartDate(referenceDate, daysToAnalyze);
  
  // Filter records by date range
  const filteredInternal = internalLoads.filter(l => l.date >= startDate && l.date <= referenceDate && l.playerId === player.id);
  const filteredExternal = externalLoads.filter(l => l.date >= startDate && l.date <= referenceDate && l.playerId === player.id);
  const filteredWellness = wellnessRecords.filter(w => w.date >= startDate && w.date <= referenceDate && w.playerId === player.id);
  const filteredCompetition = competitionRecords.filter(c => c.date >= startDate && c.date <= referenceDate && c.playerId === player.id);
  
  // Calculate load metrics
  const dailyLoads = calculateDailyLoads(filteredInternal, filteredExternal, filteredCompetition);
  const weeklyLoads = calculateWeeklyLoads(dailyLoads, referenceDate);
  const avgWeeklyLoad = weeklyLoads.reduce((a, b) => a + b, 0) / weeklyLoads.length;
  const maxWeeklyLoad = Math.max(...weeklyLoads);
  const loadTrend = calculateTrend(weeklyLoads);
  const acuteChronicRatio = calculateAcuteChronicRatio(weeklyLoads);
  
  // Calculate wellness metrics
  const wellnessScores = filteredWellness.map(calculateWellnessScore);
  const avgWellness = wellnessScores.reduce((a, b) => a + b, 0) / wellnessScores.length || 0;
  const wellnessTrend = calculateTrend(wellnessScores);
  const wellnessAdherence = calculateAdherence(filteredWellness, daysToAnalyze);
  
  // Calculate physical metrics
  const avgDistance = filteredExternal.reduce((sum, e) => sum + (e.totalDistance || 0), 0) / filteredExternal.length || 0;
  const avgMaxVelocity = filteredExternal.reduce((sum, e) => sum + (e.maxVelocity || 0), 0) / filteredExternal.length || 0;
  const avgHSR = filteredExternal.reduce((sum, e) => sum + (e.highSpeedDistance || 0), 0) / filteredExternal.length || 0;
  const avgSprintDistance = filteredExternal.reduce((sum, e) => sum + (e.sprintDistance || 0), 0) / filteredExternal.length || 0;
  
  // Calculate competition metrics
  const avgMinutesPlayed = filteredCompetition.reduce((sum, c) => sum + c.minutesPlayed, 0) / filteredCompetition.length || 0;
  const totalMinutes = filteredCompetition.reduce((sum, c) => sum + c.minutesPlayed, 0);
  const goalsPer90 = totalMinutes > 0 ? (filteredCompetition.reduce((sum, c) => sum + c.goals, 0) / totalMinutes) * 90 : 0;
  const assistsPer90 = totalMinutes > 0 ? (filteredCompetition.reduce((sum, c) => sum + c.assists, 0) / totalMinutes) * 90 : 0;
  
  // Calculate injury risk
  const injuryRiskScore = calculateInjuryRiskScore(acuteChronicRatio, avgWellness, loadTrend);
  const fatigueLevel = calculateFatigueLevel(weeklyLoads, wellnessScores);
  
  // Calculate progress vs targets
  const loadTargetProgress = player.targetWeeklyLoad ? (avgWeeklyLoad / player.targetWeeklyLoad) * 100 : 100;
  const wellnessTargetProgress = player.baselineWellness ? (avgWellness / player.baselineWellness) * 100 : 100;
  
  return {
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    category: player.category || 'Sub20',
    avgWeeklyLoad: Math.round(avgWeeklyLoad),
    maxWeeklyLoad: Math.round(maxWeeklyLoad),
    loadTrend,
    acuteChronicRatio: Math.round(acuteChronicRatio * 100) / 100,
    avgWellness: Math.round(avgWellness * 10) / 10,
    wellnessTrend,
    wellnessAdherence: Math.round(wellnessAdherence * 100),
    avgDistance: Math.round(avgDistance),
    avgMaxVelocity: Math.round(avgMaxVelocity * 10) / 10,
    avgHSR: Math.round(avgHSR),
    avgSprintDistance: Math.round(avgSprintDistance),
    avgMinutesPlayed: Math.round(avgMinutesPlayed),
    goalsPer90: Math.round(goalsPer90 * 100) / 100,
    assistsPer90: Math.round(assistsPer90 * 100) / 100,
    injuryRiskScore: Math.round(injuryRiskScore * 100) / 100,
    fatigueLevel: Math.round(fatigueLevel * 100) / 100,
    loadTargetProgress: Math.round(loadTargetProgress),
    wellnessTargetProgress: Math.round(wellnessTargetProgress),
    loadPercentile: 0, // Will be calculated when comparing to group
    wellnessPercentile: 0,
    physicalPercentile: 0,
  };
}

/**
 * Generate Player DNA - personalized performance profile
 */
export function generatePlayerDNA(
  player: Player,
  metrics: PerformanceMetrics
): PlayerDNA {
  const keyMetrics = [
    {
      label: 'Carga semanal',
      value: metrics.avgWeeklyLoad,
      target: player.targetWeeklyLoad || 3000,
      status: (metrics.avgWeeklyLoad >= (player.targetWeeklyLoad || 3000) * 0.9 ? 'on_track' : 'below') as 'above' | 'below' | 'on_track' | 'stable',
    },
    {
      label: 'Wellness',
      value: metrics.avgWellness,
      target: player.baselineWellness || 4,
      status: (metrics.avgWellness >= (player.baselineWellness || 4) * 0.9 ? 'on_track' : 'below') as 'above' | 'below' | 'on_track' | 'stable',
    },
    {
      label: 'Distancia alta velocidad',
      value: metrics.avgHSR,
      target: player.targetWeeklyHsr || 500,
      status: (metrics.avgHSR >= (player.targetWeeklyHsr || 500) * 0.9 ? 'on_track' : 'below') as 'above' | 'below' | 'on_track' | 'stable',
    },
    {
      label: 'Distancia sprint',
      value: metrics.avgSprintDistance,
      target: player.targetWeeklySprintDistance || 200,
      status: (metrics.avgSprintDistance >= (player.targetWeeklySprintDistance || 200) * 0.9 ? 'on_track' : 'below') as 'above' | 'below' | 'on_track' | 'stable',
    },
  ];
  
  const strengths = identifyStrengths(metrics, player);
  const weaknesses = identifyWeaknesses(metrics, player);
  
  const optimalZones = {
    weeklyLoad: {
      min: Math.round((player.targetWeeklyLoad || 3000) * 0.8),
      max: Math.round((player.targetWeeklyLoad || 3000) * 1.2),
    },
    hsr: {
      min: Math.round((player.targetWeeklyHsr || 500) * 0.8),
      max: Math.round((player.targetWeeklyHsr || 500) * 1.2),
    },
    sprintDistance: {
      min: Math.round((player.targetWeeklySprintDistance || 200) * 0.8),
      max: Math.round((player.targetWeeklySprintDistance || 200) * 1.2),
    },
    wellness: {
      min: 3.5,
      max: 5,
    },
  };
  
  const recoveryProfile = calculateRecoveryProfile(metrics, player);
  
  return {
    playerId: player.id,
    playerName: player.name,
    keyMetrics,
    strengths,
    weaknesses,
    optimalZones,
    recoveryProfile,
  };
}

/**
 * Compare player performance to different groups
 */
export function comparePlayerPerformance(
  playerMetrics: PerformanceMetrics,
  positionGroup: PerformanceMetrics[],
  categoryGroup: PerformanceMetrics[],
  teamGroup: PerformanceMetrics[]
): PerformanceComparison {
  const positionAvg = calculateGroupAverage(positionGroup);
  const categoryAvg = calculateGroupAverage(categoryGroup);
  const teamAvg = calculateGroupAverage(teamGroup);
  
  const positionRanking = calculateRanking(playerMetrics.avgWeeklyLoad, positionGroup.map(m => m.avgWeeklyLoad));
  const categoryRanking = calculateRanking(playerMetrics.avgWeeklyLoad, categoryGroup.map(m => m.avgWeeklyLoad));
  const teamRanking = calculateRanking(playerMetrics.avgWeeklyLoad, teamGroup.map(m => m.avgWeeklyLoad));
  
  return {
    playerId: playerMetrics.playerId,
    playerName: playerMetrics.playerName,
    comparisonToPosition: positionAvg,
    comparisonToCategory: categoryAvg,
    comparisonToTeam: teamAvg,
    ranking: {
      position: positionRanking,
      category: categoryRanking,
      team: teamRanking,
    },
  };
}

// Helper functions

function getStartDate(referenceDate: string, days: number): string {
  const date = new Date(referenceDate);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function calculateDailyLoads(
  internal: DailyInternalLoadRecord[],
  external: DailyExternalLoadRecord[],
  competition: CompetitionRecord[]
): Map<string, number> {
  const dailyLoads = new Map<string, number>();
  
  internal.forEach(record => {
    const load = record.rpe * record.duration;
    dailyLoads.set(record.date, (dailyLoads.get(record.date) || 0) + load);
  });
  
  external.forEach(record => {
    const load = record.playerLoad || (record.totalDistance || 0) / 10 + record.acc + record.dcc + (record.sprints * 4) + record.rhie;
    dailyLoads.set(record.date, (dailyLoads.get(record.date) || 0) + load);
  });
  
  competition.forEach(record => {
    const load = record.playerLoad || (record.totalDistance || 0) / 10 + (record.acc || 0) + (record.dcc || 0);
    dailyLoads.set(record.date, (dailyLoads.get(record.date) || 0) + load);
  });
  
  return dailyLoads;
}

function calculateWeeklyLoads(dailyLoads: Map<string, number>, referenceDate: string): number[] {
  const weeks: number[] = [];
  const date = new Date(referenceDate);
  
  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - (i * 7) - 6);
    const weekEnd = new Date(date);
    weekEnd.setDate(weekEnd.getDate() - (i * 7));
    
    let weekLoad = 0;
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      weekLoad += dailyLoads.get(dateStr) || 0;
    }
    
    weeks.unshift(weekLoad);
  }
  
  return weeks;
}

function calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
  if (values.length < 2) return 'stable';
  
  const recent = values.slice(-3);
  const earlier = values.slice(0, -3);
  
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = earlier.length > 0 ? earlier.reduce((a, b) => a + b, 0) / earlier.length : recentAvg;
  
  const change = ((recentAvg - earlierAvg) / earlierAvg) * 100;
  
  if (change > 5) return 'increasing';
  if (change < -5) return 'decreasing';
  return 'stable';
}

function calculateAcuteChronicRatio(weeklyLoads: number[]): number {
  if (weeklyLoads.length < 4) return 1;
  
  const acute = weeklyLoads.slice(-2).reduce((a, b) => a + b, 0) / 2;
  const chronic = weeklyLoads.slice(-4).reduce((a, b) => a + b, 0) / 4;
  
  return chronic > 0 ? acute / chronic : 1;
}

function calculateWellnessScore(record: DailyWellnessRecord): number {
  return (record.sleep + record.fatigue + record.stress + record.musclePain + record.mood) / 5;
}

function calculateAdherence(records: DailyWellnessRecord[], totalDays: number): number {
  return records.length / totalDays;
}

function calculateInjuryRiskScore(acuteChronicRatio: number, avgWellness: number, loadTrend: string): number {
  let risk = 0;
  
  // ACWR risk
  if (acuteChronicRatio > 1.5) risk += 0.4;
  else if (acuteChronicRatio > 1.3) risk += 0.2;
  
  // Wellness risk
  if (avgWellness < 3) risk += 0.4;
  else if (avgWellness < 3.5) risk += 0.2;
  
  // Load trend risk
  if (loadTrend === 'increasing') risk += 0.2;
  
  return Math.min(risk, 1);
}

function calculateFatigueLevel(weeklyLoads: number[], wellnessScores: number[]): number {
  if (weeklyLoads.length === 0 || wellnessScores.length === 0) return 0;
  
  const recentLoad = weeklyLoads[weeklyLoads.length - 1];
  const avgLoad = weeklyLoads.reduce((a, b) => a + b, 0) / weeklyLoads.length;
  const recentWellness = wellnessScores[wellnessScores.length - 1];
  
  let fatigue = 0;
  
  if (recentLoad > avgLoad * 1.2) fatigue += 0.4;
  if (recentWellness < 3.5) fatigue += 0.4;
  if (recentLoad > avgLoad * 1.2 && recentWellness < 3.5) fatigue += 0.2;
  
  return Math.min(fatigue, 1);
}

function identifyStrengths(metrics: PerformanceMetrics, player: Player): string[] {
  const strengths: string[] = [];
  
  if (metrics.avgWellness >= 4.5) strengths.push('Alta adherencia al wellness');
  if (metrics.avgDistance >= 8000) strengths.push('Alta capacidad aeróbica');
  if (metrics.avgMaxVelocity >= 30) strengths.push('Alta velocidad máxima');
  if (metrics.avgHSR >= 400) strengths.push('Buen trabajo en alta intensidad');
  if (metrics.goalsPer90 >= 0.5) strengths.push('Buena capacidad goleadora');
  if (metrics.assistsPer90 >= 0.3) strengths.push('Buena capacidad asistencial');
  if (metrics.injuryRiskScore <= 0.3) strengths.push('Bajo riesgo de lesión');
  if (metrics.wellnessAdherence >= 0.8) strengths.push('Alta consistencia en reportes');
  
  return strengths;
}

function identifyWeaknesses(metrics: PerformanceMetrics, player: Player): string[] {
  const weaknesses: string[] = [];
  
  if (metrics.avgWellness < 3.5) weaknesses.push('Wellness por debajo del óptimo');
  if (metrics.avgDistance < 6000) weaknesses.push('Capacidad aeróbica a mejorar');
  if (metrics.avgMaxVelocity < 28) weaknesses.push('Velocidad máxima a mejorar');
  if (metrics.avgHSR < 300) weaknesses.push('Trabajo en alta intensidad limitado');
  if (metrics.injuryRiskScore >= 0.6) weaknesses.push('Alto riesgo de lesión');
  if (metrics.wellnessAdherence < 0.6) weaknesses.push('Baja consistencia en reportes');
  if (metrics.loadTrend === 'decreasing') weaknesses.push('Tendencia de carga decreciente');
  if (metrics.fatigueLevel >= 0.6) weaknesses.push('Nivel de fatiga elevado');
  
  return weaknesses;
}

function calculateRecoveryProfile(metrics: PerformanceMetrics, player: Player): PlayerDNA['recoveryProfile'] {
  let recoveryRate: 'fast' | 'normal' | 'slow' = 'normal';
  
  if (metrics.avgWellness >= 4.5 && metrics.injuryRiskScore <= 0.3) {
    recoveryRate = 'fast';
  } else if (metrics.avgWellness < 3.5 || metrics.injuryRiskScore >= 0.6) {
    recoveryRate = 'slow';
  }
  
  return {
    optimalRestDays: recoveryRate === 'fast' ? 1 : recoveryRate === 'slow' ? 3 : 2,
    recoveryRate,
    postMatchRecoveryTime: recoveryRate === 'fast' ? 48 : recoveryRate === 'slow' ? 96 : 72,
  };
}

function calculateGroupAverage(metrics: PerformanceMetrics[]): PerformanceMetrics {
  if (metrics.length === 0) {
    return {} as PerformanceMetrics;
  }
  
  return {
    playerId: 'group',
    playerName: 'Group Average',
    position: 'Various',
    category: 'Various',
    avgWeeklyLoad: Math.round(metrics.reduce((sum, m) => sum + m.avgWeeklyLoad, 0) / metrics.length),
    maxWeeklyLoad: Math.round(metrics.reduce((sum, m) => sum + m.maxWeeklyLoad, 0) / metrics.length),
    loadTrend: 'stable',
    acuteChronicRatio: Math.round(metrics.reduce((sum, m) => sum + m.acuteChronicRatio, 0) / metrics.length * 100) / 100,
    avgWellness: Math.round(metrics.reduce((sum, m) => sum + m.avgWellness, 0) / metrics.length * 10) / 10,
    wellnessTrend: 'stable',
    wellnessAdherence: Math.round(metrics.reduce((sum, m) => sum + m.wellnessAdherence, 0) / metrics.length * 100),
    avgDistance: Math.round(metrics.reduce((sum, m) => sum + m.avgDistance, 0) / metrics.length),
    avgMaxVelocity: Math.round(metrics.reduce((sum, m) => sum + m.avgMaxVelocity, 0) / metrics.length * 10) / 10,
    avgHSR: Math.round(metrics.reduce((sum, m) => sum + m.avgHSR, 0) / metrics.length),
    avgSprintDistance: Math.round(metrics.reduce((sum, m) => sum + m.avgSprintDistance, 0) / metrics.length),
    avgMinutesPlayed: Math.round(metrics.reduce((sum, m) => sum + m.avgMinutesPlayed, 0) / metrics.length),
    goalsPer90: Math.round(metrics.reduce((sum, m) => sum + m.goalsPer90, 0) / metrics.length * 100) / 100,
    assistsPer90: Math.round(metrics.reduce((sum, m) => sum + m.assistsPer90, 0) / metrics.length * 100) / 100,
    injuryRiskScore: Math.round(metrics.reduce((sum, m) => sum + m.injuryRiskScore, 0) / metrics.length * 100) / 100,
    fatigueLevel: Math.round(metrics.reduce((sum, m) => sum + m.fatigueLevel, 0) / metrics.length * 100) / 100,
    loadTargetProgress: 100,
    wellnessTargetProgress: 100,
    loadPercentile: 50,
    wellnessPercentile: 50,
    physicalPercentile: 50,
  };
}

function calculateRanking(value: number, groupValues: number[]): number {
  const sorted = [...groupValues].sort((a, b) => b - a);
  const index = sorted.indexOf(value);
  return index + 1;
}
