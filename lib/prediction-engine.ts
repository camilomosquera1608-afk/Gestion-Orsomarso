import { Player, DailyInternalLoadRecord, DailyExternalLoadRecord, DailyWellnessRecord, CompetitionRecord } from '@/lib/schemas';

export interface PredictionFeatures {
  playerId: string;
  playerName: string;
  
  // Load features
  avgWeeklyLoad: number;
  loadTrend: number;
  acuteChronicRatio: number;
  loadVariability: number;
  
  // Wellness features
  avgWellness: number;
  wellnessTrend: number;
  wellnessVariability: number;
  fatigueScore: number;
  
  // Physical features
  avgDistance: number;
  avgMaxVelocity: number;
  avgHSR: number;
  avgSprintDistance: number;
  
  // Competition features
  avgMinutesPlayed: number;
  recentMatches: number;
  
  // Historical features
  injuryHistory: number;
  age: number;
  position: string;
}

export interface PredictionResult {
  playerId: string;
  playerName: string;
  
  // Injury risk prediction
  injuryRisk: {
    probability: number;
    riskLevel: 'low' | 'medium' | 'high';
    confidence: number;
    factors: string[];
  };
  
  // Performance prediction
  performancePrediction: {
    expectedLoad: number;
    expectedWellness: number;
    expectedDistance: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  
  // Recovery prediction
  recoveryPrediction: {
    optimalRestDays: number;
    recoveryRate: 'fast' | 'normal' | 'slow';
    postMatchRecoveryTime: number;
  };
  
  // Recommendations
  recommendations: string[];
}

/**
 * Calculate prediction features for a player
 */
export function calculatePredictionFeatures(
  player: Player,
  internalLoads: DailyInternalLoadRecord[],
  externalLoads: DailyExternalLoadRecord[],
  wellnessRecords: DailyWellnessRecord[],
  competitionRecords: CompetitionRecord[],
  referenceDate: string,
  daysToAnalyze: number = 28
): PredictionFeatures {
  const startDate = getStartDate(referenceDate, daysToAnalyze);
  
  // Filter records
  const filteredInternal = internalLoads.filter(l => l.date >= startDate && l.date <= referenceDate && l.playerId === player.id);
  const filteredExternal = externalLoads.filter(l => l.date >= startDate && l.date <= referenceDate && l.playerId === player.id);
  const filteredWellness = wellnessRecords.filter(w => w.date >= startDate && w.date <= referenceDate && w.playerId === player.id);
  const filteredCompetition = competitionRecords.filter(c => c.date >= startDate && c.date <= referenceDate && c.playerId === player.id);
  
  // Calculate daily loads
  const dailyLoads = calculateDailyLoads(filteredInternal, filteredExternal, filteredCompetition);
  const weeklyLoads = calculateWeeklyLoads(dailyLoads, referenceDate);
  
  // Load features
  const avgWeeklyLoad = weeklyLoads.reduce((a, b) => a + b, 0) / weeklyLoads.length;
  const loadTrend = calculateTrendValue(weeklyLoads);
  const acuteChronicRatio = calculateAcuteChronicRatio(weeklyLoads);
  const loadVariability = calculateVariability(weeklyLoads);
  
  // Wellness features
  const wellnessScores = filteredWellness.map(calculateWellnessScore);
  const avgWellness = wellnessScores.reduce((a, b) => a + b, 0) / wellnessScores.length || 0;
  const wellnessTrend = calculateTrendValue(wellnessScores);
  const wellnessVariability = calculateVariability(wellnessScores);
  const fatigueScore = calculateFatigueScore(weeklyLoads, wellnessScores);
  
  // Physical features
  const avgDistance = filteredExternal.reduce((sum, e) => sum + (e.totalDistance || 0), 0) / filteredExternal.length || 0;
  const avgMaxVelocity = filteredExternal.reduce((sum, e) => sum + (e.maxVelocity || 0), 0) / filteredExternal.length || 0;
  const avgHSR = filteredExternal.reduce((sum, e) => sum + (e.highSpeedDistance || 0), 0) / filteredExternal.length || 0;
  const avgSprintDistance = filteredExternal.reduce((sum, e) => sum + (e.sprintDistance || 0), 0) / filteredExternal.length || 0;
  
  // Competition features
  const avgMinutesPlayed = filteredCompetition.reduce((sum, c) => sum + c.minutesPlayed, 0) / filteredCompetition.length || 0;
  const recentMatches = filteredCompetition.length;
  
  // Historical features
  const injuryHistory = player.injuryHistory?.length || 0;
  
  return {
    playerId: player.id,
    playerName: player.name,
    avgWeeklyLoad,
    loadTrend,
    acuteChronicRatio,
    loadVariability,
    avgWellness,
    wellnessTrend,
    wellnessVariability,
    fatigueScore,
    avgDistance,
    avgMaxVelocity,
    avgHSR,
    avgSprintDistance,
    avgMinutesPlayed,
    recentMatches,
    injuryHistory,
    age: player.age,
    position: player.position,
  };
}

/**
 * Predict injury risk using ML-inspired algorithm
 */
export function predictInjuryRisk(features: PredictionFeatures): PredictionResult['injuryRisk'] {
  const factors: string[] = [];
  let riskScore = 0;
  
  // ACWR factor
  if (features.acuteChronicRatio > 1.5) {
    riskScore += 0.3;
    factors.push('ACWR elevado (>1.5)');
  } else if (features.acuteChronicRatio > 1.3) {
    riskScore += 0.15;
    factors.push('ACWR moderadamente elevado (>1.3)');
  }
  
  // Wellness factor
  if (features.avgWellness < 3) {
    riskScore += 0.25;
    factors.push('Wellness bajo (<3)');
  } else if (features.avgWellness < 3.5) {
    riskScore += 0.1;
    factors.push('Wellness moderadamente bajo (<3.5)');
  }
  
  // Fatigue factor
  if (features.fatigueScore > 0.7) {
    riskScore += 0.2;
    factors.push('Fatiga elevada');
  } else if (features.fatigueScore > 0.5) {
    riskScore += 0.1;
    factors.push('Fatiga moderada');
  }
  
  // Load variability factor
  if (features.loadVariability > 0.5) {
    riskScore += 0.15;
    factors.push('Alta variabilidad de carga');
  }
  
  // Load trend factor
  if (features.loadTrend > 0.3) {
    riskScore += 0.1;
    factors.push('Tendencia de carga creciente');
  }
  
  // Injury history factor
  if (features.injuryHistory > 2) {
    riskScore += 0.15;
    factors.push('Historial de lesiones recurrente');
  } else if (features.injuryHistory > 0) {
    riskScore += 0.05;
    factors.push('Historial de lesiones previo');
  }
  
  // Age factor
  if (features.age > 30) {
    riskScore += 0.1;
    factors.push('Edad avanzada (>30)');
  } else if (features.age < 18) {
    riskScore += 0.05;
    factors.push('Edad joven (<18)');
  }
  
  // Competition load factor
  if (features.recentMatches > 2 && features.avgMinutesPlayed > 70) {
    riskScore += 0.1;
    factors.push('Alta carga competitiva reciente');
  }
  
  // Cap risk score
  riskScore = Math.min(riskScore, 1);
  
  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high';
  if (riskScore < 0.3) {
    riskLevel = 'low';
  } else if (riskScore < 0.6) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }
  
  // Calculate confidence based on data availability
  const confidence = Math.min(0.5 + (features.recentMatches * 0.1) + (features.avgWellness > 0 ? 0.2 : 0), 0.95);
  
  return {
    probability: Math.round(riskScore * 100),
    riskLevel,
    confidence: Math.round(confidence * 100),
    factors: factors.length > 0 ? factors : ['Sin factores de riesgo identificados'],
  };
}

/**
 * Predict performance using ML-inspired algorithm
 */
export function predictPerformance(features: PredictionFeatures): PredictionResult['performancePrediction'] {
  // Expected load based on recent trend and ACWR
  const expectedLoad = features.avgWeeklyLoad * (1 + features.loadTrend * 0.1);
  
  // Expected wellness based on recent trend and fatigue
  const expectedWellness = Math.max(1, Math.min(5, features.avgWellness - features.fatigueScore * 0.5));
  
  // Expected distance based on recent performance
  const expectedDistance = features.avgDistance * (1 + features.loadTrend * 0.05);
  
  // Determine trend
  let trend: 'improving' | 'stable' | 'declining';
  if (features.loadTrend > 0.1 && features.wellnessTrend > 0.1) {
    trend = 'improving';
  } else if (features.loadTrend < -0.1 || features.wellnessTrend < -0.1) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }
  
  return {
    expectedLoad: Math.round(expectedLoad),
    expectedWellness: Math.round(expectedWellness * 10) / 10,
    expectedDistance: Math.round(expectedDistance),
    trend,
  };
}

/**
 * Predict recovery needs
 */
export function predictRecovery(features: PredictionFeatures): PredictionResult['recoveryPrediction'] {
  let recoveryRate: 'fast' | 'normal' | 'slow';
  let optimalRestDays: number;
  let postMatchRecoveryTime: number;
  
  // Determine recovery rate based on wellness and fatigue
  if (features.avgWellness >= 4.5 && features.fatigueScore < 0.3) {
    recoveryRate = 'fast';
    optimalRestDays = 1;
    postMatchRecoveryTime = 48;
  } else if (features.avgWellness < 3.5 || features.fatigueScore > 0.6) {
    recoveryRate = 'slow';
    optimalRestDays = 3;
    postMatchRecoveryTime = 96;
  } else {
    recoveryRate = 'normal';
    optimalRestDays = 2;
    postMatchRecoveryTime = 72;
  }
  
  // Adjust for age
  if (features.age > 30) {
    optimalRestDays += 1;
    postMatchRecoveryTime += 24;
  }
  
  // Adjust for recent competition load
  if (features.recentMatches > 2 && features.avgMinutesPlayed > 70) {
    optimalRestDays += 1;
    postMatchRecoveryTime += 24;
  }
  
  return {
    optimalRestDays,
    recoveryRate,
    postMatchRecoveryTime,
  };
}

/**
 * Generate comprehensive prediction result
 */
export function generatePredictionResult(features: PredictionFeatures): PredictionResult {
  const injuryRisk = predictInjuryRisk(features);
  const performancePrediction = predictPerformance(features);
  const recoveryPrediction = predictRecovery(features);
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (injuryRisk.riskLevel === 'high') {
    recommendations.push('Considerar reducción de carga inmediata');
    recommendations.push('Evaluar necesidad de descanso adicional');
    recommendations.push('Monitoreo intensivo de wellness y fatiga');
  } else if (injuryRisk.riskLevel === 'medium') {
    recommendations.push('Mantener carga dentro de rangos seguros');
    recommendations.push('Continuar monitoreo regular');
  }
  
  if (performancePrediction.trend === 'declining') {
    recommendations.push('Revisar plan de entrenamiento actual');
    recommendations.push('Evaluar factores de recuperación');
  } else if (performancePrediction.trend === 'improving') {
    recommendations.push('Mantener estrategia actual');
    recommendations.push('Considerar progresión gradual de carga');
  }
  
  if (recoveryPrediction.recoveryRate === 'slow') {
    recommendations.push('Priorizar recuperación activa');
    recommendations.push('Considerar técnicas de recuperación adicionales');
  }
  
  if (features.acuteChronicRatio > 1.3) {
    recommendations.push('Reducir carga aguda para normalizar ACWR');
  }
  
  if (features.avgWellness < 3.5) {
    recommendations.push('Investigar causas de wellness bajo');
    recommendations.push('Evaluar calidad de sueño y estrés');
  }
  
  return {
    playerId: features.playerId,
    playerName: features.playerName,
    injuryRisk,
    performancePrediction,
    recoveryPrediction,
    recommendations: recommendations.length > 0 ? recommendations : ['Continuar monitoreo regular'],
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

function calculateTrendValue(values: number[]): number {
  if (values.length < 2) return 0;
  
  const recent = values.slice(-3);
  const earlier = values.slice(0, -3);
  
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = earlier.length > 0 ? earlier.reduce((a, b) => a + b, 0) / earlier.length : recentAvg;
  
  return earlierAvg > 0 ? (recentAvg - earlierAvg) / earlierAvg : 0;
}

function calculateAcuteChronicRatio(weeklyLoads: number[]): number {
  if (weeklyLoads.length < 4) return 1;
  
  const acute = weeklyLoads.slice(-2).reduce((a, b) => a + b, 0) / 2;
  const chronic = weeklyLoads.slice(-4).reduce((a, b) => a + b, 0) / 4;
  
  return chronic > 0 ? acute / chronic : 1;
}

function calculateVariability(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return mean > 0 ? stdDev / mean : 0;
}

function calculateWellnessScore(record: DailyWellnessRecord): number {
  return (record.sleep + record.fatigue + record.stress + record.musclePain + record.mood) / 5;
}

function calculateFatigueScore(weeklyLoads: number[], wellnessScores: number[]): number {
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
