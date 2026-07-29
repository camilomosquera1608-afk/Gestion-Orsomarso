// Executive Summary Page - Automatic Insights
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Target, Shield, Zap } from 'lucide-react';
import { PDFCard, PDFStatCard } from '../pdf-card';
import { generateMatchInsights, type MatchInsight } from '@/lib/pdf-insights';
import type { CompetitionReportData } from '@/lib/competition-report';

interface ExecutiveSummaryProps {
  report: CompetitionReportData;
}

export function ExecutiveSummary({ report }: ExecutiveSummaryProps) {
  // Build match context for insights
  const resultType: 'win' | 'loss' | 'draw' = 
    report.resultType === 'Victoria' ? 'win' : 
    report.resultType === 'Derrota' ? 'loss' : 'draw';
  
  const context = {
    possession: 50, // Would come from eyeball stats
    shots: report.stats?.goals || 0, // Placeholder
    shotsOnTarget: 0,
    goals: report.stats?.goals || 0,
    passAccuracy: 70, // Would come from eyeball stats
    recoveries: 20, // Would come from eyeball stats
    errors: 5, // Would come from eyeball stats
    distance: report.stats?.totalDistance || 0,
    highSpeedDistance: report.stats?.highSpeedDistance || 0,
    result: resultType,
    opponent: report.match.opponent,
    date: report.match.date,
  };

  const insights = generateMatchInsights(context);

  const InsightCard = ({ insight }: { insight: MatchInsight }) => {
    const iconMap = {
      strength: CheckCircle,
      weakness: AlertTriangle,
      key_moment: Target,
      trend: TrendingUp,
      recommendation: Zap,
    };

    const toneMap = {
      strength: 'green',
      weakness: 'red',
      key_moment: 'blue',
      trend: 'amber',
      recommendation: 'gray',
    } as const;

    const Icon = iconMap[insight.type];
    const tone = toneMap[insight.type];

    return (
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${
            tone === 'green' ? 'bg-green-50' :
            tone === 'red' ? 'bg-red-50' :
            tone === 'blue' ? 'bg-blue-50' :
            tone === 'amber' ? 'bg-amber-50' :
            'bg-gray-50'
          }`}>
            <Icon size={16} className={
              tone === 'green' ? 'text-green-600' :
              tone === 'red' ? 'text-red-600' :
              tone === 'blue' ? 'text-blue-600' :
              tone === 'amber' ? 'text-amber-600' :
              'text-gray-600'
            } />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 text-sm mb-1">
              {insight.title}
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              {insight.description}
            </p>
            {insight.metrics && (
              <div className="flex gap-2 mt-2">
                {insight.metrics.map(metric => (
                  <span key={metric} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                    {metric}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white p-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Análisis Ejecutivo
        </p>
        <h1 className="text-3xl font-bold text-gray-900">
          Resumen del Partido
        </h1>
      </div>

      {/* Executive Summary Text */}
      <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-start gap-3">
          <Target className="text-gray-600 mt-1" size={20} />
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Análisis General</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {insights.executiveSummary}
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <PDFStatCard
          title="Jugadores"
          value={report.stats?.players || 0}
          tone="gray"
        />
        <PDFStatCard
          title="Minutos"
          value={report.stats?.minutes || 0}
          tone="gray"
        />
        <PDFStatCard
          title="Goles"
          value={report.stats?.goals || 0}
          tone="gray"
        />
        <PDFStatCard
          title="Asistencias"
          value={report.stats?.assists || 0}
          tone="gray"
        />
      </div>

      {/* Strengths */}
      {insights.strengths.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="text-green-600" size={20} />
            <h3 className="font-semibold text-gray-900">Fortalezas</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {insights.strengths.map(insight => (
              <InsightCard key={insight.title} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Weaknesses */}
      {insights.weaknesses.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="text-red-600" size={20} />
            <h3 className="font-semibold text-gray-900">Áreas de Mejora</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {insights.weaknesses.map(insight => (
              <InsightCard key={insight.title} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Key Moments */}
      {insights.keyMoments.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Target className="text-blue-600" size={20} />
            <h3 className="font-semibold text-gray-900">Momentos Clave</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {insights.keyMoments.map(insight => (
              <InsightCard key={insight.title} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {insights.recommendations.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="text-amber-600" size={20} />
            <h3 className="font-semibold text-gray-900">Recomendaciones para el Cuerpo Técnico</h3>
          </div>
          <div className="space-y-3">
            {insights.recommendations.map(insight => (
              <InsightCard key={insight.title} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Este análisis se genera automáticamente basado en los datos disponibles del partido.
        </p>
      </div>
    </div>
  );
}
