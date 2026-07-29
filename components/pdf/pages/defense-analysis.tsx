// Defense Analysis Page - Defensive Performance Breakdown
import { Shield, AlertTriangle, CheckCircle, TrendingDown, Lock } from 'lucide-react';
import { PDFCard, PDFKPI } from '../pdf-card';
import { ProgressBar } from '../pdf-charts';
import type { CompetitionReportData } from '@/lib/competition-report';

interface DefenseAnalysisProps {
  report: CompetitionReportData;
}

export function DefenseAnalysis({ report }: DefenseAnalysisProps) {
  const { stats, rows } = report;

  // Calculate defensive metrics
  const goalsConcededPer90 = stats?.minutes && stats.minutes > 0 
    ? (stats.goalsConceded / stats.minutes) * 90 
    : 0;
  
  const yellowCardsPer90 = stats?.minutes && stats.minutes > 0 
    ? (stats.yellowCards / stats.minutes) * 90 
    : 0;

  // Goalkeeper performance
  const goalkeepers = rows.filter(r => r.isGoalkeeper);
  const totalGoalsPrevented = goalkeepers.reduce((sum, gk) => sum + gk.goalsPrevented, 0);
  const totalPenaltiesSaved = goalkeepers.reduce((sum, gk) => sum + gk.penaltiesSaved, 0);

  return (
    <div className="min-h-screen bg-white p-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Análisis Defensivo
        </p>
        <h1 className="text-3xl font-bold text-gray-900">
          Defensa y Organización
        </h1>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <PDFKPI
          label="Goles Concedidos"
          value={stats?.goalsConceded || 0}
          color="gray"
        />
        <PDFKPI
          label="Goles/90min"
          value={goalsConcededPer90.toFixed(1)}
          color="gray"
        />
        <PDFKPI
          label="Tarjetas Amarillas"
          value={stats?.yellowCards || 0}
          color="gray"
        />
        <PDFKPI
          label="Tarjetas Rojas"
          value={stats?.redCards || 0}
          color="gray"
        />
      </div>

      {/* Defensive Organization */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Presión Alta</h3>
          </div>
          <div className="space-y-4">
            <p className="text-xs text-gray-500 mb-2">Intensidad en presión</p>
            <ProgressBar
              value={stats?.goalsConceded === 0 ? 80 : 60}
              max={100}
              color="green"
              showPercentage
            />
          </div>
        </PDFCard>

        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Lock className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Bloque Bajo</h3>
          </div>
          <div className="space-y-4">
            <p className="text-xs text-gray-500 mb-2">Solididad defensiva</p>
            <ProgressBar
              value={stats?.goalsConceded === 0 ? 90 : stats?.goalsConceded <= 1 ? 75 : 50}
              max={100}
              color="green"
              showPercentage
            />
          </div>
        </PDFCard>

        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Transiciones</h3>
          </div>
          <div className="space-y-4">
            <p className="text-xs text-gray-500 mb-2">Organización tras pérdida</p>
            <ProgressBar
              value={70}
              max={100}
              color="gray"
              showPercentage
            />
          </div>
        </PDFCard>
      </div>

      {/* Goalkeeper Performance */}
      {goalkeepers.length > 0 && (
        <PDFCard className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="text-green-600" size={20} />
            <h3 className="font-semibold text-gray-900">Rendimiento de Porteros</h3>
          </div>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">Goles Evitados</p>
              <p className="text-2xl font-bold text-gray-900">{totalGoalsPrevented}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Penalties Atajados</p>
              <p className="text-2xl font-bold text-gray-900">{totalPenaltiesSaved}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Centros Defendidos</p>
              <p className="text-2xl font-bold text-gray-900">
                {goalkeepers.reduce((sum, gk) => sum + gk.crossesDefended, 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Acciones de Pie</p>
              <p className="text-2xl font-bold text-gray-900">
                {goalkeepers.reduce((sum, gk) => sum + gk.footworkActions, 0)}
              </p>
            </div>
          </div>
        </PDFCard>
      )}

      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="text-green-600" size={20} />
            <h3 className="font-semibold text-gray-900">Fortalezas Defensivas</h3>
          </div>
          <div className="space-y-3">
            {stats?.goalsConceded === 0 && (
              <div className="flex items-start gap-2 p-2 bg-green-50 rounded">
                <CheckCircle className="text-green-600 mt-0.5" size={16} />
                <p className="text-sm text-gray-700">Portería a cero - Excelente organización defensiva</p>
              </div>
            )}
            {stats?.yellowCards === 0 && (
              <div className="flex items-start gap-2 p-2 bg-green-50 rounded">
                <CheckCircle className="text-green-600 mt-0.5" size={16} />
                <p className="text-sm text-gray-700">Sin amonestaciones - Buena disciplina táctica</p>
              </div>
            )}
            {stats?.redCards === 0 && (
              <div className="flex items-start gap-2 p-2 bg-green-50 rounded">
                <CheckCircle className="text-green-600 mt-0.5" size={16} />
                <p className="text-sm text-gray-700">Sin expulsiones - Control emocional adecuado</p>
              </div>
            )}
            {stats?.goalsConceded === 0 && stats?.yellowCards === 0 && stats?.redCards === 0 && (
              <div className="flex items-start gap-2 p-2 bg-green-50 rounded">
                <CheckCircle className="text-green-600 mt-0.5" size={16} />
                <p className="text-sm text-gray-700">Defensa impecable - Sin goles en contra ni sanciones</p>
              </div>
            )}
          </div>
        </PDFCard>

        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="text-red-600" size={20} />
            <h3 className="font-semibold text-gray-900">Áreas de Mejora</h3>
          </div>
          <div className="space-y-3">
            {stats?.goalsConceded > 0 && (
              <div className="flex items-start gap-2 p-2 bg-red-50 rounded">
                <AlertTriangle className="text-red-600 mt-0.5" size={16} />
                <p className="text-sm text-gray-700">
                  {stats.goalsConceded} {stats.goalsConceded === 1 ? 'gol concedido' : 'goles concedidos'} - Revisar situaciones defensivas
                </p>
              </div>
            )}
            {stats?.yellowCards > 2 && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 rounded">
                <AlertTriangle className="text-amber-600 mt-0.5" size={16} />
                <p className="text-sm text-gray-700">
                  {stats.yellowCards} amonestaciones - Reducir faltas innecesarias
                </p>
              </div>
            )}
            {stats?.redCards > 0 && (
              <div className="flex items-start gap-2 p-2 bg-red-50 rounded">
                <AlertTriangle className="text-red-600 mt-0.5" size={16} />
                <p className="text-sm text-gray-700">
                  {stats.redCards} expulsión{stats.redCards > 1 ? 'es' : ''} - Situación crítica a corregir
                </p>
              </div>
            )}
          </div>
        </PDFCard>
      </div>

      {/* Defensive Efficiency */}
      <PDFCard>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="text-gray-600" size={20} />
          <h3 className="font-semibold text-gray-900">Eficiencia Defensiva</h3>
        </div>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Sólidez Global</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.goalsConceded === 0 ? 'Excelente' : stats?.goalsConceded <= 1 ? 'Buena' : 'Regular'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Disciplina</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.yellowCards <= 1 ? 'Alta' : stats?.yellowCards <= 3 ? 'Moderada' : 'Baja'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Control de Juego</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.goalsConceded === 0 ? 'Dominante' : 'Competitivo'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Organización</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.redCards === 0 ? 'Estable' : 'Frágil'}
            </p>
          </div>
        </div>
      </PDFCard>

      {/* Footer */}
      <div className="mt-12 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Análisis defensivo basado en goles concedidos, tarjetas y rendimiento de porteros.
        </p>
      </div>
    </div>
  );
}
