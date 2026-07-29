// Automatic Insights Generation System
// Generates intelligent, contextual analysis for match reports

export interface MatchInsight {
  category: 'offensive' | 'defensive' | 'physical' | 'tactical' | 'overall';
  type: 'strength' | 'weakness' | 'key_moment' | 'trend' | 'recommendation';
  title: string;
  description: string;
  severity?: 'low' | 'medium' | 'high';
  metrics?: string[];
}

export interface MatchContext {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  goals: number;
  xG?: number;
  passAccuracy: number;
  recoveries: number;
  errors: number;
  ppda?: number;
  distance: number;
  highSpeedDistance: number;
  result: 'win' | 'draw' | 'loss';
  opponent: string;
  date: string;
  conversion?: number;
}

export class InsightGenerator {
  private context: MatchContext;
  
  constructor(context: MatchContext) {
    this.context = context;
  }
  
  generateExecutiveSummary(): string {
    const { possession, shots, goals, passAccuracy, result, opponent } = this.context;
    
    let summary = `Orsomarso`;
    
    // Possession analysis
    if (possession >= 60) {
      summary += ` dominó territorialmente durante gran parte del encuentro gracias a una posesión del ${possession}%`;
    } else if (possession >= 50) {
      summary += ` mantuvo un equilibrio territorial con una posesión del ${possession}%`;
    } else {
      summary += ` cedió el control territorial con una posesión del ${possession}%`;
    }
    
    // Offensive production
    summary += `, generando ${shots} remates`;
    
    // Conversion efficiency
    const conversion = shots > 0 ? (goals / shots) * 100 : 0;
    if (conversion >= 20) {
      summary += ` con una eficacia de conversión destacada`;
    } else if (conversion >= 10) {
      summary += ` con una conversión moderada`;
    } else {
      summary += ` aunque su baja eficacia de conversión limitó el resultado`;
    }
    
    // Pass accuracy
    if (passAccuracy >= 75) {
      summary += ` y una precisión de pase del ${passAccuracy}%`;
    }
    
    // Result context
    if (result === 'win') {
      summary += `, lo que se tradujo en una victoria frente a ${opponent}.`;
    } else if (result === 'draw') {
      summary += `, resultando en un empate ante ${opponent}.`;
    } else {
      summary += `, lo que no fue suficiente para evitar la derrota contra ${opponent}.`;
    }
    
    return summary;
  }
  
  generateStrengths(): MatchInsight[] {
    const strengths: MatchInsight[] = [];
    const { possession, passAccuracy, recoveries, distance, highSpeedDistance } = this.context;
    
    if (possession >= 55) {
      strengths.push({
        category: 'tactical',
        type: 'strength',
        title: 'Control territorial',
        description: `El equipo mantuvo un dominio territorial sólido con ${possession}% de posesión, facilitando la construcción ofensiva.`,
        metrics: ['posesión'],
      });
    }
    
    if (passAccuracy >= 75) {
      strengths.push({
        category: 'tactical',
        type: 'strength',
        title: 'Precisión en el pase',
        description: `La circulación del balón fue eficiente con ${passAccuracy}% de precisión, permitiendo mantener el ritmo del juego.`,
        metrics: ['precisión de pase'],
      });
    }
    
    if (recoveries >= 30) {
      strengths.push({
        category: 'defensive',
        type: 'strength',
        title: 'Alta capacidad de recuperación',
        description: `El equipo mostró gran intensidad defensiva con ${recoveries} recuperaciones, presionando efectivamente tras pérdidas.`,
        metrics: ['recuperaciones'],
      });
    }
    
    if (distance >= 100000) {
      strengths.push({
        category: 'physical',
        type: 'strength',
        title: 'Volumen físico destacado',
        description: `El equipo cubrió una distancia total de ${(distance / 1000).toFixed(1)}km, demostrando excelente condición física.`,
        metrics: ['distancia total'],
      });
    }
    
    if (highSpeedDistance >= 3000) {
      strengths.push({
        category: 'physical',
        type: 'strength',
        title: 'Intensidad en alta velocidad',
        description: `El equipo registró ${(highSpeedDistance / 1000).toFixed(1)}km a alta velocidad, indicando buena capacidad explosiva.`,
        metrics: ['distancia alta velocidad'],
      });
    }
    
    return strengths;
  }
  
  generateWeaknesses(): MatchInsight[] {
    const weaknesses: MatchInsight[] = [];
    const { possession, passAccuracy, errors, shots, goals, xG } = this.context;
    
    if (possession < 45) {
      weaknesses.push({
        category: 'tactical',
        type: 'weakness',
        title: 'Pérdida de control territorial',
        description: `El equipo cedió demasiada posesión (${possession}%), dificultando la construcción del juego.`,
        metrics: ['posesión'],
        severity: 'medium',
      });
    }
    
    if (passAccuracy < 65) {
      weaknesses.push({
        category: 'tactical',
        type: 'weakness',
        title: 'Imprecisión en el pase',
        description: `La precisión de pase del ${passAccuracy}% fue insuficiente, interrumpiendo la fluidez ofensiva.`,
        metrics: ['precisión de pase'],
        severity: 'high',
      });
    }
    
    if (errors > 10) {
      weaknesses.push({
        category: 'defensive',
        type: 'weakness',
        title: 'Exceso de errores defensivos',
        description: `El equipo cometió ${errors} errores, creando situaciones peligrosas para el rival.`,
        metrics: ['errores'],
        severity: 'high',
      });
    }
    
    const conversion = shots > 0 ? (goals / shots) * 100 : 0;
    if (conversion < 10 && shots >= 10) {
      weaknesses.push({
        category: 'offensive',
        type: 'weakness',
        title: 'Baja eficacia de conversión',
        description: `A pesar de generar ${shots} remates, la conversión fue solo del ${conversion.toFixed(1)}%.`,
        metrics: ['conversión', 'remates'],
        severity: 'high',
      });
    }
    
    if (xG !== undefined && goals < xG - 0.5) {
      weaknesses.push({
        category: 'offensive',
        type: 'weakness',
        title: 'Desempeño inferior al xG',
        description: `El equipo generó ${xG.toFixed(2)} xG pero solo convirtió ${goals} goles, indicando baja eficacia en finalización.`,
        metrics: ['xG', 'goles'],
        severity: 'medium',
      });
    }
    
    return weaknesses;
  }
  
  generateKeyMoments(): MatchInsight[] {
    const moments: MatchInsight[] = [];
    const { shots, goals, errors, result } = this.context;
    
    if (goals >= 3) {
      moments.push({
        category: 'offensive',
        type: 'key_moment',
        title: 'Producción goleadora',
        description: `El equipo encontró el arco en ${goals} ocasiones, demostrando eficacia en los momentos decisivos.`,
        metrics: ['goles'],
      });
    }
    
    if (shots >= 15) {
      moments.push({
        category: 'offensive',
        type: 'key_moment',
        title: 'Alta producción ofensiva',
        description: `El equipo generó ${shots} remates, manteniendo presión constante sobre la defensa rival.`,
        metrics: ['remates'],
      });
    }
    
    if (errors > 15) {
      moments.push({
        category: 'defensive',
        type: 'key_moment',
        title: 'Errores en momentos críticos',
        description: `La acumulación de ${errors} errores comprometió la estabilidad defensiva en momentos clave.`,
        metrics: ['errores'],
        severity: 'high',
      });
    }
    
    return moments;
  }
  
  generateTrends(): MatchInsight[] {
    const trends: MatchInsight[] = [];
    // This would require comparing with historical data
    // For now, return empty array
    return trends;
  }
  
  generateRecommendations(): MatchInsight[] {
    const recommendations: MatchInsight[] = [];
    const { passAccuracy, errors, shots, conversion, possession, goals } = this.context;
    
    if (passAccuracy < 70) {
      recommendations.push({
        category: 'tactical',
        type: 'recommendation',
        title: 'Mejorar precisión de pase',
        description: 'Trabajar en ejercicios de pase bajo presión para reducir pérdidas en construcción.',
        severity: 'high',
      });
    }
    
    if (errors > 8) {
      recommendations.push({
        category: 'defensive',
        type: 'recommendation',
        title: 'Reducir errores defensivos',
        description: 'Enfatizar la concentración y toma de decisiones en situaciones de presión.',
        severity: 'high',
      });
    }
    
    const calculatedConversion = conversion ?? (shots > 0 ? (goals / shots) * 100 : 0);
    if (calculatedConversion < 15 && shots >= 8) {
      recommendations.push({
        category: 'offensive',
        type: 'recommendation',
        title: 'Incrementar eficacia ofensiva',
        description: 'Mejorar la calidad de los remates y la toma de decisiones en área.',
        severity: 'high',
      });
    }
    
    if (possession < 50) {
      recommendations.push({
        category: 'tactical',
        type: 'recommendation',
        title: 'Mejor control territorial',
        description: 'Trabajar en la retención del balón y progresión ordenada desde atrás.',
        severity: 'medium',
      });
    }
    
    return recommendations;
  }
  
  generateAllInsights(): {
    executiveSummary: string;
    strengths: MatchInsight[];
    weaknesses: MatchInsight[];
    keyMoments: MatchInsight[];
    trends: MatchInsight[];
    recommendations: MatchInsight[];
  } {
    return {
      executiveSummary: this.generateExecutiveSummary(),
      strengths: this.generateStrengths(),
      weaknesses: this.generateWeaknesses(),
      keyMoments: this.generateKeyMoments(),
      trends: this.generateTrends(),
      recommendations: this.generateRecommendations(),
    };
  }
}

export function generateMatchInsights(context: MatchContext) {
  const generator = new InsightGenerator(context);
  return generator.generateAllInsights();
}
