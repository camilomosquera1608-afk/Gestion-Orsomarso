import { AppData, ClubCategory, FMSRecord, NutritionRecord, NeuromuscularRecord, CMJRecord, Player } from './types';
import { categoryLabel } from './labels';

export type EvaluationReportMode = 'individual' | 'group';
export type EvaluationReportTone = 'green' | 'blue' | 'red' | 'amber' | 'neutral' | 'dark';

export interface EvaluationFmsRow extends FMSRecord {
  total: number;
}

export type EvaluationNeuromuscularRow = NeuromuscularRecord;
export type EvaluationCmjRow = CMJRecord;

export interface EvaluationReportData {
  mode: EvaluationReportMode;
  player?: Player;
  category: ClubCategory;
  referenceDate: string;
  generatedAt: string;
  title: string;
  subtitle: string;
  executiveSummary: string;
  latestNutrition?: NutritionRecord;
  previousNutrition?: NutritionRecord;
  latestNeuromuscular?: EvaluationNeuromuscularRow;
  previousNeuromuscular?: EvaluationNeuromuscularRow;
  latestCmj?: EvaluationCmjRow;
  previousCmj?: EvaluationCmjRow;
  latestFms?: EvaluationFmsRow;
  previousFms?: EvaluationFmsRow;
  nutritionHistory: NutritionRecord[];
  neuromuscularHistory: EvaluationNeuromuscularRow[];
  cmjHistory: EvaluationCmjRow[];
  fmsHistory: EvaluationFmsRow[];
  group: {
    players: number;
    nutrition: number;
    neuromuscular: number;
    cmj: number;
    fms: number;
    cmjAverage: number;
    fmsAverage: number;
  };
  improvementNotes: string[];
}

const formatGeneratedAt = () => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date());

const safeNumber = (value: number | undefined | null) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const withFmsTotal = (record: FMSRecord): EvaluationFmsRow => ({
  ...record,
  total:
    safeNumber(record.shoulderMobility) +
    safeNumber(record.squat) +
    safeNumber(record.legRaise) +
    safeNumber(record.hurdleStep) +
    safeNumber(record.lunge) +
    safeNumber(record.trunkStability) +
    safeNumber(record.rotaryStability),
});

const safeDateText = (value: unknown) => String(value ?? '');
const validDateRecord = <T extends { date?: string | null }>(item: T | null | undefined): item is T => Boolean(item && safeDateText(item.date));
const sortLatest = <T extends { date?: string | null }>(items: T[]) =>
  items
    .filter(validDateRecord)
    .slice()
    .sort((a, b) => safeDateText(b.date).localeCompare(safeDateText(a.date)));

const latestByPlayer = <T extends { playerId?: string | null; date?: string | null }>(items: T[]) => Object.values(items.reduce<Record<string, T>>((acc, item) => {
  const playerId = String(item.playerId ?? '').trim();
  const date = safeDateText(item.date);
  if (!playerId || !date) return acc;
  const current = acc[playerId];
  if (!current || date > safeDateText(current.date)) acc[playerId] = item;
  return acc;
}, {}));

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const deltaText = (label: string, current?: number, previous?: number, suffix = '') => {
  if (typeof current !== 'number' || typeof previous !== 'number') return undefined;
  const delta = current - previous;
  const sign = delta > 0 ? '+' : '';
  return `${label}: ${sign}${delta.toFixed(1)}${suffix}`;
};

export const buildEvaluationsReportData = ({
  data,
  player,
  activeCategory,
  referenceDate,
}: {
  data: AppData;
  player?: Player;
  activeCategory: ClubCategory;
  referenceDate: string;
}): EvaluationReportData => {
  const categoryPlayers = data.players.filter((item) => item.category === activeCategory);
  const categoryPlayerIds = new Set(categoryPlayers.map((item) => item.id));
  const mode: EvaluationReportMode = player ? 'individual' : 'group';
  const selectedPlayerId = player?.id ?? '';

  const nutritionHistory = sortLatest(data.nutritionRecords.filter((record) => record.playerId === selectedPlayerId));
  const neuromuscularHistory = sortLatest(data.neuromuscularRecords.filter((record) => record.playerId === selectedPlayerId));
  const cmjHistory = sortLatest(data.cmjRecords.filter((record) => record.playerId === selectedPlayerId));
  const fmsHistory = sortLatest(data.fmsRecords.filter((record) => record.playerId === selectedPlayerId).map(withFmsTotal));

  const latestNutrition = nutritionHistory[0];
  const previousNutrition = nutritionHistory[1];
  const latestNeuromuscular = neuromuscularHistory[0];
  const previousNeuromuscular = neuromuscularHistory[1];
  const latestCmj = cmjHistory[0];
  const previousCmj = cmjHistory[1];
  const latestFms = fmsHistory[0];
  const previousFms = fmsHistory[1];

  const latestNutritionGroup = latestByPlayer(data.nutritionRecords.filter((record) => categoryPlayerIds.has(record.playerId)));
  const latestNeuroGroup = latestByPlayer(data.neuromuscularRecords.filter((record) => categoryPlayerIds.has(record.playerId)));
  const latestCmjGroup = latestByPlayer(data.cmjRecords.filter((record) => categoryPlayerIds.has(record.playerId)));
  const latestFmsGroup = latestByPlayer(data.fmsRecords.filter((record) => categoryPlayerIds.has(record.playerId)).map(withFmsTotal));
  const cmjAverage = latestCmjGroup.length ? latestCmjGroup.reduce((acc, row) => acc + safeNumber(row.value), 0) / latestCmjGroup.length : 0;
  const fmsAverage = latestFmsGroup.length ? latestFmsGroup.reduce((acc, row) => acc + safeNumber(row.total), 0) / latestFmsGroup.length : 0;

  const notes: string[] = [];

  const executiveSummary = '';

  return {
    mode,
    player,
    category: activeCategory,
    referenceDate,
    generatedAt: formatGeneratedAt(),
    title: 'Informe de valoraciones',
    subtitle: mode === 'individual' && player ? `Jugador: ${player.name}` : `Categoria ${categoryLabel(activeCategory)}`,
    executiveSummary,
    latestNutrition,
    previousNutrition,
    latestNeuromuscular,
    previousNeuromuscular,
    latestCmj,
    previousCmj,
    latestFms,
    previousFms,
    nutritionHistory,
    neuromuscularHistory,
    cmjHistory,
    fmsHistory,
    group: {
      players: categoryPlayers.length,
      nutrition: latestNutritionGroup.length,
      neuromuscular: latestNeuroGroup.length,
      cmj: latestCmjGroup.length,
      fms: latestFmsGroup.length,
      cmjAverage,
      fmsAverage,
    },
    improvementNotes: notes,
  };
};
