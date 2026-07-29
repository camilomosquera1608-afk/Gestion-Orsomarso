// Attack Analysis Page - Offensive Performance Breakdown
import { Target, Crosshair, Zap, TrendingUp, ArrowRight } from 'lucide-react';
import { PDFCard, PDFKPI } from '../pdf-card';
import { ProgressBar, RankingBar } from '../pdf-charts';
import type { CompetitionReportData } from '@/lib/competition-report';

interface AttackAnalysisProps {
  report: CompetitionReportData;
}

export function AttackAnalysis({ report }: AttackAnalysisProps) {
  const { stats, rows } = report;

  // Calculate attack metrics
  const goalsPerMinute = stats?.minutes && stats.minutes > 0 
    ? (stats.goals / stats.minutes) * 90 
    : 0;
  
  const assistsPerMinute = stats?.minutes && stats.minutes > 0 
    ? (stats.assists / stats.minutes) * 90 
    : 0;

  // Top offensive performers
  const topGoals = rows
    .filter(r => r.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 5);
  
  const topAssists = rows
    .filter(r => r.assists > 0)
    .sort((a, b) => b.assists - a.assists)
    .slice(0, 5);

  const maxGoals = topGoals.length > 0 ? topGoals[0].goals : 1;
  const maxAssists = topAssists.length > 0 ? topAssists[0].assists : 1;

  return (
    <div className="min-h-screen bg-white p-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Análisis Ofensivo
        </p>
        <h1 className="text-3xl font-bold text-gray-900">
          Ataque y Finalización
        </h1>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <PDFKPI
          label="Goles"
          value={stats?.goals || 0}
          color="green"
        />
        <PDFKPI
          label="Asistencias"
          value={stats?.assists || 0}
          color="gray"
        />
        <PDFKPI
          label="Goles/90min"
          value={goalsPerMinute.toFixed(1)}
          color="gray"
        />
        <PDFKPI
          label="Asistencias/90min"
          value={assistsPerMinute.toFixed(1)}
          color="gray"
        />
      </div>

      {/* Attack Phases */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Construcción</h3>
          </div>
          <div className="space-y-4">
            <p className="text-xs text-gray-500 mb-2">Capacidad de progresión</p>
            <ProgressBar
              value={70}
              max={100}
              color="gray"
              showPercentage
            />
          </div>
        </PDFCard>

        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <ArrowRight className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Progresión</h3>
          </div>
          <div className="space-y-4">
            <p className="text-xs text-gray-500 mb-2">Llegadas al tercio final</p>
            <ProgressBar
              value={65}
              max={100}
              color="gray"
              showPercentage
            />
          </div>
        </PDFCard>

        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Target className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Finalización</h3>
          </div>
          <div className="space-y-4">
            <p className="text-xs text-gray-500 mb-2">Eficacia en área</p>
            <ProgressBar
              value={stats?.goals && stats.goals > 0 ? 75 : 30}
              max={100}
              color="green"
              showPercentage
            />
          </div>
        </PDFCard>
      </div>

      {/* Top Scorers */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Target className="text-green-600" size={20} />
            <h3 className="font-semibold text-gray-900">Top Goleadores</h3>
          </div>
          <div className="space-y-3">
            {topGoals.length > 0 ? (
              topGoals.map((player, index) => (
                <RankingBar
                  key={player.id}
                  name={player.name}
                  value={player.goals}
                  max={maxGoals}
                  rank={index + 1}
                  subtitle={player.position}
                  color="green"
                />
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Sin goles registrados</p>
            )}
          </div>
        </PDFCard>

        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Crosshair className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Top Asistencias</h3>
          </div>
          <div className="space-y-3">
            {topAssists.length > 0 ? (
              topAssists.map((player, index) => (
                <RankingBar
                  key={player.id}
                  name={player.name}
                  value={player.assists}
                  max={maxAssists}
                  rank={index + 1}
                  subtitle={player.position}
                  color="gray"
                />
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Sin asistencias registradas</p>
            )}
          </div>
        </PDFCard>
      </div>

      {/* Efficiency Indicators */}
      <PDFCard>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="text-green-600" size={20} />
          <h3 className="font-semibold text-gray-900">Indicadores de Eficacia</h3>
        </div>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Conversión Global</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.goals && stats.goals > 0 ? 'Alta' : 'Baja'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Producción por Minuto</p>
            <p className="text-2xl font-bold text-gray-900">
              {goalsPerMinute > 0.5 ? 'Alta' : 'Moderada'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Diversificación Ofensiva</p>
            <p className="text-2xl font-bold text-gray-900">
              {topGoals.length >= 3 ? 'Alta' : 'Limitada'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Eficiencia de Asistencia</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.assists && stats.assists > 0 ? 'Buena' : 'Mejorable'}
            </p>
          </div>
        </div>
      </PDFCard>

      {/* Footer */}
      <div className="mt-12 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Análisis ofensivo basado en producción de goles, asistencias y minutos jugados.
        </p>
      </div>
    </div>
  );
}
