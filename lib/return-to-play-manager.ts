import type { Player, DailyInternalLoadRecord, DailyExternalLoadRecord, DailyWellnessRecord, CompetitionRecord } from '@/lib/schemas';

export interface ReturnToPlayPhase {
  phase: 'Phase 1' | 'Phase 2' | 'Phase 3' | 'Phase 4' | 'Phase 5' | 'Phase 6';
  description: string;
  targetLoad: number;
  targetDuration: number;
  targetIntensity: 'low' | 'moderate' | 'high';
  criteria: string[];
  minDaysInPhase: number;
}

export interface ReturnToPlayProgress {
  playerId: string;
  playerName: string;
  currentPhase: ReturnToPlayPhase['phase'];
  daysInCurrentPhase: number;
  totalDaysInRTP: number;
  progressPercentage: number;
  nextPhase: ReturnToPlayPhase['phase'] | null;
  criteriaMet: boolean;
  recommendations: string[];
  riskFactors: string[];
  estimatedReturnDate: string | null;
}

export interface ReturnToPlayPlan {
  playerId: string;
  playerName: string;
  injuryType: string;
  injuryDate: string;
  estimatedReturnDate: string;
  phases: ReturnToPlayPhase[];
  currentPhase: ReturnToPlayPhase['phase'];
  dailyProgress: ReturnToPlayProgress;
  milestones: {
    date: string;
    milestone: string;
    achieved: boolean;
  }[];
}

/**
 * Genera un plan de retorno a competencia personalizado
 */
export function generateReturnToPlayPlan(params: {
  player: Player;
  injuryType: string;
  injuryDate: string;
  injurySeverity: 'mild' | 'moderate' | 'severe';
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  wellnessRecords: DailyWellnessRecord[];
  referenceDate: string;
}): ReturnToPlayPlan {
  const { player, injuryType, injuryDate, injurySeverity, internalLoads, externalLoads, wellnessRecords, referenceDate } = params;
  
  // Calcular duración estimada según severidad
  const severityDays = {
    mild: 7,
    moderate: 14,
    severe: 28,
  };
  const estimatedDays = severityDays[injurySeverity];
  
  const injuryDateObj = new Date(injuryDate);
  const estimatedReturnDateObj = new Date(injuryDateObj);
  estimatedReturnDateObj.setDate(estimatedReturnDateObj.getDate() + estimatedDays);
  const estimatedReturnDate = estimatedReturnDateObj.toISOString().slice(0, 10);
  
  // Definir fases del RTP
  const phases: ReturnToPlayPhase[] = [
    {
      phase: 'Phase 1',
      description: 'Movilidad y funcionalidad básica',
      targetLoad: 100,
      targetDuration: 30,
      targetIntensity: 'low',
      criteria: ['Rango de movimiento completo', 'Ausencia de dolor en reposo', 'Marcha normal'],
      minDaysInPhase: 2,
    },
    {
      phase: 'Phase 2',
      description: 'Fortalecimiento y acondicionamiento',
      targetLoad: 200,
      targetDuration: 45,
      targetIntensity: 'low',
      criteria: ['Fuerza >80% del lado contralateral', 'Estabilidad articular', 'Sin dolor con carga moderada'],
      minDaysInPhase: 3,
    },
    {
      phase: 'Phase 3',
      description: 'Entrenamiento específico de deporte',
      targetLoad: 350,
      targetDuration: 60,
      targetIntensity: 'moderate',
      criteria: ['Movimientos deportivos sin dolor', 'Agilidad básica', 'Resistencia cardiovascular'],
      minDaysInPhase: 3,
    },
    {
      phase: 'Phase 4',
      description: 'Entrenamiento complejo',
      targetLoad: 500,
      targetDuration: 75,
      targetIntensity: 'moderate',
      criteria: ['Sprints progresivos', 'Cambio de dirección', 'Trabajo con balón'],
      minDaysInPhase: 4,
    },
    {
      phase: 'Phase 5',
      description: 'Alta intensidad',
      targetLoad: 650,
      targetDuration: 90,
      targetIntensity: 'high',
      criteria: ['Sprints máximos', 'Contacto controlado', 'Simulaciones de juego'],
      minDaysInPhase: 3,
    },
    {
      phase: 'Phase 6',
      description: 'Retorno a competencia completa',
      targetLoad: 800,
      targetDuration: 90,
      targetIntensity: 'high',
      criteria: ['Rendimiento normal', 'Sin dolor post-esfuerzo', 'Bienness óptimo'],
      minDaysInPhase: 2,
    },
  ];
  
  // Calcular progreso actual
  const daysSinceInjury = Math.floor((new Date(referenceDate).getTime() - injuryDateObj.getTime()) / (1000 * 60 * 60 * 24));
  const currentPhaseIndex = Math.min(Math.floor(daysSinceInjury / (estimatedDays / 6)), phases.length - 1);
  const currentPhase = phases[currentPhaseIndex].phase;
  
  const dailyProgress = calculateDailyProgress({
    player,
    phases,
    currentPhase,
    daysSinceInjury,
    internalLoads,
    externalLoads,
    wellnessRecords,
    referenceDate,
  });
  
  // Generar milestones
  const milestones = phases.map((phase, index) => {
    const milestoneDate = new Date(injuryDateObj);
    const daysToMilestone = phases.slice(0, index + 1).reduce((sum, p) => sum + p.minDaysInPhase, 0);
    milestoneDate.setDate(milestoneDate.getDate() + daysToMilestone);
    
    return {
      date: milestoneDate.toISOString().slice(0, 10),
      milestone: phase.description,
      achieved: index < currentPhaseIndex,
    };
  });
  
  return {
    playerId: player.id,
    playerName: player.name,
    injuryType,
    injuryDate,
    estimatedReturnDate,
    phases,
    currentPhase,
    dailyProgress,
    milestones,
  };
}

/**
 * Calcula el progreso diario del jugador en el proceso RTP
 */
function calculateDailyProgress(params: {
  player: Player;
  phases: ReturnToPlayPhase[];
  currentPhase: ReturnToPlayPhase['phase'];
  daysSinceInjury: number;
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  wellnessRecords: DailyWellnessRecord[];
  referenceDate: string;
}): ReturnToPlayProgress {
  const { player, phases, currentPhase, daysSinceInjury, internalLoads, externalLoads, wellnessRecords, referenceDate } = params;
  
  const currentPhaseIndex = phases.findIndex((p) => p.phase === currentPhase);
  const currentPhaseData = phases[currentPhaseIndex];
  const nextPhase = currentPhaseIndex < phases.length - 1 ? phases[currentPhaseIndex + 1].phase : null;
  
  // Calcular días en fase actual
  const daysInCurrentPhase = daysSinceInjury - phases.slice(0, currentPhaseIndex).reduce((sum, p) => sum + p.minDaysInPhase, 0);
  
  // Calcular progreso total
  const totalPhases = phases.length;
  const progressPercentage = Math.round(((currentPhaseIndex + 1) / totalPhases) * 100);
  
  // Evaluar criterios cumplidos
  const todayLoad = internalLoads
    .filter((i) => i.playerId === player.id && i.date === referenceDate)
    .reduce((sum, i) => sum + (i.rpe * i.duration), 0);
  
  const todayWellness = wellnessRecords
    .filter((w) => w.playerId === player.id && w.date === referenceDate)[0];
  
  const avgWellness = wellnessRecords
    .filter((w) => w.playerId === player.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .reduce((sum, w) => sum + (w.sleep + w.fatigue + w.stress + w.musclePain + w.mood) / 5, 0) / 7;
  
  const criteriaMet = todayLoad >= currentPhaseData.targetLoad * 0.8 && avgWellness >= 3.5;
  
  // Generar recomendaciones
  const recommendations: string[] = [];
  if (todayLoad < currentPhaseData.targetLoad * 0.7) {
    recommendations.push('Incrementar carga gradualmente para alcanzar objetivo de fase');
  }
  if (avgWellness < 3.5) {
    recommendations.push('Priorizar recuperación y wellness antes de progresar');
  }
  if (daysInCurrentPhase >= currentPhaseData.minDaysInPhase && criteriaMet) {
    recommendations.push('Criterios cumplidos - considerar progresar a siguiente fase');
  }
  
  // Identificar factores de riesgo
  const riskFactors: string[] = [];
  if (avgWellness < 3) {
    riskFactors.push('Wellness crítico - riesgo de re-lesión');
  }
  if (todayLoad > currentPhaseData.targetLoad * 1.3) {
    riskFactors.push('Carga excesiva - riesgo de sobrecarga');
  }
  if (daysInCurrentPhase < currentPhaseData.minDaysInPhase) {
    riskFactors.push('Tiempo insuficiente en fase actual');
  }
  
  // Estimar fecha de retorno
  const remainingDays = phases.slice(currentPhaseIndex + 1).reduce((sum, p) => sum + p.minDaysInPhase, 0);
  const estimatedReturnDate = new Date(referenceDate);
  estimatedReturnDate.setDate(estimatedReturnDate.getDate() + remainingDays);
  
  return {
    playerId: player.id,
    playerName: player.name,
    currentPhase,
    daysInCurrentPhase: Math.max(0, daysInCurrentPhase),
    totalDaysInRTP: daysSinceInjury,
    progressPercentage,
    nextPhase,
    criteriaMet,
    recommendations,
    riskFactors,
    estimatedReturnDate: estimatedReturnDate.toISOString().slice(0, 10),
  };
}

/**
 * Genera recomendaciones específicas por fase de RTP
 */
export function getPhaseSpecificRecommendations(phase: ReturnToPlayPhase['phase']): {
  exercises: string[];
  precautions: string[];
  progressions: string[];
} {
  const recommendations = {
    exercises: [],
    precautions: [],
    progressions: [],
  } as {
    exercises: string[];
    precautions: string[];
    progressions: string[];
  };
  
  switch (phase) {
    case 'Phase 1':
      recommendations.exercises = ['Movilidad articular', 'Estiramientos suaves', 'Marcha', 'Ejercicios isométricos'];
      recommendations.precautions = ['Evitar dolor', 'Rango de movimiento sin forzar', 'Progresión gradual'];
      recommendations.progressions = ['Aumentar rango de movimiento', 'Introducir carga ligera', 'Mejorar estabilidad'];
      break;
    case 'Phase 2':
      recommendations.exercises = ['Fuerza progresiva', 'Equilibrio', 'Propiocepción', 'Cardio suave'];
      recommendations.precautions = ['Monitorear dolor post-ejercicio', 'Evitar impacto brusco', 'Simetría bilateral'];
      recommendations.progressions = ['Aumentar resistencia', 'Introducir movimientos multiplanares', 'Mejorar coordinación'];
      break;
    case 'Phase 3':
      recommendations.exercises = ['Agilidad', 'Sprints submáximos', 'Trabajo con balón', 'Patrones de movimiento'];
      recommendations.precautions = ['Controlar aceleraciones', 'Evitar cambios bruscos de dirección', 'Monitorear fatiga'];
      recommendations.progressions = ['Aumentar velocidad', 'Introducir complejidad técnica', 'Aumentar duración'];
      break;
    case 'Phase 4':
      recommendations.exercises = ['Sprints progresivos', 'Cambio de dirección', 'Simulaciones tácticas', 'Trabajo de fuerza específico'];
      recommendations.precautions = ['Controlar intensidad', 'Monitorear respuesta técnica', 'Evitar fatiga excesiva'];
      recommendations.progressions = ['Aumentar complejidad', 'Introducir presión temporal', 'Simular situaciones de juego'];
      break;
    case 'Phase 5':
      recommendations.exercises = ['Sprints máximos', 'Contacto controlado', 'Simulaciones de partido', 'Trabajo de alta intensidad'];
      recommendations.precautions = ['Monitorear respuesta a contacto', 'Controlar volumen de sprints', 'Evaluar toma de decisiones'];
      recommendations.progressions = ['Aumentar duración de simulaciones', 'Introducir presión competitiva', 'Evaluar rendimiento bajo fatiga'];
      break;
    case 'Phase 6':
      recommendations.exercises = ['Entrenamiento completo', 'Simulaciones reales', 'Trabajo táctico', 'Preparación competitiva'];
      recommendations.precautions = ['Monitorear respuesta post-esfuerzo', 'Evaluar wellness diario', 'Mantener comunicación con staff médico'];
      recommendations.progressions = ['Integración completa con equipo', 'Aumentar minutos de participación', 'Preparación para competición'];
      break;
  }
  
  return recommendations;
}

/**
 * Evalúa si un jugador está listo para progresar a la siguiente fase
 */
export function evaluatePhaseProgression(params: {
  player: Player;
  currentPhase: ReturnToPlayPhase['phase'];
  daysInCurrentPhase: number;
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  wellnessRecords: DailyWellnessRecord[];
  referenceDate: string;
}): {
  ready: boolean;
  confidence: number;
  factors: {
    positive: string[];
    negative: string[];
  };
  recommendations: string[];
} {
  const { player, currentPhase, daysInCurrentPhase, internalLoads, externalLoads, wellnessRecords, referenceDate } = params;
  
  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];
  const recommendations: string[] = [];
  
  // Evaluar carga
  const recentLoad = internalLoads
    .filter((i) => i.playerId === player.id && i.date === referenceDate)
    .reduce((sum, i) => sum + (i.rpe * i.duration), 0);
  
  if (recentLoad >= 300) {
    positiveFactors.push('Carga adecuada para progresión');
  } else {
    negativeFactors.push('Carga insuficiente para progresión');
  }
  
  // Evaluar wellness
  const avgWellness = wellnessRecords
    .filter((w) => w.playerId === player.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .reduce((sum, w) => sum + (w.sleep + w.fatigue + w.stress + w.musclePain + w.mood) / 5, 0) / 7;
  
  if (avgWellness >= 4) {
    positiveFactors.push('Wellness óptimo');
  } else if (avgWellness >= 3.5) {
    positiveFactors.push('Wellness aceptable');
  } else {
    negativeFactors.push('Wellness subóptimo');
  }
  
  // Evaluar tiempo en fase
  if (daysInCurrentPhase >= 3) {
    positiveFactors.push('Tiempo suficiente en fase actual');
  } else {
    negativeFactors.push('Tiempo insuficiente en fase actual');
  }
  
  // Evaluar ausencia de dolor
  const recentWellness = wellnessRecords
    .filter((w) => w.playerId === player.id && w.date === referenceDate)[0];
  
  if (recentWellness && recentWellness.musclePain <= 2) {
    positiveFactors.push('Ausencia de dolor significativo');
  } else {
    negativeFactors.push('Dolor presente - reconsiderar progresión');
  }
  
  // Calcular confianza
  const confidence = Math.round((positiveFactors.length / (positiveFactors.length + negativeFactors.length)) * 100);
  
  // Determinar si está listo
  const ready = confidence >= 75 && negativeFactors.length === 0;
  
  // Generar recomendaciones
  if (ready) {
    recommendations.push('Jugador listo para progresar a siguiente fase');
    recommendations.push('Continuar monitoreo intensivo');
  } else {
    recommendations.push('Mantener en fase actual');
    if (avgWellness < 3.5) {
      recommendations.push('Priorizar recuperación');
    }
    if (daysInCurrentPhase < 3) {
      recommendations.push('Completar tiempo mínimo en fase actual');
    }
  }
  
  return {
    ready,
    confidence,
    factors: {
      positive: positiveFactors,
      negative: negativeFactors,
    },
    recommendations,
  };
}
