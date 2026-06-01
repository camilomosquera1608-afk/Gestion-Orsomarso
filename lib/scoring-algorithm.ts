import { TechnicalReport, TechnicalProfile, ScoutFollowUp, Player } from '@/lib/schemas';

export interface ScoringWeights {
  technical: number;
  tactical: number;
  physical: number;
  psychological: number;
  projection: number;
  modelFit: number;
  ageFactor: number;
  consistency: number;
}

export interface PlayerScore {
  playerId: string;
  playerName: string;
  overallScore: number;
  technicalScore: number;
  tacticalScore: number;
  physicalScore: number;
  psychologicalScore: number;
  projectionScore: number;
  modelFitScore: number;
  ageAdjustedScore: number;
  consistencyScore: number;
  recommendation: 'seguir_observando' | 'priorizar' | 'convocable' | 'promover' | 'descartar' | 'revisar_mas_adelante';
  confidence: number;
  keyStrengths: string[];
  keyWeaknesses: string[];
  comparisonToAverage: {
    technical: number;
    tactical: number;
    physical: number;
    psychological: number;
  };
}

export interface SimilarityMatch {
  playerId: string;
  playerName: string;
  similarityScore: number;
  matchingAttributes: string[];
  differingAttributes: string[];
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  technical: 0.25,
  tactical: 0.20,
  physical: 0.20,
  psychological: 0.15,
  projection: 0.10,
  modelFit: 0.05,
  ageFactor: 0.03,
  consistency: 0.02,
};

/**
 * Calculate overall player score based on technical reports and profile
 */
export function calculatePlayerScore(
  player: Player,
  technicalReport: TechnicalReport | null,
  technicalProfile: TechnicalProfile | null,
  scoutFollowUp: ScoutFollowUp | null,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): PlayerScore {
  const technicalScore = technicalReport?.technicalScore ?? 5;
  const tacticalScore = technicalReport?.tacticalScore ?? 5;
  const physicalScore = technicalReport?.physicalScore ?? 5;
  const psychologicalScore = technicalReport?.psychologicalScore ?? 5;
  
  const projectionScore = technicalProfile ? 
    (technicalProfile.projection === 'muy_alta' ? 10 :
     technicalProfile.projection === 'alta' ? 8 :
     technicalProfile.projection === 'media' ? 6 : 4) : 5;
  
  const modelFitScore = technicalProfile ?
    (technicalProfile.modelFit === 'alto' ? 10 :
     technicalProfile.modelFit === 'medio' ? 7 : 4) : 5;
  
  // Age adjustment: younger players get bonus for potential
  const ageFactor = calculateAgeFactor(player.age);
  const ageAdjustedScore = (technicalScore + tacticalScore + physicalScore + psychologicalScore) / 4 * ageFactor;
  
  // Consistency based on scout follow-up status
  const consistencyScore = calculateConsistencyScore(scoutFollowUp);
  
  // Calculate weighted overall score
  const overallScore = 
    (technicalScore * weights.technical) +
    (tacticalScore * weights.tactical) +
    (physicalScore * weights.physical) +
    (psychologicalScore * weights.psychological) +
    (projectionScore * weights.projection) +
    (modelFitScore * weights.modelFit) +
    (ageAdjustedScore * weights.ageFactor) +
    (consistencyScore * weights.consistency);
  
  const recommendation = determineRecommendation(overallScore, projectionScore, modelFitScore, scoutFollowUp);
  const confidence = calculateConfidence(technicalReport, technicalProfile, scoutFollowUp);
  
  const keyStrengths = [
    ...(technicalProfile?.strengths ?? []),
    ...(technicalReport?.strengths ?? []),
  ];
  
  const keyWeaknesses = [
    ...(technicalProfile?.weaknesses ?? []),
    ...(technicalReport?.areasToImprove ?? []),
  ];
  
  return {
    playerId: player.id,
    playerName: player.name,
    overallScore: Math.round(overallScore * 10) / 10,
    technicalScore,
    tacticalScore,
    physicalScore,
    psychologicalScore,
    projectionScore,
    modelFitScore,
    ageAdjustedScore: Math.round(ageAdjustedScore * 10) / 10,
    consistencyScore,
    recommendation,
    confidence,
    keyStrengths,
    keyWeaknesses,
    comparisonToAverage: {
      technical: 0, // Will be calculated when comparing to group
      tactical: 0,
      physical: 0,
      psychological: 0,
    },
  };
}

/**
 * Calculate age factor for scoring
 */
function calculateAgeFactor(age: number): number {
  if (age <= 17) return 1.2; // Bonus for young prospects
  if (age <= 19) return 1.1;
  if (age <= 22) return 1.0;
  if (age <= 25) return 0.95;
  if (age <= 28) return 0.9;
  return 0.85; // Slight penalty for older players
}

/**
 * Calculate consistency score based on scout follow-up
 */
function calculateConsistencyScore(scoutFollowUp: ScoutFollowUp | null): number {
  if (!scoutFollowUp) return 5;
  
  const statusScores: Record<string, number> = {
    sin_seguimiento: 3,
    nuevo: 4,
    observado: 5,
    en_seguimiento: 6,
    interesante: 7,
    prioridad: 8,
    convocable: 9,
    promovible: 10,
    descartado: 2,
  };
  
  return statusScores[scoutFollowUp.status] ?? 5;
}

/**
 * Determine recommendation based on scores
 */
function determineRecommendation(
  overallScore: number,
  projectionScore: number,
  modelFitScore: number,
  scoutFollowUp: ScoutFollowUp | null
): PlayerScore['recommendation'] {
  if (scoutFollowUp?.status === 'descartado') return 'descartar';
  
  if (overallScore >= 8.5 && projectionScore >= 8 && modelFitScore >= 8) {
    return 'promover';
  }
  
  if (overallScore >= 7.5 && projectionScore >= 7) {
    return 'convocable';
  }
  
  if (overallScore >= 6.5 && projectionScore >= 6) {
    return 'priorizar';
  }
  
  if (overallScore >= 5.5) {
    return 'seguir_observando';
  }
  
  if (overallScore >= 4.5) {
    return 'revisar_mas_adelante';
  }
  
  return 'descartar';
}

/**
 * Calculate confidence in the score based on data availability
 */
function calculateConfidence(
  technicalReport: TechnicalReport | null,
  technicalProfile: TechnicalProfile | null,
  scoutFollowUp: ScoutFollowUp | null
): number {
  let confidence = 0;
  
  if (technicalReport) confidence += 0.4;
  if (technicalProfile) confidence += 0.35;
  if (scoutFollowUp) confidence += 0.25;
  
  return confidence;
}

/**
 * Compare player scores against group average
 */
export function comparePlayerToGroup(
  playerScore: PlayerScore,
  groupScores: PlayerScore[]
): PlayerScore {
  if (groupScores.length === 0) return playerScore;
  
  const avgTechnical = groupScores.reduce((sum, s) => sum + s.technicalScore, 0) / groupScores.length;
  const avgTactical = groupScores.reduce((sum, s) => sum + s.tacticalScore, 0) / groupScores.length;
  const avgPhysical = groupScores.reduce((sum, s) => sum + s.physicalScore, 0) / groupScores.length;
  const avgPsychological = groupScores.reduce((sum, s) => sum + s.psychologicalScore, 0) / groupScores.length;
  
  return {
    ...playerScore,
    comparisonToAverage: {
      technical: Math.round((playerScore.technicalScore - avgTechnical) * 10) / 10,
      tactical: Math.round((playerScore.tacticalScore - avgTactical) * 10) / 10,
      physical: Math.round((playerScore.physicalScore - avgPhysical) * 10) / 10,
      psychological: Math.round((playerScore.psychologicalScore - avgPsychological) * 10) / 10,
    },
  };
}

/**
 * Find similar players based on attributes
 */
export function findSimilarPlayers(
  targetPlayer: Player,
  targetProfile: TechnicalProfile | null,
  candidatePlayers: Player[],
  candidateProfiles: Map<string, TechnicalProfile>,
  limit: number = 5
): SimilarityMatch[] {
  const matches: SimilarityMatch[] = [];
  
  for (const candidate of candidatePlayers) {
    if (candidate.id === targetPlayer.id) continue;
    
    const candidateProfile = candidateProfiles.get(candidate.id);
    if (!candidateProfile || !targetProfile) continue;
    
    const similarity = calculateSimilarity(targetProfile, candidateProfile, targetPlayer, candidate);
    
    if (similarity > 0.5) {
      matches.push({
        playerId: candidate.id,
        playerName: candidate.name,
        similarityScore: Math.round(similarity * 100) / 100,
        matchingAttributes: getMatchingAttributes(targetProfile, candidateProfile),
        differingAttributes: getDifferingAttributes(targetProfile, candidateProfile),
      });
    }
  }
  
  return matches
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
}

/**
 * Calculate similarity between two players
 */
function calculateSimilarity(
  profile1: TechnicalProfile,
  profile2: TechnicalProfile,
  player1: Player,
  player2: Player
): number {
  let similarity = 0;
  let factors = 0;
  
  // Position similarity
  if (profile1.mainPosition === profile2.mainPosition) {
    similarity += 0.3;
  } else if (profile1.secondaryPositions.includes(profile2.mainPosition) || 
             profile2.secondaryPositions.includes(profile1.mainPosition)) {
    similarity += 0.15;
  }
  factors += 0.3;
  
  // Dominant foot
  if (profile1.dominantFoot === profile2.dominantFoot) {
    similarity += 0.1;
  }
  factors += 0.1;
  
  // Game profile similarity (simplified)
  if (profile1.gameProfile === profile2.gameProfile) {
    similarity += 0.2;
  }
  factors += 0.2;
  
  // Tactical role similarity
  if (profile1.tacticalRole === profile2.tacticalRole) {
    similarity += 0.15;
  }
  factors += 0.15;
  
  // Model fit
  if (profile1.modelFit === profile2.modelFit) {
    similarity += 0.1;
  }
  factors += 0.1;
  
  // Projection
  if (profile1.projection === profile2.projection) {
    similarity += 0.1;
  }
  factors += 0.1;
  
  // Age proximity (within 2 years)
  const ageDiff = Math.abs(player1.age - player2.age);
  if (ageDiff <= 2) {
    similarity += 0.05;
  }
  factors += 0.05;
  
  return factors > 0 ? similarity / factors : 0;
}

/**
 * Get matching attributes between two profiles
 */
function getMatchingAttributes(profile1: TechnicalProfile, profile2: TechnicalProfile): string[] {
  const matching: string[] = [];
  
  if (profile1.mainPosition === profile2.mainPosition) matching.push('Posición principal');
  if (profile1.dominantFoot === profile2.dominantFoot) matching.push('Pie dominante');
  if (profile1.gameProfile === profile2.gameProfile) matching.push('Perfil de juego');
  if (profile1.tacticalRole === profile2.tacticalRole) matching.push('Rol táctico');
  if (profile1.modelFit === profile2.modelFit) matching.push('Ajuste al modelo');
  if (profile1.projection === profile2.projection) matching.push('Proyección');
  
  return matching;
}

/**
 * Get differing attributes between two profiles
 */
function getDifferingAttributes(profile1: TechnicalProfile, profile2: TechnicalProfile): string[] {
  const differing: string[] = [];
  
  if (profile1.mainPosition !== profile2.mainPosition) differing.push('Posición principal');
  if (profile1.dominantFoot !== profile2.dominantFoot) differing.push('Pie dominante');
  if (profile1.gameProfile !== profile2.gameProfile) differing.push('Perfil de juego');
  if (profile1.tacticalRole !== profile2.tacticalRole) differing.push('Rol táctico');
  if (profile1.modelFit !== profile2.modelFit) differing.push('Ajuste al modelo');
  if (profile1.projection !== profile2.projection) differing.push('Proyección');
  
  return differing;
}

/**
 * Rank players by overall score
 */
export function rankPlayersByScore(scores: PlayerScore[]): PlayerScore[] {
  return [...scores].sort((a, b) => b.overallScore - a.overallScore);
}

/**
 * Get top N players by score
 */
export function getTopPlayers(scores: PlayerScore[], n: number): PlayerScore[] {
  return rankPlayersByScore(scores).slice(0, n);
}

/**
 * Filter players by recommendation
 */
export function filterPlayersByRecommendation(
  scores: PlayerScore[],
  recommendation: PlayerScore['recommendation']
): PlayerScore[] {
  return scores.filter((s) => s.recommendation === recommendation);
}
