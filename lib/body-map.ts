import type { ClubCategory } from '@/lib/types';

export type BodyMapSource = 'Jugador' | 'Fisioterapia' | 'Cuerpo técnico';
export type BodyMapRecordType = 'Fatiga muscular' | 'Molestia' | 'Dolor muscular' | 'Lesión confirmada' | 'Seguimiento';
export type BodyMapSide = 'Derecha' | 'Izquierda' | 'Bilateral' | 'Central';
export type BodyMapStatus = 'Abierto' | 'En seguimiento' | 'Cerrado';
export type BodyMapTrainingDecision = 'Carga completa' | 'Control preventivo' | 'Reducir carga' | 'Trabajo modificado' | 'No campo / fisioterapia';

export interface BodyMapRecord {
  id: string;
  playerId: string;
  date: string;
  source: BodyMapSource;
  type: BodyMapRecordType;
  region: string;
  side: BodyMapSide;
  intensity: number;
  limitation: boolean;
  increasesWithSprint?: boolean;
  increasesWithChangeOfDirection?: boolean;
  mechanism?: string;
  notes?: string;
  action?: string;
  restriction?: string;
  loadAllowedPct?: number;
  status: BodyMapStatus;
  category?: ClubCategory;
  createdAt: string;
}

const LOCAL_KEY = 'orsomarso-body-map-v2';
const LEGACY_KEY = 'orsomarso-body-map-v1';

export const BODY_REGIONS = [
  'Cuello', 'Hombro', 'Pectoral', 'Espalda alta', 'Lumbar', 'Abdomen/Core',
  'Cadera/Glúteo', 'Aductor', 'Isquiotibial', 'Cuádriceps', 'Rodilla', 'Gemelo/Sóleo',
  'Aquiles', 'Tobillo', 'Pie', 'Otro',
] as const;

export const BODY_REGION_RISK: Record<string, 'alto' | 'medio' | 'bajo'> = {
  Isquiotibial: 'alto',
  Aductor: 'alto',
  'Gemelo/Sóleo': 'alto',
  Aquiles: 'alto',
  Rodilla: 'alto',
  Tobillo: 'alto',
  Cuádriceps: 'medio',
  'Cadera/Glúteo': 'medio',
  Lumbar: 'medio',
  Pie: 'medio',
  'Espalda alta': 'bajo',
  Hombro: 'bajo',
  Pectoral: 'bajo',
  Cuello: 'bajo',
  'Abdomen/Core': 'medio',
  Otro: 'medio',
};

export const newBodyMapId = () => `body-map-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const todayInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const normalizeRecord = (record: any): BodyMapRecord => ({
  ...record,
  type: record.type === 'Lesión reportada' ? 'Lesión confirmada' : record.type ?? 'Dolor muscular',
  region: record.region === 'Cadera' ? 'Cadera/Glúteo' : record.region ?? 'Otro',
  intensity: Number(record.intensity ?? 0),
  limitation: Boolean(record.limitation),
  status: record.status ?? 'Abierto',
  source: record.source ?? 'Jugador',
  side: record.side ?? 'Central',
  createdAt: record.createdAt ?? new Date().toISOString(),
});

export const readBodyMapRecords = (): BodyMapRecord[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY) ?? window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeRecord) : [];
  } catch {
    return [];
  }
};

export const saveBodyMapRecords = (records: BodyMapRecord[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
};

export const appendBodyMapRecord = (record: BodyMapRecord) => {
  const current = readBodyMapRecords();
  saveBodyMapRecords([record, ...current]);
};

export const bodyMapTone = (record: Pick<BodyMapRecord, 'intensity' | 'limitation' | 'type' | 'status'>) => {
  if (record.status === 'Cerrado') return 'neutral';
  if (record.type === 'Lesión confirmada' || record.limitation || record.intensity >= 7) return 'red';
  if (record.intensity >= 4) return 'amber';
  return 'blue';
};

export const suggestedRestriction = (record: Pick<BodyMapRecord, 'region' | 'increasesWithSprint' | 'increasesWithChangeOfDirection' | 'limitation' | 'type'>) => {
  if (record.type === 'Lesión confirmada' || record.limitation) return 'No campo hasta valoración o autorización de fisioterapia.';
  if (record.region === 'Isquiotibial' || record.increasesWithSprint) return 'Evitar sprint, velocidad máxima y alta velocidad.';
  if (record.region === 'Aductor' || record.increasesWithChangeOfDirection) return 'Evitar cambios de dirección intensos, golpeos fuertes y espacios reducidos.';
  if (record.region === 'Gemelo/Sóleo' || record.region === 'Aquiles') return 'Reducir carrera, saltos, aceleraciones y volumen excéntrico.';
  if (record.region === 'Rodilla' || record.region === 'Tobillo') return 'Controlar desaceleraciones, contactos, saltos y cambios de dirección.';
  if (record.region === 'Cuádriceps') return 'Controlar aceleraciones, golpeos, frenadas y trabajo pliométrico.';
  if (record.region === 'Lumbar' || record.region === 'Cadera/Glúteo') return 'Controlar gimnasio pesado, contactos, giros y acumulación de minutos.';
  return 'Mantener seguimiento y reevaluar durante la sesión.';
};

export const getBodyMapDecision = (record: Pick<BodyMapRecord, 'intensity' | 'limitation' | 'type' | 'increasesWithSprint' | 'increasesWithChangeOfDirection' | 'status'> & Partial<Pick<BodyMapRecord, 'region'>>): { decision: BodyMapTrainingDecision; rationale: string; pct: string; restriction: string } => {
  const region = record.region ?? 'Otro';
  const risk = BODY_REGION_RISK[region] ?? 'medio';
  const restriction = suggestedRestriction({ region, increasesWithSprint: record.increasesWithSprint, increasesWithChangeOfDirection: record.increasesWithChangeOfDirection, limitation: record.limitation, type: record.type });
  if (record.status === 'Cerrado') return { decision: 'Carga completa', pct: '100%', restriction: 'Registro cerrado.', rationale: 'Registro cerrado; mantener seguimiento habitual.' };
  if (record.type === 'Lesión confirmada' || record.limitation || record.intensity >= 8) {
    return { decision: 'No campo / fisioterapia', pct: '0-40%', restriction, rationale: 'Dolor/lesión con limitación o intensidad alta. Requiere valoración antes de exponer al jugador.' };
  }
  if (record.intensity >= 6 || record.increasesWithSprint || record.increasesWithChangeOfDirection) {
    return { decision: 'Trabajo modificado', pct: '40-60%', restriction, rationale: 'Dolor moderado-alto o aumenta con acciones de fútbol. Modificar tarea y restringir acciones de riesgo.' };
  }
  if (record.intensity >= 4 || risk === 'alto') {
    return { decision: 'Reducir carga', pct: '60-80%', restriction, rationale: 'Molestia moderada o zona de alta importancia para fútbol. Controlar volumen e intensidad.' };
  }
  if (record.intensity > 0) {
    return { decision: 'Control preventivo', pct: '80-90%', restriction, rationale: 'Molestia leve. Puede entrenar con seguimiento y reporte posterior.' };
  }
  return { decision: 'Carga completa', pct: '100%', restriction: 'Sin restricción por mapa corporal.', rationale: 'Sin dolor relevante reportado.' };
};
