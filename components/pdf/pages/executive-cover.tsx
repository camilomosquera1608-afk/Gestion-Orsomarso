// Executive Cover Page - Premium Professional Design
import { Trophy, Calendar, MapPin, Cloud, Shield } from 'lucide-react';
import { PDFKPI, PDFStatCard } from '../pdf-card';
import type { CompetitionReportData } from '@/lib/competition-report';

interface ExecutiveCoverProps {
  report: CompetitionReportData;
  clubLogo?: string;
  matchPhoto?: string;
  weather?: string;
  stadium?: string;
}

export function ExecutiveCover({ 
  report, 
  clubLogo, 
  matchPhoto, 
  weather,
  stadium 
}: ExecutiveCoverProps) {
  const { match, resultType, score, stats } = report;
  
  const resultColor = {
    'Victoria': 'text-green-600',
    'Empate': 'text-gray-600',
    'Derrota': 'text-red-600',
    'Sin resultado': 'text-gray-500',
  }[resultType];
  
  const resultBg = {
    'Victoria': 'bg-green-50 border-green-200',
    'Empate': 'bg-gray-50 border-gray-200',
    'Derrota': 'bg-red-50 border-red-200',
    'Sin resultado': 'bg-gray-50 border-gray-200',
  }[resultType];
  
  // Extract KPIs from stats or eyeball data
  const possession = 0; // Would come from eyeball stats
  const shots = 0; // Would come from eyeball stats
  const passAccuracy = 0; // Would come from eyeball stats
  const recoveries = 0; // Would come from eyeball stats
  const xG = undefined; // Would come from eyeball stats
  const playerLoad = stats?.playerLoad || 0;
  
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header Section */}
      <div className="flex items-center justify-between px-12 py-8 border-b border-gray-200">
        {clubLogo ? (
          <img src={clubLogo} alt="Club Logo" className="h-16 w-auto" />
        ) : (
          <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center">
            <Shield className="text-gray-400" size={32} />
          </div>
        )}
        <div className="text-right">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Informe de Análisis de Rendimiento
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {match.competitionName}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left Column - Match Info */}
        <div className="w-1/2 p-12 flex flex-col justify-center">
          <div className="mb-8">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Partido
            </p>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {match.opponent}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar size={16} />
                <span>{match.date}</span>
              </div>
              {stadium && (
                <div className="flex items-center gap-2">
                  <MapPin size={16} />
                  <span>{stadium}</span>
                </div>
              )}
              {weather && (
                <div className="flex items-center gap-2">
                  <Cloud size={16} />
                  <span>{weather}</span>
                </div>
              )}
            </div>
          </div>

          {/* Result Badge */}
          <div className={`inline-flex items-center px-6 py-3 rounded-lg border ${resultBg} mb-8`}>
            <Trophy className={resultColor} size={20} />
            <span className={`ml-2 text-lg font-bold ${resultColor}`}>
              {resultType}
            </span>
          </div>

          {/* Score */}
          <div className="mb-8">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Resultado
            </p>
            <p className="text-6xl font-bold text-gray-900">
              {score}
            </p>
          </div>

          {/* Match Context */}
          <div className="grid grid-cols-2 gap-4">
            <PDFStatCard
              title="Sede"
              value={match.venue === 'Local' ? 'Local' : match.venue === 'Visitante' ? 'Visitante' : 'N/A'}
              tone="gray"
            />
            <PDFStatCard
              title="Categoría"
              value={match.category}
              tone="gray"
            />
          </div>
        </div>

        {/* Right Column - Score & KPIs */}
        <div className="w-1/2 p-12 bg-gray-50 flex flex-col justify-center">
          {/* Match Photo */}
          {matchPhoto && (
            <div className="mb-8 rounded-lg overflow-hidden shadow-lg">
              <img src={matchPhoto} alt="Match Photo" className="w-full h-48 object-cover" />
            </div>
          )}

          {/* Main KPIs */}
          <div className="space-y-4">
            <PDFKPI
              label="Jugadores"
              value={stats?.players || 0}
              color="gray"
              size="lg"
            />
            <PDFKPI
              label="Minutos Totales"
              value={stats?.minutes || 0}
              color="gray"
              size="lg"
            />
            <PDFKPI
              label="Goles"
              value={stats?.goals || 0}
              color="gray"
              size="lg"
            />
            <PDFKPI
              label="Asistencias"
              value={stats?.assists || 0}
              color="gray"
              size="lg"
            />
            {playerLoad > 0 && (
              <PDFKPI
                label="Player Load"
                value={playerLoad}
                color="green"
                size="lg"
              />
            )}
            {stats?.totalDistance > 0 && (
              <PDFKPI
                label="Distancia Total"
                value={(stats.totalDistance / 1000).toFixed(1)}
                unit="km"
                color="gray"
                size="lg"
              />
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-12 py-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Generado el {new Date(report.generatedAt).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>
    </div>
  );
}
