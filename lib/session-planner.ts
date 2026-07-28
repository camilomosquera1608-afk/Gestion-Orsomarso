import type { Player, DailyInternalLoadRecord, DailyExternalLoadRecord, DailyWellnessRecord, CompetitionRecord } from '@/lib/schemas';

export interface SessionPlan {
  date: string;
  sessionType: 'MD-5' | 'MD-4' | 'MD-3' | 'MD-2' | 'MD-1' | 'MD' | 'MD+1' | 'MD+2' | 'Recovery';
  targetLoad: number;
  targetDuration: number;
  targetIntensity: 'low' | 'moderate' | 'high';
  focusAreas: string[];
  playerAdjustments: PlayerSessionAdjustment[];
}

export interface PlayerSessionAdjustment {
  playerId: string;
  playerName: string;
  adjustment: 'reduce' | 'maintain' | 'increase' | 'rest';
  reason: string;
  targetLoad?: number;
  targetMinutes?: number;
}

export interface WeeklyPlan {
  sessions: SessionPlan[];
  totalWeeklyLoad: number;
  peakLoadDay: string;
  recoveryDays: string[];
  insights: string[];
}

/**
 * Genera un plan semanal de sesiones basado en competición y estado del equipo
 */
export function generateWeeklySessionPlan(params: {
  players: Player[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  wellnessRecords: DailyWellnessRecord[];
  competitionRecords: CompetitionRecord[];
  startDate: string;
  category?: string;
}): WeeklyPlan {
  const { players, internalLoads, externalLoads, wellnessRecords, competitionRecords, startDate, category = 'all' } = params;
  
  // Encontrar próximo partido
  const upcomingMatch = competitionRecords
    .filter((c) => c.date >= startDate)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  
  const matchDate = upcomingMatch?.date;
  const daysToMatch = matchDate ? Math.floor((new Date(matchDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) : null;
  
  const sessions: SessionPlan[] = [];
  const recoveryDays: string[] = [];
  
  // Generar sesiones para 7 días
  for (let i = 0; i < 7; i++) {
    const sessionDate = new Date(startDate);
    sessionDate.setDate(sessionDate.getDate() + i);
    const dateStr = sessionDate.toISOString().slice(0, 10);
    
    let sessionType: SessionPlan['sessionType'] = 'MD-5';
    let targetLoad = 400;
    let targetDuration = 90;
    let targetIntensity: SessionPlan['targetIntensity'] = 'moderate';
    let focusAreas: string[] = [];
    
    if (matchDate && daysToMatch !== null) {
      const daysFromStart = i;
      const daysToMatchFromSession = daysToMatch - daysFromStart;
      
      // Planificación basada en días hasta el partido
      if (daysToMatchFromSession === 0) {
        sessionType = 'MD';
        targetLoad = 200;
        targetDuration = 60;
        targetIntensity = 'low';
        focusAreas = ['Activación', 'Táctica específica', 'Finalización'];
      } else if (daysToMatchFromSession === 1) {
        sessionType = 'MD-1';
        targetLoad = 350;
        targetDuration = 75;
        targetIntensity = 'moderate';
        focusAreas = ['Velocidad submáxima', 'Táctica', 'Set pieces'];
      } else if (daysToMatchFromSession === 2) {
        sessionType = 'MD-2';
        targetLoad = 500;
        targetDuration = 90;
        targetIntensity = 'high';
        focusAreas = ['Potencia', 'Velocidad', 'Situaciones de juego'];
      } else if (daysToMatchFromSession === 3) {
        sessionType = 'MD-3';
        targetLoad = 550;
        targetDuration = 100;
        targetIntensity = 'high';
        focusAreas = ['Resistencia intermitente', 'Fuerza', 'Juego real'];
      } else if (daysToMatchFromSession === 4) {
        sessionType = 'MD-4';
        targetLoad = 450;
        targetDuration = 90;
        targetIntensity = 'moderate';
        focusAreas = ['Técnica', 'Posicional', 'Recuperación activa'];
      } else if (daysToMatchFromSession === 5) {
        sessionType = 'MD-5';
        targetLoad = 400;
        targetDuration = 85;
        targetIntensity = 'moderate';
        focusAreas = ['Fuerza', 'Técnica', 'Táctica general'];
      } else if (daysToMatchFromSession < 0) {
        // Post-partido
        if (daysToMatchFromSession === -1) {
          sessionType = 'MD+1';
          targetLoad = 150;
          targetDuration = 45;
          targetIntensity = 'low';
          focusAreas = ['Recuperación', 'Movilidad', 'Estiramiento'];
          recoveryDays.push(dateStr);
        } else if (daysToMatchFromSession === -2) {
          sessionType = 'MD+2';
          targetLoad = 300;
          targetDuration = 60;
          targetIntensity = 'low';
          focusAreas = ['Regreso gradual', 'Técnica ligera', 'Cardio suave'];
        } else {
          sessionType = 'Recovery';
          targetLoad = 200;
          targetDuration = 50;
          targetIntensity = 'low';
          focusAreas = ['Recuperación activa', 'Movilidad', 'Trabajo de fuerza ligero'];
        }
      }
    } else {
      // Sin partido próximo - microciclo estándar
      const dayOfWeek = sessionDate.getDay();
      if (dayOfWeek === 1) {
        sessionType = 'MD-5';
        targetLoad = 400;
        targetDuration = 85;
        targetIntensity = 'moderate';
        focusAreas = ['Fuerza', 'Técnica', 'Táctica general'];
      } else if (dayOfWeek === 2) {
        sessionType = 'MD-4';
        targetLoad = 450;
        targetDuration = 90;
        targetIntensity = 'moderate';
        focusAreas = ['Técnica', 'Posicional', 'Recuperación activa'];
      } else if (dayOfWeek === 3) {
        sessionType = 'MD-3';
        targetLoad = 550;
        targetDuration = 100;
        targetIntensity = 'high';
        focusAreas = ['Resistencia intermitente', 'Fuerza', 'Juego real'];
      } else if (dayOfWeek === 4) {
        sessionType = 'MD-2';
        targetLoad = 500;
        targetDuration = 90;
        targetIntensity = 'high';
        focusAreas = ['Potencia', 'Velocidad', 'Situaciones de juego'];
      } else if (dayOfWeek === 5) {
        sessionType = 'MD-1';
        targetLoad = 350;
        targetDuration = 75;
        targetIntensity = 'moderate';
        focusAreas = ['Velocidad submáxima', 'Táctica', 'Set pieces'];
      } else if (dayOfWeek === 6) {
        sessionType = 'Recovery';
        targetLoad = 200;
        targetDuration = 50;
        targetIntensity = 'low';
        focusAreas = ['Recuperación activa', 'Movilidad', 'Trabajo de fuerza ligero'];
        recoveryDays.push(dateStr);
      } else {
        sessionType = 'Recovery';
        targetLoad = 150;
        targetDuration = 45;
        targetIntensity = 'low';
        focusAreas = ['Recuperación', 'Movilidad', 'Estiramiento'];
        recoveryDays.push(dateStr);
      }
    }
    
    // Calcular ajustes por jugador
    const playerAdjustments = calculatePlayerSessionAdjustments({
      players,
      internalLoads,
      externalLoads,
      wellnessRecords,
      date: dateStr,
      targetLoad,
    });
    
    sessions.push({
      date: dateStr,
      sessionType,
      targetLoad,
      targetDuration,
      targetIntensity,
      focusAreas,
      playerAdjustments,
    });
  }
  
  const totalWeeklyLoad = sessions.reduce((sum, s) => sum + s.targetLoad, 0);
  const peakLoadDay = sessions.reduce((max, s) => s.targetLoad > max.targetLoad ? s : max, sessions[0]).date;
  
  const insights: string[] = [];
  if (matchDate) {
    insights.push(`Próximo partido: ${matchDate} (${daysToMatch} días)`);
  }
  if (totalWeeklyLoad > 3500) {
    insights.push('Carga semanal alta - monitorear fatiga acumulativa');
  }
  if (recoveryDays.length < 2) {
    insights.push('Considerar agregar día de recuperación adicional');
  }
  
  return {
    sessions,
    totalWeeklyLoad,
    peakLoadDay,
    recoveryDays,
    insights,
  };
}

/**
 * Calcula ajustes individuales por jugador para una sesión específica
 */
function calculatePlayerSessionAdjustments(params: {
  players: Player[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  wellnessRecords: DailyWellnessRecord[];
  date: string;
  targetLoad: number;
}): PlayerSessionAdjustment[] {
  const { players, internalLoads, externalLoads, wellnessRecords, date, targetLoad } = params;
  const adjustments: PlayerSessionAdjustment[] = [];
  
  players.forEach((player) => {
    // Calcular ACWR del jugador
    const playerInternal = internalLoads.filter((i) => i.playerId === player.id);
    const recent7d = playerInternal
      .filter((i) => {
        const daysDiff = (new Date(date).getTime() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff >= 0 && daysDiff <= 7;
      })
      .reduce((sum, i) => sum + (i.rpe * i.duration), 0);

    const prior21d = playerInternal
      .filter((i) => {
        const daysDiff = (new Date(date).getTime() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff > 7 && daysDiff <= 28;
      })
      .reduce((sum, i) => sum + (i.rpe * i.duration), 0);

    const chronic = prior21d / 3;
    const acwr = chronic > 0 ? recent7d / chronic : 0;

    // Calcular wellness promedio
    const playerWellness = wellnessRecords
      .filter((w) => w.playerId === player.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);
    const avgWellness = playerWellness.length > 0
      ? playerWellness.reduce((sum, w) => sum + (w.sleep + w.fatigue + w.stress + w.musclePain + w.mood) / 5, 0) / playerWellness.length
      : 0;

    let adjustment: PlayerSessionAdjustment['adjustment'] = 'maintain';
    let reason = '';
    let targetLoadValue: number | undefined;
    let targetMinutesValue: number | undefined;

    if (player.status === 'Lesionado') {
      adjustment = 'rest';
      reason = 'Jugador lesionado - sesión de readaptación';
    } else if (player.status === 'Molestia') {
      adjustment = 'reduce';
      targetLoadValue = targetLoad * 0.5;
      targetMinutesValue = 45;
      reason = 'Molestia - reducir intensidad';
    } else if (acwr > 1.4) {
      adjustment = 'reduce';
      targetLoadValue = targetLoad * 0.7;
      reason = 'ACWR elevado - reducir carga';
    } else if (avgWellness < 3) {
      adjustment = 'reduce';
      targetLoadValue = targetLoad * 0.6;
      reason = 'Wellness bajo - priorizar recuperación';
    } else if (acwr < 0.8 && avgWellness > 4) {
      adjustment = 'increase';
      targetLoadValue = targetLoad * 1.2;
      reason = 'Subcarga - incrementar progresivamente';
    }

    adjustments.push({
      playerId: player.id,
      playerName: player.name,
      adjustment,
      reason,
      targetLoad: targetLoadValue,
      targetMinutes: targetMinutesValue,
    });
  });
  
  return adjustments;
}

/**
 * Genera recomendaciones de ejercicios según tipo de sesión
 */
export function getSessionExerciseRecommendations(sessionType: SessionPlan['sessionType']): {
  warmup: string[];
  main: string[];
  cooldown: string[];
} {
  const recommendations: {
    warmup: string[];
    main: string[];
    cooldown: string[];
  } = {
    warmup: ['Movilidad dinámica', 'Activación glúteo', 'Drills técnicos'],
    main: [],
    cooldown: ['Estiramiento estático', 'Foam rolling', 'Respiración'],
  };
  
  switch (sessionType) {
    case 'MD':
      recommendations.main = ['Activación neuromuscular', 'Sprints cortos', 'Finalización', 'Táctica específica'];
      break;
    case 'MD-1':
      recommendations.main = ['Velocidad submáxima', 'Trabajo posicional', 'Set pieces', 'Táctica'];
      break;
    case 'MD-2':
      recommendations.main = ['Potencia', 'Sprints máximos', 'Situaciones de juego', 'Resistencia intermitente'];
      break;
    case 'MD-3':
      recommendations.main = ['Resistencia intermitente', 'Fuerza', 'Juego real', 'Táctica'];
      break;
    case 'MD-4':
      recommendations.main = ['Técnica', 'Posicional', 'Recuperación activa', 'Trabajo de fuerza'];
      break;
    case 'MD-5':
      recommendations.main = ['Fuerza', 'Técnica', 'Táctica general', 'Acondicionamiento'];
      break;
    case 'MD+1':
      recommendations.main = ['Recuperación', 'Movilidad', 'Estiramiento', 'Masaje'];
      recommendations.warmup = ['Caminar', 'Movilidad suave'];
      break;
    case 'MD+2':
      recommendations.main = ['Regreso gradual', 'Técnica ligera', 'Cardio suave', 'Movilidad'];
      break;
    case 'Recovery':
      recommendations.main = ['Recuperación activa', 'Movilidad', 'Trabajo de fuerza ligero', 'Estiramiento'];
      recommendations.warmup = ['Movilidad suave', 'Activación ligera'];
      break;
  }
  
  return recommendations;
}
