// Physical Load Page - GPS Rankings and Percentiles
import { Zap, Activity, TrendingUp, Gauge, Award } from 'lucide-react';
import { PDFCard, PDFKPI } from '../pdf-card';
import { RankingBar, HeatIndicator } from '../pdf-charts';
import type { CompetitionReportData } from '@/lib/competition-report';

interface PhysicalLoadProps {
  report: CompetitionReportData;
}

export function PhysicalLoad({ report }: PhysicalLoadProps) {
  const { stats, rows } = report;

  // Calculate rankings for different metrics
  const topDistance = rows
    .filter(r => r.totalDistance > 0)
    .sort((a, b) => b.totalDistance - a.totalDistance)
    .slice(0, 5);
  
  const topHSR = rows
    .filter(r => r.highSpeedDistance > 0)
    .sort((a, b) => b.highSpeedDistance - a.highSpeedDistance)
    .slice(0, 5);
  
  const topPlayerLoad = rows
    .filter(r => r.playerLoad > 0)
    .sort((a, b) => b.playerLoad - a.playerLoad)
    .slice(0, 5);
  
  const topSprints = rows
    .filter(r => r.sprints > 0)
    .sort((a, b) => b.sprints - a.sprints)
    .slice(0, 5);
  
  const topACC = rows
    .filter(r => r.acc > 0)
    .sort((a, b) => b.acc - a.acc)
    .slice(0, 5);
  
  const topDCC = rows
    .filter(r => r.dcc > 0)
    .sort((a, b) => b.dcc - a.dcc)
    .slice(0, 5);
  
  const topRHIE = rows
    .filter(r => r.rhie > 0)
    .sort((a, b) => b.rhie - a.rhie)
    .slice(0, 5);

  const maxDistance = topDistance.length > 0 ? topDistance[0].totalDistance : 1;
  const maxHSR = topHSR.length > 0 ? topHSR[0].highSpeedDistance : 1;
  const maxPlayerLoad = topPlayerLoad.length > 0 ? topPlayerLoad[0].playerLoad : 1;
  const maxSprints = topSprints.length > 0 ? topSprints[0].sprints : 1;
  const maxACC = topACC.length > 0 ? topACC[0].acc : 1;
  const maxDCC = topDCC.length > 0 ? topDCC[0].dcc : 1;
  const maxRHIE = topRHIE.length > 0 ? topRHIE[0].rhie : 1;

  // Calculate percentiles (simplified - would need historical data for real percentiles)
  const getPercentile = (value: number, max: number) => {
    if (max === 0) return 0;
    return Math.round((value / max) * 100);
  };

  return (
    <div className="min-h-screen bg-white p-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Carga Física
        </p>
        <h1 className="text-3xl font-bold text-gray-900">
          Rendimiento GPS y Métricas de Carga
        </h1>
      </div>

      {/* Team Physical Overview */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <PDFKPI
          label="Distancia Total"
          value={(stats?.totalDistance / 1000).toFixed(1)}
          unit="km"
          color="gray"
        />
        <PDFKPI
          label="Player Load"
          value={stats?.playerLoad?.toFixed(0) || 0}
          color="green"
        />
        <PDFKPI
          label="HSR Total"
          value={(stats?.highSpeedDistance / 1000).toFixed(1)}
          unit="km"
          color="gray"
        />
        <PDFKPI
          label="Sprints Totales"
          value={stats?.sprints || 0}
          color="gray"
        />
      </div>

      {/* Distance Rankings */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="text-green-600" size={20} />
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
                  subtitle={`${player.position} · ${getPercentile(player.totalDistance, maxDistance)}%`}
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
            <Zap className="text-green-600" size={20} />
            <h3 className="font-semibold text-gray-900">Top 5 Alta Velocidad (HSR)</h3>
          </div>
          <div className="space-y-3">
            {topHSR.length > 0 ? (
              topHSR.map((player, index) => (
                <RankingBar
                  key={player.id}
                  name={player.name}
                  value={player.highSpeedDistance / 1000}
                  max={maxHSR / 1000}
                  rank={index + 1}
                  subtitle={`${player.position} · ${getPercentile(player.highSpeedDistance, maxHSR)}%`}
                  color="green"
                />
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Sin datos de HSR</p>
            )}
          </div>
        </PDFCard>
      </div>

      {/* Neuromuscular Rankings */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Top 5 Sprints</h3>
          </div>
          <div className="space-y-3">
            {topSprints.length > 0 ? (
              topSprints.map((player, index) => (
                <RankingBar
                  key={player.id}
                  name={player.name}
                  value={player.sprints}
                  max={maxSprints}
                  rank={index + 1}
                  subtitle={player.position}
                  color="gray"
                />
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Sin datos de sprints</p>
            )}
          </div>
        </PDFCard>

        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Top 5 ACC</h3>
          </div>
          <div className="space-y-3">
            {topACC.length > 0 ? (
              topACC.map((player, index) => (
                <RankingBar
                  key={player.id}
                  name={player.name}
                  value={player.acc}
                  max={maxACC}
                  rank={index + 1}
                  subtitle={player.position}
                  color="gray"
                />
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Sin datos de ACC</p>
            )}
          </div>
        </PDFCard>

        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Top 5 DCC</h3>
          </div>
          <div className="space-y-3">
            {topDCC.length > 0 ? (
              topDCC.map((player, index) => (
                <RankingBar
                  key={player.id}
                  name={player.name}
                  value={player.dcc}
                  max={maxDCC}
                  rank={index + 1}
                  subtitle={player.position}
                  color="gray"
                />
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Sin datos de DCC</p>
            )}
          </div>
        </PDFCard>
      </div>

      {/* Player Load and RHIE */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Award className="text-green-600" size={20} />
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
                  subtitle={`${player.position} · ${getPercentile(player.playerLoad, maxPlayerLoad)}%`}
                  color="green"
                />
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Sin datos de carga</p>
            )}
          </div>
        </PDFCard>

        <PDFCard>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Top 5 RHIE</h3>
          </div>
          <div className="space-y-3">
            {topRHIE.length > 0 ? (
              topRHIE.map((player, index) => (
                <RankingBar
                  key={player.id}
                  name={player.name}
                  value={player.rhie}
                  max={maxRHIE}
                  rank={index + 1}
                  subtitle={player.position}
                  color="gray"
                />
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Sin datos de RHIE</p>
            )}
          </div>
        </PDFCard>
      </div>

      {/* Physical Load Summary */}
      <PDFCard>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="text-gray-600" size={20} />
          <h3 className="font-semibold text-gray-900">Resumen de Carga Física</h3>
        </div>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Intensidad Global</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.playerLoad && stats.playerLoad > 500 ? 'Alta' : stats?.playerLoad && stats.playerLoad > 300 ? 'Media' : 'Baja'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Volumen</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.totalDistance && stats.totalDistance > 100000 ? 'Alto' : stats?.totalDistance && stats.totalDistance > 80000 ? 'Medio' : 'Bajo'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Explosividad</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.sprints && stats.sprints > 50 ? 'Alta' : stats?.sprints && stats.sprints > 30 ? 'Media' : 'Baja'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Neuromuscular</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.acc && stats.acc > 100 ? 'Alta' : stats?.acc && stats.acc > 50 ? 'Media' : 'Baja'}
            </p>
          </div>
        </div>
      </PDFCard>

      {/* Footer */}
      <div className="mt-12 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Análisis de carga física basado en datos GPS: distancia, HSR, sprints, ACC, DCC, RHIE y Player Load.
        </p>
      </div>
    </div>
  );
}
