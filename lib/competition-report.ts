import { AppData, ClubCategory, CompetitionMatchSummary, CompetitionRecord, MatchResultType, Microcycle, Player } from './types';
import { calculateMatchResult, findMicrocycleByDate, formatMatchScore, isGoalkeeper } from './performance-helpers';

export type CompetitionReportTone = 'green' | 'blue' | 'red' | 'amber' | 'neutral' | 'dark';

export interface CompetitionReportPlayerRow {
  id: string;
  name: string;
  position: string;
  role: string;
  minutes: number;
  isGoalkeeper: boolean;
  production: string;
  discipline: string;
  yellowCards: number;
  redCards: number;
  medicalStatus: string;
  medicalObservation: string;
  totalDistance: number;
  metersPerMinute: number;
  acc: number;
  dcc: number;
  sprints: number;
  sprintDistance: number;
  maxVelocity: number;
  playerLoad: number;
}

export interface CompetitionReportStats {
  players: number;
  starters: number;
  substitutes: number;
  goalkeepers: number;
  minutes: number;
  goals: number;
  assists: number;
  goalsConceded: number;
  goalsPrevented: number;
  yellowCards: number;
  redCards: number;
  medical: number;
  totalDistance: number;
  avgMetersPerMinute: number;
  acc: number;
  dcc: number;
  sprints: number;
  sprintDistance: number;
  maxVelocity: number;
  playerLoad: number;
}

export interface CompetitionReportData {
  match: CompetitionMatchSummary;
  microcycle?: Microcycle;
  rows: CompetitionReportPlayerRow[];
  starters: CompetitionReportPlayerRow[];
  substitutes: CompetitionReportPlayerRow[];
  goalkeepers: CompetitionReportPlayerRow[];
  medicalRows: CompetitionReportPlayerRow[];
  disciplinedRows: CompetitionReportPlayerRow[];
  stats: CompetitionReportStats;
  resultType: MatchResultType | 'Sin resultado';
  score: string;
  executiveSummary: string;
  recentMatches: CompetitionMatchSummary[];
  generatedAt: string;
}

const toSafeNumber = (value: number | undefined | null) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const plural = (count: number, singular: string, pluralValue: string) => `${count} ${count === 1 ? singular : pluralValue}`;

const resultVerb = (result: MatchResultType | 'Sin resultado') => {
  if (result === 'Victoria') return 'venció';
  if (result === 'Derrota') return 'cayó';
  if (result === 'Empate') return 'empató';
  return 'disputó';
};

export const getCompetitionResult = (match: CompetitionMatchSummary): MatchResultType | 'Sin resultado' => {
  const goalsFor = toSafeNumber(match.goalsFor);
  const goalsAgainst = toSafeNumber(match.goalsAgainst);
  if (typeof match.goalsFor === 'number' && typeof match.goalsAgainst === 'number') return calculateMatchResult(goalsFor, goalsAgainst);
  return match.resultType ?? 'Sin resultado';
};

const getPlayer = (players: Player[], playerId: string) => players.find((player) => player.id === playerId);
const getMedicalStatus = (record: CompetitionRecord) => record.medicalStatus ?? (record.postCompetitionStatus === 'Lesionado' ? 'Lesionado' : 'Sin lesión');

export const buildCompetitionReportData = ({
  data,
  match,
  records,
  activeCategory,
}: {
  data: AppData;
  match: CompetitionMatchSummary;
  records: CompetitionRecord[];
  activeCategory: ClubCategory;
}): CompetitionReportData => {
  const rows: CompetitionReportPlayerRow[] = records.map((record) => {
    const player = getPlayer(data.players, record.playerId);
    const goalkeeper = isGoalkeeper(player);
    const yellowCards = toSafeNumber(record.yellowCards);
    const redCards = toSafeNumber(record.redCards);
    const medicalStatus = getMedicalStatus(record);
    const medicalObservation = medicalStatus === 'Lesionado' ? record.medicalObservation?.trim() ?? '' : '';

    return {
      id: record.id,
      name: player?.name ?? 'Jugador no identificado',
      position: player?.position ?? '-',
      role: record.startingRole ?? '-',
      minutes: toSafeNumber(record.minutesPlayed),
      isGoalkeeper: goalkeeper,
      production: goalkeeper
        ? `GE ${toSafeNumber(record.goalsConceded)} · EV ${toSafeNumber(record.goalsPrevented)}`
        : `G ${toSafeNumber(record.goals)} · A ${toSafeNumber(record.assists)}`,
      discipline: `TA ${yellowCards} · TR ${redCards}`,
      yellowCards,
      redCards,
      medicalStatus,
      medicalObservation,
      totalDistance: toSafeNumber(record.totalDistance),
      metersPerMinute: toSafeNumber(record.minutesPlayed) > 0 ? Math.round(toSafeNumber(record.totalDistance) / Math.max(1, toSafeNumber(record.minutesPlayed))) : 0,
      acc: toSafeNumber(record.acc),
      dcc: toSafeNumber(record.dcc),
      sprints: toSafeNumber(record.sprints),
      sprintDistance: toSafeNumber(record.sprintDistance ?? record.hsr),
      maxVelocity: toSafeNumber(record.maxVelocity),
      playerLoad: toSafeNumber(record.playerLoad),
    };
  }).sort((a, b) => {
    const roleOrder = (role: string) => (role === 'Titular' ? 0 : role === 'Suplente' ? 1 : 2);
    return roleOrder(a.role) - roleOrder(b.role) || a.name.localeCompare(b.name);
  });

  const starters = rows.filter((row) => row.role === 'Titular' && !row.isGoalkeeper);
  const substitutes = rows.filter((row) => row.role === 'Suplente' && !row.isGoalkeeper);
  const goalkeepers = rows.filter((row) => row.isGoalkeeper);
  const medicalRows = rows.filter((row) => row.medicalStatus === 'Lesionado' || Boolean(row.medicalObservation));
  const disciplinedRows = rows.filter((row) => row.yellowCards > 0 || row.redCards > 0);
  const fieldRecords = records.filter((record) => !isGoalkeeper(getPlayer(data.players, record.playerId)));
  const goalkeeperRecords = records.filter((record) => isGoalkeeper(getPlayer(data.players, record.playerId)));
  const stats: CompetitionReportStats = {
    players: rows.length,
    starters: rows.filter((row) => row.role === 'Titular').length,
    substitutes: rows.filter((row) => row.role === 'Suplente').length,
    goalkeepers: goalkeepers.length,
    minutes: rows.reduce((acc, row) => acc + row.minutes, 0),
    goals: fieldRecords.reduce((acc, record) => acc + toSafeNumber(record.goals), 0),
    assists: fieldRecords.reduce((acc, record) => acc + toSafeNumber(record.assists), 0),
    goalsConceded: goalkeeperRecords.reduce((acc, record) => acc + toSafeNumber(record.goalsConceded), 0),
    goalsPrevented: goalkeeperRecords.reduce((acc, record) => acc + toSafeNumber(record.goalsPrevented), 0),
    yellowCards: rows.reduce((acc, row) => acc + row.yellowCards, 0),
    redCards: rows.reduce((acc, row) => acc + row.redCards, 0),
    medical: medicalRows.length,
    totalDistance: fieldRecords.reduce((acc, record) => acc + toSafeNumber(record.totalDistance), 0),
    avgMetersPerMinute: fieldRecords.length ? Math.round(fieldRecords.reduce((acc, record) => acc + (toSafeNumber(record.minutesPlayed) > 0 ? toSafeNumber(record.totalDistance) / Math.max(1, toSafeNumber(record.minutesPlayed)) : 0), 0) / fieldRecords.length) : 0,
    acc: fieldRecords.reduce((acc, record) => acc + toSafeNumber(record.acc), 0),
    dcc: fieldRecords.reduce((acc, record) => acc + toSafeNumber(record.dcc), 0),
    sprints: fieldRecords.reduce((acc, record) => acc + toSafeNumber(record.sprints), 0),
    sprintDistance: fieldRecords.reduce((acc, record) => acc + toSafeNumber(record.sprintDistance ?? record.hsr), 0),
    maxVelocity: fieldRecords.reduce((acc, record) => Math.max(acc, toSafeNumber(record.maxVelocity)), 0),
    playerLoad: fieldRecords.reduce((acc, record) => acc + toSafeNumber(record.playerLoad), 0),
  };

  const resultType = getCompetitionResult(match);
  const score = formatMatchScore(match);
  const microcycle = findMicrocycleByDate(data.microcycles, match.date, undefined, activeCategory);
  const generatedAt = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

  const executiveSummary = rows.length
    ? `Orsomarso SC ${resultVerb(resultType)} ${score} frente a ${match.opponent} en condición de ${match.venue ?? 'Local'}. La planilla registró ${plural(stats.players, 'jugador', 'jugadores')}, ${plural(stats.starters, 'titular', 'titulares')}, ${plural(stats.substitutes, 'suplente', 'suplentes')}, ${plural(stats.goals, 'gol', 'goles')}, ${plural(stats.assists, 'asistencia', 'asistencias')} y ${plural(stats.medical, 'incidencia médica', 'incidencias médicas')}`
    : 'Sin planilla disponible.';

  const recentMatches = data.competitionMatchSummaries
    .filter((item) => item.category === activeCategory)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return {
    match,
    microcycle,
    rows,
    starters,
    substitutes,
    goalkeepers,
    medicalRows,
    disciplinedRows,
    stats,
    resultType,
    score,
    executiveSummary,
    recentMatches,
    generatedAt,
  };
};
