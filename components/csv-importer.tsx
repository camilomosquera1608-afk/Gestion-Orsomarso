'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Upload, X, AlertTriangle, ArrowRight, FileText } from 'lucide-react';
import type { Player, DailyExternalLoadRecord, SessionParticipation } from '@/lib/types';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface CsvRow {
  rawName: string;          // Nombre tal como viene en el CSV
  min: number;
  rpe: number;
  totalDistance?: number;
  playerLoad?: number;
  highSpeedDistance?: number;
  sprintDistance?: number;
  maxVelocity?: number;
  acc?: number;
  dcc?: number;
  sprints?: number;
  rhie?: number;
  ima?: number;
  participation?: SessionParticipation;
}

export interface MappedRow {
  csvRow: CsvRow;
  player: Player | null;    // null = no asignado aún
  matchScore: number;       // 0-100, qué tan segura es la coincidencia automática
  status: 'matched' | 'fuzzy' | 'unmatched';
}

interface Props {
  players: Player[];
  sessionId: string;
  date: string;
  microcycleId: string;
  sessionNumber: number;
  category: string;
  onImport: (records: Omit<DailyExternalLoadRecord, 'id'>[]) => void;
  onClose: () => void;
}

// ─── Normalización de nombres ─────────────────────────────────────────────────
const normalizeName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quitar tildes
    .replace(/[,.\-_]/g, ' ')         // separadores → espacio
    .replace(/\s+/g, ' ')
    .trim();

const nameSimilarity = (a: string, b: string): number => {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 100;

  // Coincidencia por palabras compartidas
  const wordsA = new Set(na.split(' ').filter((w) => w.length > 2));
  const wordsB = new Set(nb.split(' ').filter((w) => w.length > 2));
  const shared = [...wordsA].filter((w) => wordsB.has(w)).length;
  if (shared === 0) return 0;
  const score = (shared * 2) / (wordsA.size + wordsB.size);
  return Math.round(score * 100);
};

const autoMatch = (rawName: string, players: Player[]): { player: Player | null; score: number; status: MappedRow['status'] } => {
  let best: Player | null = null;
  let bestScore = 0;

  for (const player of players) {
    // También comparar contra dorsal si viene como número
    const score = nameSimilarity(rawName, player.name);
    if (score > bestScore) { bestScore = score; best = player; }

    // Intentar match por dorsal (si el CSV trae "10" o "#10")
    if (player.jerseyNumber) {
      const jerseyStr = String(player.jerseyNumber);
      const rawClean = rawName.replace(/[^0-9]/g, '');
      if (rawClean === jerseyStr) { bestScore = 100; best = player; break; }
    }
  }

  const status: MappedRow['status'] = bestScore >= 90 ? 'matched' : bestScore >= 55 ? 'fuzzy' : 'unmatched';
  return { player: bestScore >= 55 ? best : null, score: bestScore, status };
};

// ─── Parser de CSV ─────────────────────────────────────────────────────────────
const parseFloat0 = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : 0; };

const COLUMN_ALIASES: Record<string, string> = {
  // nombre
  name: 'name', nombre: 'name', player: 'name', jugador: 'name', athlete: 'name', atleta: 'name',
  'player name': 'name', 'nombre jugador': 'name', 'player id': 'name',
  // minutos
  minutes: 'min', minutos: 'min', min: 'min', duration: 'min', duracion: 'min', tiempo: 'min',
  // rpe
  rpe: 'rpe', 'perceived exertion': 'rpe', esfuerzo: 'rpe',
  // distancia
  distance: 'totalDistance', distancia: 'totalDistance', 'total distance': 'totalDistance',
  'total dist': 'totalDistance', dist: 'totalDistance', 'distance (m)': 'totalDistance',
  // player load
  'player load': 'playerLoad', playerload: 'playerLoad', pl: 'playerLoad', carga: 'playerLoad',
  // alta velocidad
  hsr: 'highSpeedDistance', 'high speed': 'highSpeedDistance', 'high speed distance': 'highSpeedDistance',
  'hs dist': 'highSpeedDistance', hsd: 'highSpeedDistance',
  // sprint distance
  'sprint dist': 'sprintDistance', 'sprint distance': 'sprintDistance', sprintdist: 'sprintDistance',
  // velocidad máxima
  'max speed': 'maxVelocity', 'max velocity': 'maxVelocity', 'vel max': 'maxVelocity',
  'velocidad maxima': 'maxVelocity', maxvel: 'maxVelocity', maxspeed: 'maxVelocity',
  // aceleraciones
  accel: 'acc', acceleration: 'acc', accelerations: 'acc', acc: 'acc', acel: 'acc',
  decel: 'dcc', deceleration: 'dcc', decelerations: 'dcc', dcc: 'dcc', desacel: 'dcc',
  sprints: 'sprints',
  rhie: 'rhie',
  ima: 'ima',
};

const mapColumn = (header: string) => COLUMN_ALIASES[header.toLowerCase().trim()] ?? null;

const parseCsv = (raw: string): CsvRow[] => {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(/[,;\t]/).map((h) => h.replace(/"/g, '').trim());
  const colMap: Record<number, string> = {};
  headers.forEach((h, i) => { const mapped = mapColumn(h); if (mapped) colMap[i] = mapped; });

  return lines.slice(1).map((line) => {
    const cells = line.split(/[,;\t]/).map((c) => c.replace(/"/g, '').trim());
    const row: Record<string, string> = {};
    Object.entries(colMap).forEach(([i, key]) => { row[key] = cells[Number(i)] ?? ''; });
    if (!row.name) return null;
    return {
      rawName: row.name,
      min: parseFloat0(row.min ?? '0'),
      rpe: parseFloat0(row.rpe ?? '0'),
      totalDistance: row.totalDistance ? parseFloat0(row.totalDistance) : undefined,
      playerLoad: row.playerLoad ? parseFloat0(row.playerLoad) : undefined,
      highSpeedDistance: row.highSpeedDistance ? parseFloat0(row.highSpeedDistance) : undefined,
      sprintDistance: row.sprintDistance ? parseFloat0(row.sprintDistance) : undefined,
      maxVelocity: row.maxVelocity ? parseFloat0(row.maxVelocity) : undefined,
      acc: row.acc ? parseFloat0(row.acc) : undefined,
      dcc: row.dcc ? parseFloat0(row.dcc) : undefined,
      sprints: row.sprints ? parseFloat0(row.sprints) : undefined,
      rhie: row.rhie ? parseFloat0(row.rhie) : undefined,
      ima: row.ima ? parseFloat0(row.ima) : undefined,
    } as CsvRow;
  }).filter(Boolean) as CsvRow[];
};

// ─── Componente principal ──────────────────────────────────────────────────────
export function CsvImporter({ players, sessionId, date, microcycleId, sessionNumber, category, onImport, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [rows, setRows] = useState<MappedRow[]>([]);
  const [fileName, setFileName] = useState('');

  const processFile = (file: File) => {
    if (!file.name.match(/\.(csv|txt|tsv)$/i)) {
      alert('Solo se aceptan archivos CSV, TXT o TSV.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = String(e.target?.result ?? '');
      const csvRows = parseCsv(raw);
      if (!csvRows.length) { alert('No se encontraron filas válidas en el archivo. Revisa que tenga una columna de nombre.'); return; }
      const mapped: MappedRow[] = csvRows.map((csvRow) => {
        const { player, score, status } = autoMatch(csvRow.rawName, players);
        return { csvRow, player, matchScore: score, status };
      });
      setRows(mapped);
      setStep('map');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
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

  const handleImport = () => {
    const records: Omit<DailyExternalLoadRecord, 'id'>[] = readyRows.map(({ csvRow, player }) => ({
      sessionId,
      playerId: player!.id,
      date,
      min: csvRow.min,
      rpe: csvRow.rpe,
      acc: csvRow.acc ?? 0,
      dcc: csvRow.dcc ?? 0,
      sprints: csvRow.sprints ?? 0,
      rhie: csvRow.rhie ?? 0,
      ima: csvRow.ima ?? 0,
      totalDistance: csvRow.totalDistance,
      playerLoad: csvRow.playerLoad,
      highSpeedDistance: csvRow.highSpeedDistance,
      sprintDistance: csvRow.sprintDistance,
      maxVelocity: csvRow.maxVelocity,
      hsr: csvRow.highSpeedDistance,
      participation: 'Completa' as SessionParticipation,
      microcycleId,
      sessionNumber,
      sessionType: 'cdEf' as const,
      category: player!.category,
      baseCategory: player!.category,
      actingCategory: player!.category,
      movementType: 'base' as const,
      movementModule: 'sesion' as const,
    }));
    onImport(records);
  };

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-modal" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong className="confirm-title">
            {step === 'upload' ? 'Importar datos GPS desde CSV' : step === 'map' ? 'Asignar jugadores' : 'Confirmar importación'}
          </strong>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div>
            <p className="confirm-desc">
              Sube un CSV exportado de Catapult, Polar, GPSports u otro sistema. La app detecta automáticamente las columnas de nombre, minutos, RPE, distancia, Player Load y más.
            </p>
            <div
              className={`csv-import-zone ${dragOver ? 'drag-over' : ''}`}
              style={{ marginTop: 16 }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload size={28} style={{ color: 'var(--blue)', margin: '0 auto 10px', display: 'block' }} />
              <strong>Arrastra el archivo aquí o haz clic para seleccionarlo</strong>
              <span>Formatos: .csv · .txt · .tsv · Separadores: coma, punto y coma, tabulación</span>
              <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" style={{ display: 'none' }} onChange={handleFile} />
            </div>
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 14, background: '#f8fbff', border: '1px solid var(--line)', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>
              <strong style={{ color: 'var(--navy)', display: 'block', marginBottom: 4 }}>Columnas que reconoce automáticamente:</strong>
              Nombre / Player · Minutos / Duration · RPE · Distance / Distancia · Player Load · HSR / High Speed · Sprint Distance · Max Speed / Vel. Máx · Acc · Dec · Sprints · RHIE · IMA
            </div>
          </div>
        )}

        {/* Step: Map */}
        {step === 'map' && (
          <div>
            <div className="csv-import-summary">
              <FileText size={16} style={{ color: 'var(--blue)' }} />
              <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{fileName}</span>
              <span className="csv-import-summary-pill" style={{ background: '#dcfce7', color: '#065f46' }}>
                <CheckCircle2 size={12} /> {rows.filter((r) => r.status === 'matched').length} automáticas
              </span>
              <span className="csv-import-summary-pill" style={{ background: '#fef3c7', color: '#92400e' }}>
                ⚠ {rows.filter((r) => r.status === 'fuzzy').length} dudosas
              </span>
              {unmatchedRows.length > 0 && (
                <span className="csv-import-summary-pill" style={{ background: '#fee2e2', color: '#991b1b' }}>
                  ✕ {unmatchedRows.length} sin asignar
                </span>
              )}
            </div>

            <p className="confirm-desc" style={{ marginTop: 10 }}>
              Revisa cada fila. Las verdes se asignaron automáticamente. Las amarillas tienen coincidencia parcial — confirma o cambia. Las rojas necesitan asignación manual.
            </p>

            <div style={{ display: 'grid', gap: 8, marginTop: 12, maxHeight: 380, overflowY: 'auto' }}>
              {rows.map((row, i) => (
                <div key={i} className={`csv-map-row ${row.status}`}>
                  <div>
                    <div className="csv-map-label">{row.csvRow.rawName}</div>
                    <div className="csv-map-sub">
                      {row.csvRow.min}min · RPE {row.csvRow.rpe}
                      {row.csvRow.totalDistance ? ` · ${row.csvRow.totalDistance.toFixed(0)}m` : ''}
                      {row.csvRow.playerLoad ? ` · PL ${row.csvRow.playerLoad.toFixed(1)}` : ''}
                    </div>
                  </div>
                  <ArrowRight size={16} className="csv-map-arrow" style={{ color: row.status === 'matched' ? '#16a34a' : row.status === 'fuzzy' ? '#d97706' : '#dc2626' }} />
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
                        Coincidencia parcial ({row.matchScore}%) — confirma si es correcto
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="confirm-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn secondary" onClick={() => setStep('upload')}>← Volver</button>
              <button
                type="button"
                className="btn"
                disabled={readyRows.length === 0}
                onClick={() => setStep('preview')}
              >
                Continuar ({readyRows.length} jugadores) →
              </button>
            </div>
          </div>
        )}

        {/* Step: Preview & confirm */}
        {step === 'preview' && (
          <div>
            <p className="confirm-desc">
              Se importarán {readyRows.length} registros para la sesión del {date}.
              {unmatchedRows.length > 0 && ` (${unmatchedRows.length} filas sin asignar serán ignoradas.)`}
            </p>

            <div className="professional-table-wrap" style={{ marginTop: 12 }}>
              <table className="csv-preview-table">
                <thead>
                  <tr>
                    <th>Jugador</th><th>MIN</th><th>RPE</th><th>Carga</th>
                    <th>Distancia</th><th>PL</th><th>Vel. máx</th>
                  </tr>
                </thead>
                <tbody>
                  {readyRows.map((row, i) => (
                    <tr key={i}>
                      <td><strong>{row.player!.name}</strong></td>
                      <td>{row.csvRow.min}</td>
                      <td>{row.csvRow.rpe}</td>
                      <td>{(row.csvRow.min * row.csvRow.rpe).toFixed(0)}</td>
                      <td>{row.csvRow.totalDistance ? `${row.csvRow.totalDistance.toFixed(0)} m` : '—'}</td>
                      <td>{row.csvRow.playerLoad ? row.csvRow.playerLoad.toFixed(1) : '—'}</td>
                      <td>{row.csvRow.maxVelocity ? `${row.csvRow.maxVelocity.toFixed(1)} km/h` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {unmatchedRows.length > 0 && (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: '#fff7ed', border: '1px solid #fde68a', fontSize: 12, color: '#92400e', fontWeight: 700 }}>
                <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6 }} />
                Ignoradas ({unmatchedRows.length}): {unmatchedRows.map((r) => r.csvRow.rawName).join(', ')}
              </div>
            )}

            <div className="confirm-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn secondary" onClick={() => setStep('map')}>← Revisar asignación</button>
              <button type="button" className="btn" onClick={handleImport}>
                <CheckCircle2 size={15} /> Importar {readyRows.length} registros
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
