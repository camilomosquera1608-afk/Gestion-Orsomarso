import type { AppData, CompetitionRecord, DailyExternalLoadRecord, DailyInternalLoadRecord, DailyWellnessRecord, FMSRecord, NutritionRecord, Player, StrengthPlayerResponse, StrengthSession } from './types';
import { averageWellness, calculateInternalLoad } from './utils';
import { strengthLoad } from './strength';
import { getEffectiveExternalLoads, getRelatedPlayerIds, uniqueWellnessByPlayerIdentityDate } from './relational-data';

export type PeriodReportMetricRow = Record<string, string | number>;

export interface PlayerPeriodReport {
  player: Player;
  startDate: string;
  endDate: string;
  summaryRows: PeriodReportMetricRow[];
  wellnessRows: PeriodReportMetricRow[];
  internalRows: PeriodReportMetricRow[];
  externalRows: PeriodReportMetricRow[];
  strengthRows: PeriodReportMetricRow[];
  competitionRows: PeriodReportMetricRow[];
  evaluationRows: PeriodReportMetricRow[];
  csvRows: PeriodReportMetricRow[];
}

const asNumber = (value: unknown, fallback = 0) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const round = (value: number, decimals = 1) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const avg = (values: number[], decimals = 1) => values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length, decimals) : 0;
const sum = (values: number[]) => round(values.reduce((total, value) => total + value, 0), 1);

const inDateRange = (date: string | undefined, startDate: string, endDate: string) => {
  if (!date) return false;
  return date >= startDate && date <= endDate;
};

const byDateAsc = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);

const flattenRows = (section: string, rows: PeriodReportMetricRow[]) => rows.map((row) => ({ seccion: section, ...row }));

const wellnessRow = (record: DailyWellnessRecord): PeriodReportMetricRow => ({
  fecha: record.date,
  sueno: record.sleep,
  energia: record.fatigue,
  tranquilidad: record.stress,
  estado_muscular: record.musclePain,
  animo: record.mood,
  wellness_promedio: averageWellness(record),
});

const internalRow = (record: DailyInternalLoadRecord): PeriodReportMetricRow => ({
  fecha: record.date,
  sesion: record.sessionNumber ?? '',
  duracion_min: record.duration,
  rpe: record.rpe,
  carga_interna_ua: calculateInternalLoad(record),
});

const externalRow = (record: DailyExternalLoadRecord): PeriodReportMetricRow => ({
  fecha: record.date,
  sesion: record.sessionNumber ?? '',
  tipo_sesion: record.sessionType ?? '',
  minutos: record.min,
  distancia_m: record.totalDistance ?? '',
  metros_min: record.distancePerMin ?? '',
  player_load: record.playerLoad ?? '',
  player_load_min: record.playerLoadPerMin ?? '',
  acc: record.acc,
  dcc: record.dcc,
  sprints: record.sprints,
  rhie: record.rhie,
  hsr_m: record.hsr ?? record.highSpeedDistance ?? '',
  sprint_m: record.sprintDistance ?? '',
  velocidad_max_kmh: record.maxVelocity ?? '',
  rpe_gps: record.rpe ?? '',
});

const competitionRow = (record: CompetitionRecord): PeriodReportMetricRow => ({
  fecha: record.date,
  rival: record.opponent,
  competencia: record.competitionName ?? '',
  minutos: record.minutesPlayed,
  goles: record.goals,
  asistencias: record.assists,
  amarillas: record.yellowCards,
  rojas: record.redCards,
  distancia_m: record.totalDistance ?? '',
  player_load: record.playerLoad ?? '',
  acc: record.acc ?? '',
  dcc: record.dcc ?? '',
  sprints: record.sprints ?? '',
  rhie: record.rhie ?? '',
  hsr_m: record.hsr ?? record.highSpeedDistance ?? '',
  sprint_m: record.sprintDistance ?? '',
  velocidad_max_kmh: record.maxVelocity ?? '',
});

const strengthRowsForPlayer = (sessions: StrengthSession[], playerIds: Set<string>, startDate: string, endDate: string): PeriodReportMetricRow[] => {
  const rows: PeriodReportMetricRow[] = [];
  sessions
    .filter((session) => inDateRange(session.date, startDate, endDate))
    .sort(byDateAsc)
    .forEach((session) => {
      const response = (session.responses ?? []).find((item) => playerIds.has(item.playerId));
      const plannedForPlayer = (session.playerIds ?? []).some((id) => playerIds.has(id)) && !(session.excludedPlayerIds ?? []).some((id) => playerIds.has(id));
      if (!plannedForPlayer && !response) return;
      const responseRpe = response?.rpe ?? '';
      rows.push({
        fecha: session.date,
        grupo: session.group,
        tipo_fuerza: session.type,
        zona: session.zone,
        intencion: session.intent ?? '',
        movimiento: session.movementPattern ?? '',
        duracion_plan_min: session.duration,
        rpe_esperado: session.expectedRpe,
        carga_planificada_ua: strengthLoad(session.duration, session.expectedRpe, session.type),
        rpe_real: responseRpe,
        carga_percibida_ua: response ? strengthLoad(session.duration, response.rpe, session.type) : '',
        completado: response?.completed ?? '',
        dolor: response?.pain ? 'Si' : response ? 'No' : '',
        zona_dolor: response?.painRegion ?? '',
        intensidad_dolor: response?.painIntensity ?? '',
      });
    });
  return rows;
};

const evaluationRowsForPlayer = (data: AppData, playerIds: Set<string>, startDate: string, endDate: string): PeriodReportMetricRow[] => {
  const nutritionRows = data.nutritionRecords
    .filter((record) => playerIds.has(record.playerId) && inDateRange(record.date, startDate, endDate))
    .sort(byDateAsc)
    .map((record: NutritionRecord) => ({
      tipo: 'Nutricion',
      fecha: record.date,
      peso_kg: record.weight,
      talla_cm: record.height,
      grasa_pct: record.bodyFat,
      suma_pliegues: record.skinfoldSum,
      masa_muscular_pct: record.muscleMassPercentage ?? '',
      imo: record.imo ?? '',
    }));

  const cmjRows = data.cmjRecords
    .filter((record) => playerIds.has(record.playerId) && inDateRange(record.date, startDate, endDate))
    .sort(byDateAsc)
    .map((record) => ({ tipo: 'CMJ', fecha: record.date, cmj: record.value }));

  const neuromuscularRows = data.neuromuscularRecords
    .filter((record) => playerIds.has(record.playerId) && inDateRange(record.date, startDate, endDate))
    .sort(byDateAsc)
    .map((record) => ({
      tipo: 'Neuromuscular',
      fecha: record.date,
      cmj: record.cmj,
      sj: record.sj,
      saltos_reactivos: record.reactiveJumps,
    }));

  const fmsRows = data.fmsRecords
    .filter((record) => playerIds.has(record.playerId) && inDateRange(record.date, startDate, endDate))
    .sort(byDateAsc)
    .map((record: FMSRecord) => ({
      tipo: 'FMS',
      fecha: record.date,
      hombro: record.shoulderMobility,
      sentadilla: record.squat,
      elevacion_pierna: record.legRaise,
      paso_valla: record.hurdleStep,
      zancada: record.lunge,
      estabilidad_tronco: record.trunkStability,
      estabilidad_rotatoria: record.rotaryStability,
      total: record.shoulderMobility + record.squat + record.legRaise + record.hurdleStep + record.lunge + record.trunkStability + record.rotaryStability,
    }));

  return [...nutritionRows, ...cmjRows, ...neuromuscularRows, ...fmsRows];
};

export const buildPlayerPeriodReport = (data: AppData, playerId: string, startDate: string, endDate: string): PlayerPeriodReport | null => {
  const player = data.players.find((item) => item.id === playerId);
  if (!player) return null;

  const relatedIds = getRelatedPlayerIds(data.players, playerId);
  const wellnessRecords = uniqueWellnessByPlayerIdentityDate(data.players, data.wellness.filter((record) => relatedIds.has(record.playerId) && inDateRange(record.date, startDate, endDate))).sort(byDateAsc);
  const internalRecords = data.internalLoads.filter((record) => relatedIds.has(record.playerId) && inDateRange(record.date, startDate, endDate)).sort(byDateAsc);
  const externalRecords = getEffectiveExternalLoads(data, { activeCategory: player.category ?? 'all', playerIds: relatedIds }).filter((record) => inDateRange(record.date, startDate, endDate)).sort(byDateAsc);
  const competitionRecords = data.competitionRecords.filter((record) => relatedIds.has(record.playerId) && inDateRange(record.date, startDate, endDate)).sort(byDateAsc);
  const strengthRows = strengthRowsForPlayer(data.strengthSessions ?? [], relatedIds, startDate, endDate);
  const evaluationRows = evaluationRowsForPlayer(data, relatedIds, startDate, endDate);

  const wellnessRows = wellnessRecords.map(wellnessRow);
  const internalRows = internalRecords.map(internalRow);
  const externalRows = externalRecords.map(externalRow);
  const competitionRows = competitionRecords.map(competitionRow);

  const wellnessValues = wellnessRecords.map(averageWellness).filter((value) => value > 0);
  const internalLoads = internalRecords.map(calculateInternalLoad);
  const durations = internalRecords.map((record) => asNumber(record.duration));
  const rpes = internalRecords.map((record) => asNumber(record.rpe)).filter((value) => value > 0);
  const externalMinutes = externalRecords.map((record) => asNumber(record.min));
  const distances = externalRecords.map((record) => asNumber(record.totalDistance));
  const playerLoads = externalRecords.map((record) => asNumber(record.playerLoad));
  const acc = externalRecords.map((record) => asNumber(record.acc));
  const dcc = externalRecords.map((record) => asNumber(record.dcc));
  const sprints = externalRecords.map((record) => asNumber(record.sprints));
  const rhie = externalRecords.map((record) => asNumber(record.rhie));
  const maxVelocities = externalRecords.map((record) => asNumber(record.maxVelocity)).filter((value) => value > 0);
  const hsr = externalRecords.map((record) => asNumber(record.hsr ?? record.highSpeedDistance));
  const sprintDistance = externalRecords.map((record) => asNumber(record.sprintDistance));
  const strengthPerceivedLoads = strengthRows.map((row) => asNumber(row.carga_percibida_ua)).filter((value) => value > 0);
  const competitionMinutes = competitionRecords.map((record) => asNumber(record.minutesPlayed));

  const summaryRows: PeriodReportMetricRow[] = [
    { indicador: 'Registros wellness', valor: wellnessRecords.length },
    { indicador: 'Wellness promedio', valor: avg(wellnessValues, 1) },
    { indicador: 'Sesiones con RPE', valor: internalRecords.length },
    { indicador: 'RPE promedio', valor: avg(rpes, 1) },
    { indicador: 'Duracion total entrenamiento min', valor: sum(durations) },
    { indicador: 'Carga interna total UA', valor: sum(internalLoads) },
    { indicador: 'Registros GPS', valor: externalRecords.length },
    { indicador: 'Minutos GPS total', valor: sum(externalMinutes) },
    { indicador: 'Distancia total m', valor: sum(distances) },
    { indicador: 'Player Load total', valor: sum(playerLoads) },
    { indicador: 'ACC total', valor: sum(acc) },
    { indicador: 'DCC total', valor: sum(dcc) },
    { indicador: 'Sprints total', valor: sum(sprints) },
    { indicador: 'RHIE total', valor: sum(rhie) },
    { indicador: 'HSR total m', valor: sum(hsr) },
    { indicador: 'Sprint total m', valor: sum(sprintDistance) },
    { indicador: 'Velocidad maxima km/h', valor: maxVelocities.length ? Math.max(...maxVelocities) : 0 },
    { indicador: 'Sesiones fuerza registradas', valor: strengthRows.length },
    { indicador: 'Carga fuerza percibida total UA', valor: sum(strengthPerceivedLoads) },
    { indicador: 'Partidos registrados', valor: competitionRecords.length },
    { indicador: 'Minutos competencia total', valor: sum(competitionMinutes) },
  ];

  const csvRows = [
    { seccion: 'Ficha', jugador: player.name, categoria: player.category ?? '', posicion: player.position, periodo_inicio: startDate, periodo_fin: endDate },
    ...flattenRows('Resumen', summaryRows),
    ...flattenRows('Wellness', wellnessRows),
    ...flattenRows('Carga interna', internalRows),
    ...flattenRows('GPS', externalRows),
    ...flattenRows('Fuerza', strengthRows),
    ...flattenRows('Competencia', competitionRows),
    ...flattenRows('Valoraciones', evaluationRows),
  ];

  return {
    player,
    startDate,
    endDate,
    summaryRows,
    wellnessRows,
    internalRows,
    externalRows,
    strengthRows,
    competitionRows,
    evaluationRows,
    csvRows,
  };
};
