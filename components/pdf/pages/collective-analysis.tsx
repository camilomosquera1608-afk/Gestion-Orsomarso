// Collective Analysis Page - Visual Team Performance
import { Users, Target, Shield, Zap, TrendingUp } from 'lucide-react';
import { PDFCard, PDFKPI } from '../pdf-card';
import { ProgressBar, RankingBar, ComparisonCard, DonutChart } from '../pdf-charts';
import type { CompetitionReportData } from '@/lib/competition-report';

interface CollectiveAnalysisProps {
  report: CompetitionReportData;
}

export function CollectiveAnalysis({ report }: CollectiveAnalysisProps) {
  const { stats, rows } = report;

  // Calculate team metrics
  const avgDistance = stats?.totalDistance && stats.players > 0 
    ? stats.totalDistance / stats.players 
    : 0;
  
  const avgPlayerLoad = stats?.playerLoad && stats.players > 0 
    ? stats.playerLoad / stats.players 
    : 0;

  // Top performers for rankings
  const topDistance = rows
    .filter(r => r.totalDistance > 0)
    .sort((a, b) => b.totalDistance - a.totalDistance)
    .slice(0, 5);
  
  const topPlayerLoad = rows
    .filter(r => r.playerLoad > 0)
    .sort((a, b) => b.playerLoad - a.playerLoad)
    .slice(0, 5);

  const maxDistance = topDistance.length > 0 ? topDistance[0].totalDistance : 1;
  const maxPlayerLoad = topPlayerLoad.length > 0 ? topPlayerLoad[0].playerLoad : 1;

  return (
    <div className="min-h-screen bg-white p-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Análisis de Equipo
        </p>
        <h1 className="text-3xl font-bold text-gray-900">
          Rendimiento Colectivo
        </h1>
      </div>

      {/* Team Overview KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <PDFKPI
          label="Jugadores"
          value={stats?.players || 0}
          color="gray"
        />
        <PDFKPI
          label="Minutos Totales"
          value={stats?.minutes || 0}
          color="gray"
        />
        <PDFKPI
          label="Distancia Promedio"
          value={(avgDistance / 1000).toFixed(1)}
          unit="km"
          color="gray"
        />
        <PDFKPI
          label="Player Load Promedio"
          value={avgPlayerLoad.toFixed(0)}
          color="green"
        />
      </div>

      {/* Production Metrics */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Target className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Producción Ofensiva</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Goles</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.goals || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Asistencias</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.assists || 0}</p>
              </div>
            </div>
            <ProgressBar
              label="Eficiencia de Goles"
              value={stats?.goals || 0}
              max={Math.max(stats?.goals || 1, 3)}
              color="green"
            />
          </div>
        </PDFCard>

        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Producción Defensiva</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Goles Concedidos</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.goalsConceded || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Tarjetas Amarillas</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.yellowCards || 0}</p>
              </div>
            </div>
            <ProgressBar
              label="Disciplina"
              value={100 - (stats?.yellowCards || 0) * 10}
              max={100}
              color="gray"
            />
          </div>
        </PDFCard>
      </div>

      {/* Physical Performance Rankings */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="text-green-600" size={20} />
            <h3 className="font-semibold text-gray-900">Top 5 Distancia Total</h3>
          </div>
          <div className="space-y-3">
            {topDistance.length > 0 ? (
              topDistance.map((player, index) => (
                <RankingBar
                  key={player.id}
                  name={player.name}
                  value={player.totalDistance / 1000}
                  max={maxDistance / 1000}
                  rank={index + 1}
                  color="gray"
                />
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Sin datos de distancia</p>
            )}
          </div>
        </PDFCard>

        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-green-600" size={20} />
            <h3 className="font-semibold text-gray-900">Top 5 Player Load</h3>
          </div>
          <div className="space-y-3">
            {topPlayerLoad.length > 0 ? (
              topPlayerLoad.map((player, index) => (
                <RankingBar
                  key={player.id}
                  name={player.name}
                  value={player.playerLoad}
                  max={maxPlayerLoad}
                  rank={index + 1}
                  color="green"
                />
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Sin datos de carga</p>
            )}
          </div>
        </PDFCard>
      </div>

      {/* Team Composition */}
      <PDFCard>
        <div className="flex items-center gap-2 mb-4">
          <Users className="text-gray-600" size={20} />
          <h3 className="font-semibold text-gray-900">Composición del Equipo</h3>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <DonutChart
              value={stats?.starters || 0}
              total={stats?.players || 1}
              label="Titulares"
              color="green"
              size="md"
            />
          </div>
          <div className="text-center">
            <DonutChart
              value={stats?.substitutes || 0}
              total={stats?.players || 1}
              label="Suplentes"
              color="gray"
              size="md"
            />
          </div>
          <div className="text-center">
            <DonutChart
              value={stats?.goalkeepers || 0}
              total={stats?.players || 1}
              label="Porteros"
              color="gray"
              size="md"
            />
          </div>
        </div>
      </PDFCard>

      {/* Footer */}
      <div className="mt-12 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Análisis colectivo basado en datos de GPS y estadísticas de partido.
        </p>
      </div>
    </div>
  );
}
