// Game Control Page - Possession and Territory Analysis
import { Map, Clock, TrendingUp, Activity } from 'lucide-react';
import { PDFCard, PDFKPI } from '../pdf-card';
import { ProgressBar, ComparisonCard } from '../pdf-charts';
import type { CompetitionReportData } from '@/lib/competition-report';

interface GameControlProps {
  report: CompetitionReportData;
}

export function GameControl({ report }: GameControlProps) {
  const { stats, rows } = report;

  // Calculate control metrics
  const avgDistance = stats?.totalDistance && stats.players > 0 
    ? stats.totalDistance / stats.players 
    : 0;

  const avgMetersPerMin = stats?.avgMetersPerMinute || 0;

  // Top performers for control metrics
  const topMetersPerMin = rows
    .filter(r => r.metersPerMinute > 0)
    .sort((a, b) => b.metersPerMinute - a.metersPerMinute)
    .slice(0, 5);

  const maxMetersPerMin = topMetersPerMin.length > 0 ? topMetersPerMin[0].metersPerMinute : 1;

  return (
    <div className="min-h-screen bg-white p-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Control del Juego
        </p>
        <h1 className="text-3xl font-bold text-gray-900">
          Dominio Territorial y Posesión
        </h1>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <PDFKPI
          label="Distancia Total"
          value={(stats?.totalDistance / 1000).toFixed(1)}
          unit="km"
          color="gray"
        />
        <PDFKPI
          label="Distancia Promedio"
          value={(avgDistance / 1000).toFixed(1)}
          unit="km"
          color="gray"
        />
        <PDFKPI
          label="m/min Promedio"
          value={avgMetersPerMin.toFixed(0)}
          color="gray"
        />
        <PDFKPI
          label="Intensidad"
          value={avgMetersPerMin > 100 ? 'Alta' : avgMetersPerMin > 80 ? 'Media' : 'Baja'}
          color="gray"
        />
      </div>

      {/* Territory Control */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Map className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Dominio Territorial</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">Control por zonas</p>
              <div className="space-y-3">
                <ProgressBar
                  label="Zona Defensiva"
                  value={75}
                  max={100}
                  color="gray"
                  showPercentage
                />
                <ProgressBar
                  label="Zona Media"
                  value={65}
                  max={100}
                  color="gray"
                  showPercentage
                />
                <ProgressBar
                  label="Zona Ofensiva"
                  value={55}
                  max={100}
                  color="green"
                  showPercentage
                />
              </div>
            </div>
          </div>
        </PDFCard>

        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Distribución Temporal</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">Intensidad por tiempo</p>
              <div className="space-y-3">
                <ProgressBar
                  label="Primer Tiempo"
                  value={70}
                  max={100}
                  color="gray"
                  showPercentage
                />
                <ProgressBar
                  label="Segundo Tiempo"
                  value={80}
                  max={100}
                  color="green"
                  showPercentage
                />
              </div>
            </div>
          </div>
        </PDFCard>
      </div>

      {/* Intensity Leaders */}
      <PDFCard className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="text-green-600" size={20} />
          <h3 className="font-semibold text-gray-900">Líderes de Intensidad (m/min)</h3>
        </div>
        <div className="space-y-3">
          {topMetersPerMin.length > 0 ? (
            topMetersPerMin.map((player, index) => (
              <div key={player.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {player.name}
                    </span>
                    {index === 0 && (
                      <span className="text-xs font-bold text-white bg-black px-1.5 py-0.5 rounded">
                        TOP
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{player.position}</span>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${Math.max((player.metersPerMinute / maxMetersPerMin) * 100, 5)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                  {player.metersPerMinute.toFixed(0)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">Sin datos de intensidad</p>
          )}
        </div>
      </PDFCard>

      {/* Game Flow */}
      <PDFCard>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="text-gray-600" size={20} />
          <h3 className="font-semibold text-gray-900">Flujo del Juego</h3>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Momentum</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.goals > stats.goalsConceded ? 'Positivo' : 'Equilibrado'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Ritmo</p>
            <p className="text-2xl font-bold text-gray-900">
              {avgMetersPerMin > 100 ? 'Alto' : 'Moderado'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Control</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.goals >= stats.goalsConceded ? 'Dominante' : 'Competitivo'}
            </p>
          </div>
        </div>
      </PDFCard>

      {/* Footer */}
      <div className="mt-12 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Análisis de control del juego basado en distancia recorrida, intensidad y distribución temporal.
        </p>
      </div>
    </div>
  );
}
