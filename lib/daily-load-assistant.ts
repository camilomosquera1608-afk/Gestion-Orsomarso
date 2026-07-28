import type { Player, DailyInternalLoadRecord, DailyExternalLoadRecord, DailyWellnessRecord } from '@/lib/schemas';

export interface DailyLoadRecommendation {
  playerId: string;
  playerName: string;
  currentLoad: number;
  recommendedLoad: number;
  adjustment: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  tone: 'green' | 'yellow' | 'red';
}

export interface LoadAssistantResult {
  recommendations: DailyLoadRecommendation[];
  teamSummary: {
    totalCurrentLoad: number;
    totalRecommendedLoad: number;
    playersAtRisk: number;
    playersNeedingAdjustment: number;
  };
  insights: string[];
}

/**
 * Calcula recomendaciones de carga diaria basadas en ACWR, wellness y fatiga acumulada
 */
export function calculateDailyLoadRecommendations(params: {
  players: Player[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  wellnessRecords: DailyWellnessRecord[];
  referenceDate: string;
}): LoadAssistantResult {
  const { players, internalLoads, externalLoads, wellnessRecords, referenceDate } = params;
  const recommendations: DailyLoadRecommendation[] = [];
  let totalCurrentLoad = 0;
  let totalRecommendedLoad = 0;
  let playersAtRisk = 0;
  let playersNeedingAdjustment = 0;

  players.forEach((player) => {
    // Calcular carga actual del día
    const todayInternal = internalLoads.find((i) => i.playerId === player.id && i.date === referenceDate);
    const todayExternal = externalLoads.find((e) => e.playerId === player.id && e.date === referenceDate);
    const currentLoad = (todayInternal?.rpe || 0) * (todayInternal?.duration || 0) + (todayExternal?.playerLoad || 0);

    // Calcular ACWR
    const playerInternal = internalLoads.filter((i) => i.playerId === player.id);
    const recent7d = playerInternal
      .filter((i) => {
        const daysDiff = (new Date(referenceDate).getTime() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff >= 0 && daysDiff <= 7;
      })
      .reduce((sum, i) => sum + (i.rpe * i.duration), 0);

    const prior21d = playerInternal
      .filter((i) => {
        const daysDiff = (new Date(referenceDate).getTime() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24);
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

    // Determinar carga recomendada
    let recommendedLoad = currentLoad;
    let adjustment = 0;
    let reason = '';
    let priority: 'high' | 'medium' | 'low' = 'low';
    let tone: 'green' | 'yellow' | 'red' = 'green';

    if (acwr > 1.5) {
      recommendedLoad = currentLoad * 0.7;
      adjustment = -30;
      reason = 'ACWR críticamente elevado (>1.5)';
      priority = 'high';
      tone = 'red';
      playersAtRisk++;
    } else if (acwr > 1.3) {
      recommendedLoad = currentLoad * 0.85;
      adjustment = -15;
      reason = 'ACWR moderadamente elevado (>1.3)';
      priority = 'medium';
      tone = 'yellow';
    } else if (acwr < 0.8) {
      recommendedLoad = currentLoad * 1.2;
      adjustment = 20;
      reason = 'ACWR bajo (<0.8) - subcarga';
      priority = 'medium';
      tone = 'yellow';
    }

    if (avgWellness < 3) {
      recommendedLoad *= 0.8;
      adjustment = Math.round(adjustment - 20);
      reason += ' | Wellness crítico (<3)';
      priority = 'high';
      tone = 'red';
      playersAtRisk++;
    } else if (avgWellness < 3.5) {
      recommendedLoad *= 0.9;
      adjustment = Math.round(adjustment - 10);
      reason += ' | Wellness bajo (<3.5)';
      priority = 'medium';
      tone = 'yellow';
    }

    if (player.status === 'Lesionado' || player.status === 'Molestia') {
      recommendedLoad *= 0.5;
      adjustment = Math.round(adjustment - 50);
      reason += ` | Estado: ${player.status}`;
      priority = 'high';
      tone = 'red';
      playersAtRisk++;
    }

    if (Math.abs(adjustment) >= 5) {
      playersNeedingAdjustment++;
    }

    totalCurrentLoad += currentLoad;
    totalRecommendedLoad += recommendedLoad;

    recommendations.push({
      playerId: player.id,
      playerName: player.name,
      currentLoad: Math.round(currentLoad),
      recommendedLoad: Math.round(recommendedLoad),
      adjustment,
      reason,
      priority,
      tone,
    });
  });

  // Generar insights del equipo
  const insights: string[] = [];
  if (playersAtRisk > 0) {
    insights.push(`${playersAtRisk} jugadores en riesgo de lesión requieren atención inmediata`);
  }
  if (playersNeedingAdjustment > players.length / 2) {
    insights.push('Más del 50% del equipo necesita ajustes de carga - revisar planificación');
  }
  if (totalRecommendedLoad < totalCurrentLoad * 0.8) {
    insights.push('Carga total recomendada significativamente menor - considerar microciclo de recuperación');
  }

  return {
    recommendations: recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    teamSummary: {
      totalCurrentLoad: Math.round(totalCurrentLoad),
      totalRecommendedLoad: Math.round(totalRecommendedLoad),
      playersAtRisk,
      playersNeedingAdjustment,
    },
    insights,
  };
}

/**
 * Genera sugerencias de carga específicas por posición
 */
export function getPositionBasedLoadSuggestions(position: string): {
  targetLoadRange: [number, number];
  hsrTarget: number;
  sprintTarget: number;
  notes: string[];
} {
  const pos = position.toLowerCase();
  
  if (pos.includes('portero') || pos.includes('arquero')) {
    return {
      targetLoadRange: [200, 350],
      hsrTarget: 50,
      sprintTarget: 100,
      notes: ['Enfoque en estabilidad lumbo-pélvica', 'Priorizar técnica sobre volumen', 'Sprints cortos y explosivos'],
    };
  }
  
  if (pos.includes('defensa') || pos.includes('lateral')) {
    return {
      targetLoadRange: [350, 500],
      hsrTarget: 150,
      sprintTarget: 300,
      notes: ['Enfoque en desaceleraciones', 'Trabajo de cambio de dirección', 'Recuperación post-partido prioritaria'],
    };
  }
  
  if (pos.includes('mediocampista')) {
    return {
      targetLoadRange: [400, 600],
      hsrTarget: 200,
      sprintTarget: 400,
      notes: ['Balance entre volumen e intensidad', 'Trabajo de resistencia intermitente', 'Monitorear fatiga acumulativa'],
    };
  }
  
  if (pos.includes('extremo') || pos.includes('delantero')) {
    return {
      targetLoadRange: [350, 550],
      hsrTarget: 250,
      sprintTarget: 500,
      notes: ['Priorizar calidad de sprints', 'Trabajo de aceleración máxima', 'Gestión de minutos de competición'],
    };
  }
  
  return {
    targetLoadRange: [300, 500],
    hsrTarget: 150,
    sprintTarget: 300,
    notes: ['Ajustar según rol específico', 'Monitorear respuesta individual', 'Progresión gradual de intensidad'],
  };
}
