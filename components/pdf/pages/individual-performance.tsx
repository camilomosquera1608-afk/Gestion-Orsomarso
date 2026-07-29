// Individual Performance Page - Player Cards with Technical and Physical Metrics
import { User, Activity, Target, Shield, Award, Clock } from 'lucide-react';
import { PDFCard, PDFKPI } from '../pdf-card';
import { ProgressBar } from '../pdf-charts';
import type { CompetitionReportData } from '@/lib/competition-report';

interface IndividualPerformanceProps {
  report: CompetitionReportData;
}

export function IndividualPerformance({ report }: IndividualPerformanceProps) {
  const { rows } = report;

  // Calculate performance rating for each player
  const getPlayerRating = (player: typeof rows[0]) => {
    let score = 0;
    let maxScore = 0;

    // Technical metrics
    if (player.goals > 0) {
      score += player.goals * 10;
      maxScore += 30;
    }
    if (player.assists > 0) {
      score += player.assists * 8;
      maxScore += 24;
    }
    if (player.yellowCards === 0) {
      score += 5;
      maxScore += 5;
    }
    if (player.redCards === 0) {
      score += 5;
      maxScore += 5;
    }

    // Physical metrics
    if (player.totalDistance > 0) {
      score += Math.min(player.totalDistance / 10000, 10);
      maxScore += 10;
    }
    if (player.playerLoad > 0) {
      score += Math.min(player.playerLoad / 100, 10);
      maxScore += 10;
    }
    if (player.highSpeedDistance > 0) {
      score += Math.min(player.highSpeedDistance / 500, 10);
      maxScore += 10;
    }

    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 50;
    
    if (percentage >= 80) return { rating: 'Excelente', color: 'green' as const, percentage };
    if (percentage >= 60) return { rating: 'Bueno', color: 'green' as const, percentage };
    if (percentage >= 40) return { rating: 'Regular', color: 'amber' as const, percentage };
    return { rating: 'Mejorable', color: 'red' as const, percentage };
  };

  const PlayerCard = ({ player }: { player: typeof rows[0] }) => {
    const { rating, color, percentage } = getPlayerRating(player);
    const initials = player.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    const colorStyles = {
      green: 'bg-green-50 border-green-200',
      amber: 'bg-amber-50 border-amber-200',
      red: 'bg-red-50 border-red-200',
    };

    const textColorStyles = {
      green: 'text-green-700',
      amber: 'text-amber-700',
      red: 'text-red-700',
    };

    return (
      <div className={`border rounded-lg p-4 ${colorStyles[color]}`}>
        <div className="flex items-start gap-4">
          {/* Player Avatar */}
          <div className="flex-shrink-0">
            {player.photoUrl ? (
              <img src={player.photoUrl} alt={player.name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-600 font-bold text-lg">{initials}</span>
              </div>
            )}
          </div>

          {/* Player Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-gray-900 truncate">{player.name}</h4>
                <p className="text-xs text-gray-500">{player.position}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded ${colorStyles[color]} ${textColorStyles[color]}`}>
                {rating}
              </span>
            </div>

            {/* Minutes */}
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-gray-400" />
              <span className="text-sm text-gray-600">{player.minutes} min</span>
            </div>

            {/* Technical Metrics */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="text-center">
                <p className="text-xs text-gray-500">Goles</p>
                <p className="text-sm font-semibold text-gray-900">{player.goals}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Asist</p>
                <p className="text-sm font-semibold text-gray-900">{player.assists}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Amar</p>
                <p className="text-sm font-semibold text-gray-900">{player.yellowCards}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Rojas</p>
                <p className="text-sm font-semibold text-gray-900">{player.redCards}</p>
              </div>
            </div>

            {/* Physical Metrics */}
            {player.totalDistance > 0 && (
              <div className="space-y-2">
                <ProgressBar
                  label="Distancia"
                  value={player.totalDistance / 1000}
                  max={15}
                  color="gray"
                  showPercentage={false}
                />
                {player.playerLoad > 0 && (
                  <ProgressBar
                    label="Player Load"
                    value={player.playerLoad}
                    max={400}
                    color="green"
                    showPercentage={false}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Separate by role
  const starters = rows.filter(r => r.minutes > 0 && r.role === 'Titular');
  const substitutes = rows.filter(r => r.minutes > 0 && r.role === 'Suplente');
  const nonParticipants = rows.filter(r => r.minutes === 0);

  return (
    <div className="min-h-screen bg-white p-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Rendimiento Individual
        </p>
        <h1 className="text-3xl font-bold text-gray-900">
          Análisis por Jugador
        </h1>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <PDFKPI
          label="Titulares"
          value={starters.length}
          color="gray"
        />
        <PDFKPI
          label="Suplentes"
          value={substitutes.length}
          color="gray"
        />
        <PDFKPI
          label="No Participaron"
          value={nonParticipants.length}
          color="gray"
        />
        <PDFKPI
          label="Total"
          value={rows.length}
          color="gray"
        />
      </div>

      {/* Starters */}
      {starters.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Award className="text-green-600" size={20} />
            <h3 className="font-semibold text-gray-900">Titulares</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {starters.map(player => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>
        </div>
      )}

      {/* Substitutes */}
      {substitutes.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="text-gray-600" size={20} />
            <h3 className="font-semibold text-gray-900">Suplentes</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {substitutes.map(player => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>
        </div>
      )}

      {/* Non Participants */}
      {nonParticipants.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <User className="text-gray-400" size={20} />
            <h3 className="font-semibold text-gray-900">No Participaron</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {nonParticipants.map(player => (
              <div key={player.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-600 font-bold text-sm">
                      {player.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate">{player.name}</p>
                    <p className="text-xs text-gray-500">{player.position}</p>
                  </div>
                </div>
                {player.medicalStatus && player.medicalStatus !== 'Sin lesión' && (
                  <p className="text-xs text-red-600 mt-2">{player.medicalStatus}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Análisis individual basado en métricas técnicas (goles, asistencias, tarjetas) y físicas (GPS).
        </p>
      </div>
    </div>
  );
}
