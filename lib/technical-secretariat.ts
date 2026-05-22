import type {
  AppData,
  CaptureSource,
  Player,
  PlayerCaptureLocation,
  ScoutFollowUp,
  ScoutStatus,
  SelectionCallRecord,
  TechnicalDecision,
  TechnicalDecisionType,
  TechnicalProfile,
  TechnicalRecommendation,
  TechnicalReport,
} from '@/lib/types';

export const TECHNICAL_MODULE_LINKS = [
  { href: '/secretaria-tecnica', label: 'Panel' },
  { href: '/secretaria-tecnica/jugadores', label: 'Jugadores' },
  { href: '/secretaria-tecnica/reportes', label: 'Reportes técnicos' },
  { href: '/secretaria-tecnica/scouting', label: 'Scouting' },
  { href: '/secretaria-tecnica/selecciones', label: 'Llamados a Selección' },
  { href: '/secretaria-tecnica/mapa-captacion', label: 'Mapa de Captación' },
  { href: '/secretaria-tecnica/decisiones', label: 'Decisiones' },
] as const;

export const scoutStatusLabel: Record<ScoutStatus, string> = {
  sin_seguimiento: 'Sin seguimiento',
  nuevo: 'Nuevo',
  observado: 'Observado',
  en_seguimiento: 'En seguimiento',
  interesante: 'Interesante',
  prioridad: 'Prioridad',
  convocable: 'Convocable',
  promovible: 'Promovible',
  descartado: 'Descartado',
};

export const recommendationLabel: Record<TechnicalRecommendation, string> = {
  seguir_observando: 'Seguir observando',
  priorizar: 'Priorizar',
  convocable: 'Convocable',
  promover: 'Promover',
  descartar: 'Descartar',
  revisar_mas_adelante: 'Revisar más adelante',
};

export const decisionLabel: Record<TechnicalDecisionType, string> = {
  mantener_en_observacion: 'Mantener en observación',
  marcar_prioridad: 'Marcar prioridad',
  marcar_convocable: 'Marcar convocable',
  promover_categoria: 'Promover categoría',
  descartar: 'Descartar',
  solicitar_nuevo_reporte: 'Solicitar nuevo reporte',
  enviar_a_revision: 'Enviar a revisión',
  cerrar_seguimiento: 'Cerrar seguimiento',
};

export const captureSourceLabel: Record<CaptureSource, string> = {
  scouting: 'Scouting',
  recomendacion: 'Recomendación',
  torneo: 'Torneo',
  escuela: 'Escuela',
  club_aliado: 'Club aliado',
  prueba: 'Prueba',
  seleccion: 'Selección',
  otro: 'Otro',
};

export const selectionStatusLabel: Record<SelectionCallRecord['status'], string> = {
  preconvocado: 'Preconvocado',
  convocado: 'Convocado',
  participo: 'Participó',
  no_asistio: 'No asistió',
  descartado: 'Descartado',
  pendiente: 'Pendiente',
};

export const selectionTypeLabel: Record<SelectionCallRecord['callType'], string> = {
  microciclo: 'Microciclo',
  competencia: 'Competencia',
  amistoso: 'Amistoso',
  visoria: 'Visoría',
  entrenamiento: 'Entrenamiento',
  otro: 'Otro',
};

export const selectionLevelLabel: Record<SelectionCallRecord['selectionLevel'], string> = {
  nacional: 'Nacional',
  departamental: 'Departamental',
  regional: 'Regional',
  municipal: 'Municipal',
  otra: 'Otra',
};

export const scoreAverage = (report?: TechnicalReport | null) => {
  if (!report) return 0;
  const values = [
    report.technicalScore,
    report.tacticalScore,
    report.physicalScore,
    report.mentalScore,
    report.projectionScore,
    report.modelFitScore,
  ].filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
};

export const formatSelectionCall = (record?: SelectionCallRecord | null) => {
  if (!record) return 'Sin llamado';
  return `${record.selectionName} ${record.category} · ${selectionTypeLabel[record.callType]}`;
};

export const getLatestByDate = <T extends { date?: string; startDate?: string; createdAt?: string; updatedAt?: string }>(rows: T[]) =>
  [...rows].sort((a, b) => (b.date ?? b.startDate ?? b.updatedAt ?? b.createdAt ?? '').localeCompare(a.date ?? a.startDate ?? a.updatedAt ?? a.createdAt ?? ''))[0];

export const getPlayerTechnicalBundle = (data: AppData, playerId: string) => {
  const profile = (data.technicalProfiles ?? []).find((item) => item.playerId === playerId);
  const reports = (data.technicalReports ?? []).filter((item) => item.playerId === playerId).sort((a, b) => b.date.localeCompare(a.date));
  const followUp = (data.scoutFollowUps ?? []).find((item) => item.playerId === playerId);
  const selections = (data.selectionCallRecords ?? []).filter((item) => item.playerId === playerId).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const locations = (data.playerCaptureLocations ?? []).filter((item) => item.playerId === playerId).sort((a, b) => (b.captureDate ?? '').localeCompare(a.captureDate ?? ''));
  const primaryLocation = locations.find((item) => item.isPrimary) ?? locations[0];
  const decisions = (data.technicalDecisions ?? []).filter((item) => item.playerId === playerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    profile,
    reports,
    latestReport: reports[0],
    followUp,
    selections,
    latestSelection: selections[0],
    locations,
    primaryLocation,
    decisions,
    latestDecision: decisions[0],
  };
};

export type TechnicalPlayerRow = {
  player: Player;
  profile?: TechnicalProfile;
  followUp?: ScoutFollowUp;
  latestReport?: TechnicalReport;
  latestSelection?: SelectionCallRecord;
  primaryLocation?: PlayerCaptureLocation;
  latestDecision?: TechnicalDecision;
  globalScore: number;
};

export const buildTechnicalPlayerRows = (data: AppData): TechnicalPlayerRow[] =>
  data.players.map((player) => {
    const bundle = getPlayerTechnicalBundle(data, player.id);
    return {
      player,
      profile: bundle.profile,
      followUp: bundle.followUp,
      latestReport: bundle.latestReport,
      latestSelection: bundle.latestSelection,
      primaryLocation: bundle.primaryLocation,
      latestDecision: bundle.latestDecision,
      globalScore: scoreAverage(bundle.latestReport),
    };
  }).sort((a, b) => {
    const priority = (row: TechnicalPlayerRow) => row.followUp?.status === 'prioridad' ? 0 : row.followUp?.status === 'en_seguimiento' ? 1 : 2;
    return priority(a) - priority(b) || a.player.name.localeCompare(b.player.name);
  });

const normalize = (value?: string | null) => String(value ?? '').trim().toLowerCase();

export type CaptureMapFilters = {
  year?: string;
  category?: string;
  position?: string;
  scoutStatus?: string;
  selectionName?: string;
  selectionType?: string;
  department?: string;
  municipality?: string;
  captureSource?: string;
  responsible?: string;
};

export type CaptureZoneStats = {
  zoneId: string;
  zoneName: string;
  department?: string;
  municipality?: string;
  totalPlayers: number;
  percentage: number;
  byCategory: Record<string, number>;
  byPosition: Record<string, number>;
  byScoutStatus: Record<string, number>;
  playersWithSelection: number;
  priorityPlayers: number;
  players: Array<{
    id: string;
    name: string;
    category?: string;
    position?: string;
    scoutStatus?: string;
    lastSelectionCall?: string;
    captureSource?: string;
    municipality?: string;
    department?: string;
    latitude?: number;
    longitude?: number;
  }>;
};

const increment = (target: Record<string, number>, key?: string) => {
  const safeKey = key || 'Sin definir';
  target[safeKey] = (target[safeKey] ?? 0) + 1;
};

export const getPrimaryCaptureLocation = (locations: PlayerCaptureLocation[], playerId: string) => {
  const rows = locations.filter((item) => item.playerId === playerId).sort((a, b) => (b.captureDate ?? '').localeCompare(a.captureDate ?? ''));
  return rows.find((item) => item.isPrimary) ?? rows[0];
};

export const buildCaptureMapStats = (
  players: Player[],
  captureLocations: PlayerCaptureLocation[],
  scoutFollowUps: ScoutFollowUp[],
  selectionCalls: SelectionCallRecord[],
  filters: CaptureMapFilters = {},
) => {
  const selectionByPlayer = new Map<string, SelectionCallRecord[]>();
  selectionCalls.forEach((call) => {
    const rows = selectionByPlayer.get(call.playerId) ?? [];
    rows.push(call);
    selectionByPlayer.set(call.playerId, rows.sort((a, b) => b.startDate.localeCompare(a.startDate)));
  });
  const followByPlayer = new Map(scoutFollowUps.map((item) => [item.playerId, item]));
  const uniquePlayers = players.filter((player, index, arr) => arr.findIndex((item) => item.id === player.id) === index);

  const filtered = uniquePlayers.map((player) => {
    const location = getPrimaryCaptureLocation(captureLocations, player.id);
    const follow = followByPlayer.get(player.id);
    const selections = selectionByPlayer.get(player.id) ?? [];
    const latestSelection = selections[0];
    return { player, location, follow, selections, latestSelection };
  }).filter(({ player, location, follow, selections }) => {
    if (filters.year && filters.year !== 'all') {
      const year = location?.captureYear ? String(location.captureYear) : location?.captureDate?.slice(0, 4) ?? '';
      if (year !== filters.year) return false;
    }
    if (filters.category && filters.category !== 'all' && player.category !== filters.category) return false;
    if (filters.position && filters.position !== 'all' && player.position !== filters.position) return false;
    if (filters.scoutStatus && filters.scoutStatus !== 'all' && follow?.status !== filters.scoutStatus) return false;
    if (filters.selectionName && filters.selectionName !== 'all') {
      if (!selections.some((item) => normalize(item.selectionName) === normalize(filters.selectionName))) return false;
    }
    if (filters.selectionType && filters.selectionType !== 'all') {
      if (!selections.some((item) => item.callType === filters.selectionType)) return false;
    }
    if (filters.department && filters.department !== 'all' && normalize(location?.department) !== normalize(filters.department)) return false;
    if (filters.municipality && filters.municipality !== 'all' && normalize(location?.municipality ?? location?.city) !== normalize(filters.municipality)) return false;
    if (filters.captureSource && filters.captureSource !== 'all' && location?.captureSource !== filters.captureSource) return false;
    if (filters.responsible && filters.responsible !== 'all' && normalize(location?.capturedBy) !== normalize(filters.responsible)) return false;
    return true;
  });

  const totalPlayers = filtered.length;
  const zones = new Map<string, CaptureZoneStats>();

  filtered.forEach(({ player, location, follow, latestSelection }) => {
    const zoneName = location?.municipality || location?.city || location?.department || 'Sin zona asignada';
    const department = location?.department || (zoneName === 'Sin zona asignada' ? undefined : location?.region);
    const zoneId = `${normalize(department)}::${normalize(zoneName)}`;
    const zone = zones.get(zoneId) ?? {
      zoneId,
      zoneName,
      department,
      municipality: location?.municipality || location?.city,
      totalPlayers: 0,
      percentage: 0,
      byCategory: {},
      byPosition: {},
      byScoutStatus: {},
      playersWithSelection: 0,
      priorityPlayers: 0,
      players: [],
    };
    zone.totalPlayers += 1;
    increment(zone.byCategory, player.category);
    increment(zone.byPosition, player.position);
    increment(zone.byScoutStatus, follow ? scoutStatusLabel[follow.status] : 'Sin seguimiento');
    if (latestSelection) zone.playersWithSelection += 1;
    if (follow?.status === 'prioridad') zone.priorityPlayers += 1;
    zone.players.push({
      id: player.id,
      name: player.name,
      category: player.category,
      position: player.position,
      scoutStatus: follow ? scoutStatusLabel[follow.status] : 'Sin seguimiento',
      lastSelectionCall: latestSelection ? formatSelectionCall(latestSelection) : 'Sin llamado',
      captureSource: location ? captureSourceLabel[location.captureSource] : 'Sin fuente',
      municipality: location?.municipality || location?.city,
      department: location?.department,
      latitude: location?.latitude,
      longitude: location?.longitude,
    });
    zones.set(zoneId, zone);
  });

  const zoneRows = Array.from(zones.values()).map((zone) => ({
    ...zone,
    percentage: totalPlayers ? Number(((zone.totalPlayers / totalPlayers) * 100).toFixed(1)) : 0,
    players: zone.players.sort((a, b) => a.name.localeCompare(b.name)),
  })).sort((a, b) => b.totalPlayers - a.totalPlayers || a.zoneName.localeCompare(b.zoneName));

  return {
    totalPlayers,
    activeZones: zoneRows.filter((zone) => zone.zoneName !== 'Sin zona asignada').length,
    topZone: zoneRows[0],
    priorityPlayers: filtered.filter(({ follow }) => follow?.status === 'prioridad').length,
    playersWithSelection: filtered.filter(({ latestSelection }) => Boolean(latestSelection)).length,
    zonesWithoutRecentCapture: zoneRows.filter((zone) => zone.players.every((player) => !player.municipality)).length,
    zones: zoneRows,
  };
};

export const makeRecordId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
