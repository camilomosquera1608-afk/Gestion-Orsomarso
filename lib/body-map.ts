import type { ClubCategory } from '@/lib/types';

export type BodyMapSource = 'Jugador' | 'Fisioterapia' | 'Cuerpo técnico';
export type BodyMapRecordType = 'Dolor muscular' | 'Molestia' | 'Lesión reportada' | 'Seguimiento';
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
  status: BodyMapStatus;
  category?: ClubCategory;
  createdAt: string;
}

const LOCAL_KEY = 'orsomarso-body-map-v1';

export const BODY_REGIONS = [
  'Cuello', 'Hombro', 'Pectoral', 'Espalda alta', 'Lumbar', 'Abdomen/Core',
  'Cadera', 'Aductor', 'Isquiotibial', 'Cuádriceps', 'Rodilla', 'Gemelo/Sóleo',
  'Tobillo', 'Pie', 'Otro',
] as const;

export const newBodyMapId = () => `body-map-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const todayInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const readBodyMapRecords = (): BodyMapRecord[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveBodyMapRecords = (records: BodyMapRecord[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
};

export const bodyMapTone = (record: Pick<BodyMapRecord, 'intensity' | 'limitation' | 'type' | 'status'>) => {
  if (record.status === 'Cerrado') return 'neutral';
  if (record.type === 'Lesión reportada' || record.limitation || record.intensity >= 7) return 'red';
  if (record.intensity >= 4) return 'amber';
  return 'blue';
};

export const getBodyMapDecision = (record: Pick<BodyMapRecord, 'intensity' | 'limitation' | 'type' | 'increasesWithSprint' | 'increasesWithChangeOfDirection' | 'status'>): { decision: BodyMapTrainingDecision; rationale: string; pct: string } => {
  if (record.status === 'Cerrado') return { decision: 'Carga completa', pct: '100%', rationale: 'Registro cerrado; mantener seguimiento habitual.' };
  if (record.type === 'Lesión reportada' || record.limitation || record.intensity >= 8) {
    return { decision: 'No campo / fisioterapia', pct: '0-40%', rationale: 'Dolor/lesión con limitación o intensidad alta. Requiere valoración antes de exponer al jugador.' };
  }
  if (record.intensity >= 6 || record.increasesWithSprint || record.increasesWithChangeOfDirection) {
    return { decision: 'Trabajo modificado', pct: '40-60%', rationale: 'Dolor moderado-alto o aumenta con acciones de fútbol. Evitar sprint, desaceleraciones fuertes o cambios de dirección según el caso.' };
  }
  if (record.intensity >= 4) {
    return { decision: 'Reducir carga', pct: '60-80%', rationale: 'Molestia moderada. Controlar volumen e intensidad, reevaluar durante la sesión.' };
  }
  if (record.intensity > 0) {
    return { decision: 'Control preventivo', pct: '80-90%', rationale: 'Molestia leve. Puede entrenar con seguimiento y reporte posterior.' };
  }
  return { decision: 'Carga completa', pct: '100%', rationale: 'Sin dolor relevante reportado.' };
};
