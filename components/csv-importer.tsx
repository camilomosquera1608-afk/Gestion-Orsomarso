'use client';

import { useRef, useState , type ChangeEvent, type DragEvent } from 'react';
import { CheckCircle2, Upload, X, AlertTriangle, ArrowRight, FileText } from 'lucide-react';
import type { Player, DailyExternalLoadRecord, SessionParticipation, ClubCategory, TrainingSessionType, MovementModule, MovementType } from '@/lib/types';

// ─── Tipos internos ───────────────────────────────────────────────────────────
export interface CsvRow {
  rawName: string;
  min: number;
  totalDistance?: number;
  playerLoad?: number;
  maxVelocity?: number;
  highSpeedDistance?: number;
  sprintDistance?: number;
  sprints?: number;
  rhie?: number;
  acc?: number;
  dcc?: number;
  rpe?: number;
  participation?: SessionParticipation;
}

export interface MappedRow {
  csvRow: CsvRow;
  player: Player | null;
  matchScore: number;
  status: 'matched' | 'fuzzy' | 'unmatched';
}

interface Props {
  players: Player[];
  sessionId: string;
  date: string;
  microcycleId: string;
  sessionNumber: number;
  category: ClubCategory | string;
  actingCategory?: ClubCategory;
  sessionType?: TrainingSessionType;
  movementModule?: MovementModule;
  title?: string;
  description?: string;
  dropzoneTitle?: string;
  importLabel?: string;
  onImport: (records: Omit<DailyExternalLoadRecord, 'id'>[]) => void;
  onClose: () => void;
}

// ─── Conversión HH:MM:SS → minutos ───────────────────────────────────────────
const parseDuration = (s: string): number => {
  const clean = s.trim();
  if (!clean) return 0;
  const parts = clean.split(':');
  if (parts.length === 3) {
    return Number(parts[0]) * 60 + Number(parts[1]) + Number(parts[2]) / 60;
  }
  if (parts.length === 2) return Number(parts[0]) + Number(parts[1]) / 60;
  return Number(clean) || 0;
};

const safeFloat = (s: string): number => {
  const n = parseFloat(s?.replace(',', '.') ?? '');
  return Number.isFinite(n) ? n : 0;
};

const toClubCategory = (value: unknown, fallback: ClubCategory = 'Sub20'): ClubCategory => {
  return value === 'Sub15' || value === 'Sub17' || value === 'Sub20' ? value : fallback;
};

const CATEGORY_RANK: Record<ClubCategory, number> = { Sub15: 15, Sub17: 17, Sub20: 20 };

const getMovementType = (baseCategory: ClubCategory, actingCategory: ClubCategory, module: MovementModule): MovementType => {
  if (baseCategory === actingCategory) return 'base';
  if (module === 'competencia') return CATEGORY_RANK[baseCategory] < CATEGORY_RANK[actingCategory] ? 'subio_a_competir' : 'bajo_a_competir';
  return CATEGORY_RANK[baseCategory] < CATEGORY_RANK[actingCategory] ? 'subio_a_entrenar' : 'bajo_a_entrenar';
};

// ─── Normalización de nombres ─────────────────────────────────────────────────
const normalizeName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,.\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const nameSimilarity = (a: string, b: string): number => {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 100;
  const wordsA = new Set(na.split(' ').filter((w) => w.length > 2));
  const wordsB = new Set(nb.split(' ').filter((w) => w.length > 2));
  const shared = [...wordsA].filter((w) => wordsB.has(w)).length;
  if (shared === 0) return 0;
  return Math.round((shared * 2 / (wordsA.size + wordsB.size)) * 100);
};

const autoMatch = (rawName: string, players: Player[]) => {
  let best: Player | null = null;
  let bestScore = 0;
  for (const player of players) {
    const score = nameSimilarity(rawName, player.name);
    if (score > bestScore) { bestScore = score; best = player; }
    if (player.jerseyNumber) {
      const rawClean = rawName.replace(/[^0-9]/g, '');
      if (rawClean === String(player.jerseyNumber)) { bestScore = 100; best = player; break; }
    }
  }
  const status: MappedRow['status'] = bestScore >= 90 ? 'matched' : bestScore >= 55 ? 'fuzzy' : 'unmatched';
  return { player: bestScore >= 55 ? best : null, score: bestScore, status };
};

// ─── PARSERS ──────────────────────────────────────────────────────────────────

// Detecta si el CSV es formato Catapult (tiene metadatos en las primeras filas)
const isCatapultFormat = (lines: string[]) =>
  lines.slice(0, 8).some((l) => l.includes('Player Name') || l.includes('Period Name') || l.includes('Num Players'));

// Parser específico para Catapult
// Estructura: 7-9 filas de metadatos, luego fila de headers, luego datos
// Filtramos solo Period Number = 0 (totales de sesión)
const parseCatapult = (lines: string[]): CsvRow[] => {
  // Encontrar la fila de headers (la que tiene "Player Name")
  const headerIdx = lines.findIndex((l) => l.includes('Player Name') && l.includes('Period Name'));
  if (headerIdx === -1) return [];

  // Parsear como CSV correctamente (respeta comillas)
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[headerIdx]);

  // Mapear columnas Catapult de forma tolerante. Algunos reportes exportan
  // ACC y DCC separados; otros solo traen "Accel + Decel Efforts".
  // Si existen columnas separadas, nunca se debe duplicar el mismo valor en ambas.
  const normHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const colAny = (aliases: string[]) => {
    // Importante: respetar el orden de prioridad de aliases.
    // Antes se buscaba por orden de columnas del CSV, y Catapult ubica campos
    // como "Deceleration B3 Efforts (Gen 2)" antes de
    // "Deceleration B1-3 Total Efforts (Gen 2)". Eso hacía que DCC tomara
    // solo B3 en vez del total B1-3. Ahora primero intentamos el alias más
    // específico y luego los respaldos.
    const normalizedHeaders = headers.map(normHeader);
    for (const alias of aliases) {
      const idx = normalizedHeaders.indexOf(normHeader(alias));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const colContains = (must: string[], mustNot: string[] = []) => headers.findIndex((h) => {
    const n = normHeader(h);
    return must.every((token) => n.includes(token)) && !mustNot.some((token) => n.includes(token));
  });

  const colName    = colAny(['Player Name', 'Athlete Name', 'Name']);
  const colPeriod  = colAny(['Period Number', 'Period']);
  const colDur     = colAny(['Average Duration (Session)', 'Duration', 'Session Duration']);
  const colDist    = colAny(['Average Distance (Session)', 'Distance', 'Total Distance']);
  const colPL      = colAny(['Average Player Load (Session)', 'Player Load', 'PL']);
  const colMaxV    = colAny(['Maximum Velocity', 'Max Velocity', 'Max Speed']);

  // Catapult exporta varios campos con nombres muy parecidos.
  // Para que coincida con el panel ACC Y DCC de OpenField/Catapult, usamos
  // PRIMERO los esfuerzos B1 Gen 2 separados:
  //   Acceleration B1 Efforts (Gen 2)
  //   Deceleration B1 Efforts (Gen 2)
  // No se debe tomar B3, B2-3, B1-3 Total ni "Accel + Decel" cuando existen
  // los campos B1 separados, porque eso cambia completamente la lectura.
  const colAccExact = colAny([
    'Acceleration B1 Efforts (Gen 2)',
    'Acceleration B1 Total Efforts (Gen 2)',
    'Acceleration B1 Average Efforts (Session) (Gen 2)',
    'Acceleration B1-3 Average Efforts (Session) (Gen 2)',
    'Acceleration B1-3 Total Efforts (Gen 2)',
    'Acceleration B1-3 Efforts (Gen 2)',
    'Acceleration B2-3 Average Efforts (Session) (Gen 2)',
    'Acceleration B2-3 Total Efforts (Gen 2)',
    'Acceleration B2-3 Efforts (Gen 2)',
    'Acceleration B3 Average Efforts (Session) (Gen 2)',
    'Acceleration B3 Efforts (Gen 2)',
    'Acceleration Efforts',
    'Accel Efforts',
    'Accelerations',
    'ACC',
  ]);
  const colDccExact = colAny([
    'Deceleration B1 Efforts (Gen 2)',
    'Deceleration B1 Total Efforts (Gen 2)',
    'Deceleration B1 Average Efforts (Session) (Gen 2)',
    'Deceleration B1-3 Average Efforts (Session) (Gen 2)',
    'Deceleration B1-3 Total Efforts (Gen 2)',
    'Deceleration B1-3 Efforts (Gen 2)',
    'Deceleration B2-3 Average Efforts (Session) (Gen 2)',
    'Deceleration B2-3 Total Efforts (Gen 2)',
    'Deceleration B2-3 Efforts (Gen 2)',
    'Deceleration B3 Average Efforts (Session) (Gen 2)',
    'Deceleration B3 Efforts (Gen 2)',
    'Deceleration Efforts',
    'Decel Efforts',
    'Decelerations',
    'DCC',
  ]);
  const colAcc = colAccExact >= 0 ? colAccExact : colContains(['acceleration', 'efforts'], ['deceleration', 'per', 'minute', 'max']);
  const colDcc = colDccExact >= 0 ? colDccExact : colContains(['deceleration', 'efforts'], ['acceleration', 'per', 'minute', 'max']);
  const colAccDec  = colAny(['Accel + Decel Efforts', 'Acceleration + Deceleration Efforts', 'Acc + Dec']);
  const colHSR     = colAny(['HS Distance', 'High Speed Distance', 'High-Speed Distance', 'HSR']);
  const colHsEfforts = colAny(['HS Efforts', 'High Speed Efforts', 'High-Speed Efforts']);
  const colSprints = colAny(['Sprint Efforts', 'Sprints', 'Sprint Count']);
  const colRhieExact = colAny([
    'RHIE Total Bouts',
    'RHIE Total Average Bouts (Session)',
    'RHIE Bouts',
    'RHIE Average Bouts (Session)',
    'RHIE',
    'Repeated High Intensity Efforts',
    'Repeated High Intensity Effort Bouts',
    'Repeated High Intensity Efforts Bouts',
  ]);
  // Algunos CTR Report de Catapult no exportan RHIE real; en ese caso
  // dejamos HS Efforts como respaldo operativo para no perder la métrica de
  // esfuerzos de alta intensidad en el informe.
  const colRhie    = colRhieExact >= 0 ? colRhieExact : colHsEfforts;

  const rows: CsvRow[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = parseRow(line);
    if (cells.length < 10) continue;

    // Solo Period Number = 0 = totales de sesión completa
    const periodNum = cells[colPeriod]?.trim();
    if (periodNum !== '0') continue;

    const rawName = cells[colName]?.trim();
    if (!rawName) continue;

    const min = Math.round(parseDuration(cells[colDur] ?? ''));
    const accRaw = colAcc >= 0 ? safeFloat(cells[colAcc] ?? '') : undefined;
    const dccRaw = colDcc >= 0 ? safeFloat(cells[colDcc] ?? '') : undefined;
    const accDec = colAccDec >= 0 ? safeFloat(cells[colAccDec] ?? '') : 0;
    const hasSplitAccDcc = colAcc >= 0 && colDcc >= 0 && Number.isFinite(accRaw) && Number.isFinite(dccRaw);

    rows.push({
      rawName,
      min,
      totalDistance: colDist >= 0 ? safeFloat(cells[colDist] ?? '') : undefined,
      playerLoad: colPL >= 0 ? safeFloat(cells[colPL] ?? '') : undefined,
      maxVelocity: colMaxV >= 0 ? safeFloat(cells[colMaxV] ?? '') : undefined,
      highSpeedDistance: colHSR >= 0 ? safeFloat(cells[colHSR] ?? '') : undefined,
      sprints: colSprints >= 0 ? safeFloat(cells[colSprints] ?? '') : undefined,
      rhie: colRhie >= 0 ? safeFloat(cells[colRhie] ?? '') : undefined,
      // Si el CSV trae ACC/DCC separados, se respetan. Si solo trae combinado,
      // se deja el combinado en ACC y DCC queda 0 para no inventar simetría falsa.
      acc: hasSplitAccDcc ? Math.round(accRaw ?? 0) : Math.round(accDec),
      dcc: hasSplitAccDcc ? Math.round(dccRaw ?? 0) : 0,
    });
  }

  return rows;
};

// Parser genérico para otros sistemas (Polar, GPSports, etc.)
const GENERIC_ALIASES: Record<string, string> = {
  name: 'name', nombre: 'name', player: 'name', jugador: 'name', athlete: 'name',
  'player name': 'name', 'nombre jugador': 'name',
  minutes: 'min', minutos: 'min', min: 'min', duration: 'min',
  rpe: 'rpe', 'perceived exertion': 'rpe',
  distance: 'totalDistance', distancia: 'totalDistance', 'total distance': 'totalDistance',
  'average distance (session)': 'totalDistance',
  'player load': 'playerLoad', 'average player load (session)': 'playerLoad', pl: 'playerLoad',
  hsr: 'highSpeedDistance', 'hs distance': 'highSpeedDistance', 'high speed distance': 'highSpeedDistance',
  'sprint distance': 'sprintDistance',
  rhie: 'rhie', 'rhie bouts': 'rhie', 'rhie total bouts': 'rhie', 'repeated high intensity efforts': 'rhie',
  'max speed': 'maxVelocity', 'maximum velocity': 'maxVelocity', 'max velocity': 'maxVelocity',
  accel: 'acc', acceleration: 'acc', acc: 'acc',
  decel: 'dcc', deceleration: 'dcc', dcc: 'dcc',
  sprints: 'sprints', 'sprint efforts': 'sprints',
};

const parseGeneric = (lines: string[]): CsvRow[] => {
  if (!lines.length) return [];
  const parseRow = (line: string) => line.split(/[,;\t]/).map((c) => c.replace(/"/g, '').trim());
  const headers = parseRow(lines[0]);
  const colMap: Record<number, string> = {};
  headers.forEach((h, i) => {
    const key = GENERIC_ALIASES[h.toLowerCase().trim()];
    if (key) colMap[i] = key;
  });

  return lines.slice(1).map((line) => {
    const cells = parseRow(line);
    const row: Record<string, string> = {};
    Object.entries(colMap).forEach(([i, key]) => { row[key] = cells[Number(i)] ?? ''; });
    if (!row.name) return null;
    return {
      rawName: row.name,
      min: Math.round(parseDuration(row.min ?? '0')),
      rpe: row.rpe ? safeFloat(row.rpe) : undefined,
      totalDistance: row.totalDistance ? safeFloat(row.totalDistance) : undefined,
      playerLoad: row.playerLoad ? safeFloat(row.playerLoad) : undefined,
      maxVelocity: row.maxVelocity ? safeFloat(row.maxVelocity) : undefined,
      highSpeedDistance: row.highSpeedDistance ? safeFloat(row.highSpeedDistance) : undefined,
      sprintDistance: row.sprintDistance ? safeFloat(row.sprintDistance) : undefined,
      sprints: row.sprints ? safeFloat(row.sprints) : undefined,
      rhie: row.rhie ? safeFloat(row.rhie) : undefined,
      acc: row.acc ? safeFloat(row.acc) : undefined,
      dcc: row.dcc ? safeFloat(row.dcc) : undefined,
    } as CsvRow;
  }).filter(Boolean) as CsvRow[];
};

export const parseGpsCsv = (raw: string): { rows: CsvRow[]; format: string } => {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (isCatapultFormat(lines)) {
    return { rows: parseCatapult(lines), format: 'Catapult' };
  }
  return { rows: parseGeneric(lines), format: 'Genérico' };
};

// ─── Componente ───────────────────────────────────────────────────────────────
export function CsvImporter({ players, sessionId, date, microcycleId, sessionNumber, category, actingCategory, sessionType = 'MD-3', movementModule = 'sesion', title, description, dropzoneTitle, importLabel, onImport, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [rows, setRows] = useState<MappedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [detectedFormat, setDetectedFormat] = useState('');
  const normalizedActingCategory = toClubCategory(actingCategory ?? category);
  const defaultTitle = title ?? 'Importar CSV GPS';
  const defaultDescription = description ?? 'Exporta el informe desde Catapult Cloud o carga un CSV compatible. La app detecta automáticamente jugadores y métricas.';
  const defaultDropzoneTitle = dropzoneTitle ?? 'Arrastra el CTR Report aquí o haz clic para seleccionarlo';
  const defaultImportLabel = importLabel ?? 'registros GPS';

  const processFile = (file: File) => {
    if (!file.name.match(/\.(csv|txt|tsv)$/i)) {
      alert('Solo se aceptan archivos .csv, .txt o .tsv');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = String(e.target?.result ?? '');
      const { rows: csvRows, format } = parseGpsCsv(raw);
      if (!csvRows.length) {
        alert('No se encontraron jugadores en el archivo. Verifica que sea un CSV de Catapult o compatible.');
        return;
      }
      setDetectedFormat(format);
      const mapped: MappedRow[] = csvRows.map((csvRow) => {
        const { player, score, status } = autoMatch(csvRow.rawName, players);
        return { csvRow, player, matchScore: score, status };
      });
      setRows(mapped);
      setStep('map');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const assignPlayer = (rowIndex: number, playerId: string) => {
    setRows((prev) => prev.map((row, i) => {
      if (i !== rowIndex) return row;
      const player = players.find((p) => p.id === playerId) ?? null;
      return { ...row, player, status: player ? 'matched' : 'unmatched' };
    }));
  };

  const readyRows = rows.filter((r) => r.player !== null);
  const unmatchedRows = rows.filter((r) => r.player === null);
  const gpsWarningFor = (row: CsvRow) => {
    const distance = row.totalDistance ?? 0;
    const maxVelocity = row.maxVelocity ?? 0;
    const playerLoad = row.playerLoad ?? 0;
    if (row.min >= 20 && distance < 500 && playerLoad < 50) return 'GPS casi sin movimiento';
    if (row.min >= 20 && maxVelocity > 0 && maxVelocity < 5) return 'Velocidad máxima anormal';
    if (row.min >= 20 && distance > 0 && distance / Math.max(row.min, 1) < 10) return 'm/min anormalmente bajo';
    return '';
  };
  const gpsWarningRows = readyRows.filter((r) => gpsWarningFor(r.csvRow));

  const handleImport = () => {
    const records: Omit<DailyExternalLoadRecord, 'id'>[] = readyRows.map(({ csvRow, player }) => {
      const baseCategory = toClubCategory(player!.category, normalizedActingCategory);
      const movementType = getMovementType(baseCategory, normalizedActingCategory, movementModule);
      return {
        sessionId,
        playerId: player!.id,
        date,
        min: csvRow.min,
        rpe: csvRow.rpe ?? 0,
        acc: csvRow.acc ?? 0,
        dcc: csvRow.dcc ?? 0,
        sprints: csvRow.sprints ?? 0,
        rhie: csvRow.rhie ?? 0,
        ima: 0,
        totalDistance: csvRow.totalDistance,
        playerLoad: csvRow.playerLoad,
        highSpeedDistance: csvRow.highSpeedDistance,
        hsr: csvRow.highSpeedDistance,
        sprintDistance: csvRow.sprintDistance,
        maxVelocity: csvRow.maxVelocity,
        participation: 'Completa' as SessionParticipation,
        microcycleId,
        sessionNumber,
        sessionType,
        category: normalizedActingCategory,
        baseCategory,
        actingCategory: normalizedActingCategory,
        movementType,
        movementModule,
      };
    });
    onImport(records);
  };

  return (
    <div className="csv-overlay" onClick={onClose}>
      <div
        className="csv-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong className="confirm-title">
            {step === 'upload' ? defaultTitle : step === 'map' ? 'Asignar jugadores' : 'Confirmar importación'}
          </strong>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div>
            <p className="confirm-desc">
              {defaultDescription}
            </p>
            <div
              className={`csv-import-zone ${dragOver ? 'drag-over' : ''}`}
              style={{ marginTop: 16 }}
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload size={28} style={{ color: 'var(--blue)', margin: '0 auto 10px', display: 'block' }} />
              <strong>{defaultDropzoneTitle}</strong>
              <span>Catapult (.csv) · Otros GPS: Polar, GPSports, STATSports</span>
              <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" style={{ display: 'none' }} onChange={handleFile} onClick={(e) => e.stopPropagation()} />
            </div>
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 14, background: '#f8fbff', border: '1px solid var(--line)', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>
              <strong style={{ color: 'var(--navy)', display: 'block', marginBottom: 4 }}>Cómo exportar desde Catapult Cloud:</strong>
              Reportes → CTR Report → Selecciona sesión → Export CSV
            </div>
          </div>
        )}

        {/* Step: Map */}
        {step === 'map' && (
          <div>
            <div className="csv-import-summary">
              <FileText size={16} style={{ color: 'var(--blue)' }} />
              <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{fileName}</span>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: '#eef5ff', color: 'var(--blue)', fontWeight: 700 }}>
                {detectedFormat}
              </span>
              <span className="csv-import-summary-pill" style={{ background: '#dcfce7', color: '#065f46' }}>
                <CheckCircle2 size={12} /> {rows.filter((r) => r.status === 'matched').length} automáticas
              </span>
              {rows.filter((r) => r.status === 'fuzzy').length > 0 && (
                <span className="csv-import-summary-pill" style={{ background: '#fef3c7', color: '#92400e' }}>
                  ⚠ {rows.filter((r) => r.status === 'fuzzy').length} dudosas
                </span>
              )}
              {unmatchedRows.length > 0 && (
                <span className="csv-import-summary-pill" style={{ background: '#fee2e2', color: '#991b1b' }}>
                  ✕ {unmatchedRows.length} sin asignar
                </span>
              )}
            </div>

            <p className="confirm-desc" style={{ marginTop: 10 }}>
              Verde = asignado automáticamente. Amarillo = coincidencia parcial, confirma. Rojo = asigna manualmente.
            </p>

            <div style={{ display: 'grid', gap: 8, marginTop: 12, maxHeight: 380, overflowY: 'auto' }}>
              {rows.map((row, i) => (
                <div key={i} className={`csv-map-row ${row.status}`}>
                  <div>
                    <div className="csv-map-label">{row.csvRow.rawName}</div>
                    <div className="csv-map-sub">
                      {row.csvRow.min} min
                      {row.csvRow.totalDistance ? ` · ${row.csvRow.totalDistance.toFixed(0)} m` : ''}
                      {row.csvRow.playerLoad ? ` · PL ${row.csvRow.playerLoad.toFixed(0)}` : ''}
                      {row.csvRow.maxVelocity ? ` · ${row.csvRow.maxVelocity.toFixed(1)} km/h` : ''}
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: row.status === 'matched' ? '#16a34a' : row.status === 'fuzzy' ? '#d97706' : '#dc2626' }} />
                  <div>
                    <select
                      className="select"
                      style={{ fontSize: 13, padding: '8px 10px' }}
                      value={row.player?.id ?? ''}
                      onChange={(e) => assignPlayer(i, e.target.value)}
                    >
                      <option value="">— Sin asignar —</option>
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.jerseyNumber ? `#${p.jerseyNumber} ` : ''}{p.name}
                        </option>
                      ))}
                    </select>
                    {row.status === 'fuzzy' && row.player && (
                      <div style={{ fontSize: 11, color: '#92400e', marginTop: 3, fontWeight: 700 }}>
                        Coincidencia {row.matchScore}% — confirma si es correcto
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="confirm-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn secondary" onClick={() => setStep('upload')}>← Volver</button>
              <button type="button" className="btn" disabled={readyRows.length === 0} onClick={() => setStep('preview')}>
                Continuar ({readyRows.length} jugadores) →
              </button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div>
            <p className="confirm-desc">
              Se importarán {readyRows.length} {defaultImportLabel} para el {date}.
              {unmatchedRows.length > 0 && ` ${unmatchedRows.length} fila(s) sin asignar serán ignoradas.`}
            </p>

            <div className="professional-table-wrap" style={{ marginTop: 12 }}>
              <table className="csv-preview-table">
                <thead>
                  <tr>
                    <th>Jugador</th><th>MIN</th><th>Distancia</th><th>PL</th><th>Vel. máx</th><th>HSR</th><th>Sprints</th><th>RHIE</th><th>ACC</th><th>DCC</th><th>Validación</th>
                  </tr>
                </thead>
                <tbody>
                  {readyRows.map((row, i) => (
                    <tr key={i}>
                      <td><strong>{row.player!.name}</strong></td>
                      <td>{row.csvRow.min}</td>
                      <td>{row.csvRow.totalDistance ? `${row.csvRow.totalDistance.toFixed(0)} m` : '—'}</td>
                      <td>{row.csvRow.playerLoad ? row.csvRow.playerLoad.toFixed(0) : '—'}</td>
                      <td>{row.csvRow.maxVelocity ? `${row.csvRow.maxVelocity.toFixed(1)} km/h` : '—'}</td>
                      <td>{row.csvRow.highSpeedDistance ? `${row.csvRow.highSpeedDistance.toFixed(0)} m` : '—'}</td>
                      <td>{row.csvRow.sprints ?? '—'}</td>
                      <td>{row.csvRow.rhie ?? '—'}</td>
                      <td>{row.csvRow.acc ?? '—'}</td>
                      <td>{row.csvRow.dcc ?? '—'}</td>
                      <td>{gpsWarningFor(row.csvRow) ? <span style={{ color: '#b45309', fontWeight: 800 }}>{gpsWarningFor(row.csvRow)}</span> : 'OK'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {gpsWarningRows.length > 0 && (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: '#fff7ed', border: '1px solid #fde68a', fontSize: 12, color: '#92400e', fontWeight: 700 }}>
                <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6 }} />
                Revisar GPS antes de importar: {gpsWarningRows.map((r) => `${r.player!.name} (${gpsWarningFor(r.csvRow)})`).join(', ')}.
              </div>
            )}

            {unmatchedRows.length > 0 && (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: '#fff7ed', border: '1px solid #fde68a', fontSize: 12, color: '#92400e', fontWeight: 700 }}>
                <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6 }} />
                Ignoradas: {unmatchedRows.map((r) => r.csvRow.rawName).join(', ')}
              </div>
            )}

            <div className="confirm-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn secondary" onClick={() => setStep('map')}>← Revisar asignación</button>
              <button type="button" className="btn" onClick={handleImport}>
                <CheckCircle2 size={15} /> Importar {readyRows.length}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
