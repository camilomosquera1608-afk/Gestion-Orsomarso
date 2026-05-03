'use client';

import { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, X, Download } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { parseEyeballCsv, type EyeballMatchStats } from '@/components/eyeball-importer';

// ── Helpers ───────────────────────────────────────────────────────────────────
const numVal = (v: string | number): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const displayVal = (v: string | number): string => {
  if (typeof v === 'string') return v;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

type WinnerSide = 'orso' | 'rival' | 'draw';
const winner = (orso: number, rival: number, higherBetter = true): WinnerSide => {
  if (orso === rival) return 'draw';
  return (orso > rival) === higherBetter ? 'orso' : 'rival';
};

const LOWER_BETTER_STATS = new Set(['Faltas', 'Fuera de juego', 'Errores', 'Disparos en total', 'Tiros fuera de puerta', 'Tiros fuera del área']);

// ── Subcomponentes ────────────────────────────────────────────────────────────
function ScoreHero({ stats }: { stats: EyeballMatchStats }) {
  const result = stats.goalsFor > stats.goalsAgainst ? 'Victoria' : stats.goalsFor < stats.goalsAgainst ? 'Derrota' : 'Empate';
  const resultColor = result === 'Victoria' ? '#059669' : result === 'Derrota' ? '#dc2626' : '#d97706';
  return (
    <div style={{ background: 'linear-gradient(135deg,#06152f 0%,#1a3a8a 100%)', borderRadius: 20, padding: '24px 28px', color: '#fff', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 0, marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>Rival</div>
        <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-.02em' }}>{stats.rivalName}</div>
      </div>
      <div style={{ textAlign: 'center', padding: '0 28px' }}>
        <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-.06em', lineHeight: 1 }}>
          <span style={{ color: 'rgba(255,255,255,.5)' }}>{stats.goalsAgainst}</span>
          <span style={{ color: 'rgba(255,255,255,.25)', margin: '0 10px', fontWeight: 300 }}>:</span>
          <span style={{ color: '#fff' }}>{stats.goalsFor}</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginTop: 6 }}>Marcador</div>
        <div style={{ marginTop: 8, display: 'inline-block', padding: '5px 14px', borderRadius: 999, background: resultColor, fontSize: 11, fontWeight: 800 }}>{result}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>Orsomarso SC</div>
        <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-.02em' }}>Orsomarso SC</div>
      </div>
    </div>
  );
}

function StatRow({ stat, orso, rival, rivalName }: { stat: string; orso: string | number; rival: string | number; rivalName: string }) {
  const orsoN = numVal(orso); const rivalN = numVal(rival);
  const higherBetter = !LOWER_BETTER_STATS.has(stat);
  const win = winner(orsoN, rivalN, higherBetter);
  const total = orsoN + rivalN || 1;
  const orsoW = Math.round((orsoN / total) * 100);
  const rivalW = 100 - orsoW;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f4fb' }}>
      <div style={{ textAlign: 'right', fontWeight: win === 'rival' ? 900 : 700, color: win === 'rival' ? '#065f46' : '#334155', fontSize: 13 }}>{displayVal(rival)}</div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textAlign: 'center', marginBottom: 4 }}>{stat}</div>
        <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', gap: 1 }}>
          <div style={{ width: `${rivalW}%`, background: '#94a3b8', borderRadius: '999px 0 0 999px' }} />
          <div style={{ width: `${orsoW}%`, background: win === 'orso' ? '#059669' : win === 'rival' ? '#dc2626' : '#94a3b8', borderRadius: '0 999px 999px 0' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
          <span>{rivalW}%</span><span>{orsoW}%</span>
        </div>
      </div>
      <div style={{ fontWeight: win === 'orso' ? 900 : 700, color: win === 'orso' ? '#065f46' : '#334155', fontSize: 13 }}>{displayVal(orso)}</div>
    </div>
  );
}

function SectionBlock({ title, rows, rivalName }: { title: string; rows: EyeballMatchStats['sections'][string]; rivalName: string }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: '2px solid #1557d6' }}>
        <strong style={{ fontSize: 14, fontWeight: 900, color: '#06152f', textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</strong>
        <div style={{ display: 'flex', gap: 24, fontSize: 10, fontWeight: 800, color: '#64748b' }}>
          <span style={{ textAlign: 'right', minWidth: 80 }}>{rivalName}</span>
          <span style={{ minWidth: 80 }}>Orsomarso SC</span>
        </div>
      </div>
      {rows.map((row) => (
        <StatRow key={row.stat} stat={row.stat} orso={row.orso} rival={row.rival} rivalName={rivalName} />
      ))}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AnalisisTacticoPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [stats, setStats] = useState<EyeballMatchStats | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const processFile = (file: File) => {
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = String(e.target?.result ?? '');
      const parsed = parseEyeballCsv(raw);
      if (!parsed) {
        setError('No se pudo leer el archivo. Verifica que sea un CSV exportado de Eyeball con columnas: Categoría;Estadística;Rival;Orsomarso.');
        return;
      }
      setStats(parsed);
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

  return (
    <div className="grid">
      <AppHero title="Análisis táctico" subtitle="Importa el CSV de Eyeball para ver el análisis comparativo del partido" />

      {!stats ? (
        <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
          <h3 style={{ margin: '0 0 6px' }}>Importar estadísticas de partido</h3>
          <p className="muted-line" style={{ marginBottom: 20 }}>Exporta el reporte del partido desde Eyeball en formato CSV y súbelo aquí. La app genera automáticamente el análisis comparativo.</p>

          <div
            className={`csv-import-zone ${dragOver ? 'drag-over' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload size={28} style={{ color: 'var(--blue)', margin: '0 auto 10px', display: 'block' }} />
            <strong>Arrastra el CSV de Eyeball aquí</strong>
            <span>Formato: Categoría · Estadística · Rival · Orsomarso SC</span>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
          </div>

          {error && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13, fontWeight: 700 }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 14, background: '#f8fbff', border: '1px solid var(--line)', fontSize: 12, color: 'var(--muted)' }}>
            <strong style={{ color: 'var(--navy)', display: 'block', marginBottom: 4 }}>Cómo exportar desde Eyeball:</strong>
            Dashboard → Partido → Estadísticas → Exportar CSV · Separador: punto y coma (;) o coma (,)
          </div>
        </div>
      ) : (
        <div>
          {/* Toolbar */}
          <div className="toolbar card">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} style={{ color: 'var(--blue)' }} />
                <strong style={{ fontSize: 14 }}>{fileName}</strong>
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: '#dcfce7', color: '#065f46', fontWeight: 700 }}>
                  <CheckCircle2 size={11} style={{ display: 'inline', marginRight: 3 }} />Cargado
                </span>
              </div>
              <div className="muted-line">{stats.rivalName} vs Orsomarso SC · {stats.goalsAgainst}:{stats.goalsFor}</div>
            </div>
            <div className="btn-row">
              <button type="button" className="btn secondary" onClick={() => { setStats(null); setFileName(''); }}>
                <X size={14} /> Cambiar archivo
              </button>
              <button type="button" className="btn secondary" onClick={() => window.print()}>
                <Download size={14} /> Descargar PDF
              </button>
            </div>
          </div>

          {/* Hero marcador */}
          <ScoreHero stats={stats} />

          {/* KPIs clave */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Posesión', orso: `${stats.possession}%`, rival: `${100 - stats.possession}%`, win: stats.possession >= 50 },
              { label: 'Conversión', orso: `${stats.conversionRate}%`, rival: stats.sections['Ofensivo']?.find((r) => r.stat === 'Tasa de conversión de tiros')?.rival ?? '—', win: true },
              { label: 'Precisión pase', orso: `${stats.passPrecision}%`, rival: stats.sections['Distribución']?.find((r) => r.stat === 'Precisión de pases')?.rival ?? '—', win: true },
              { label: 'Valoración', orso: stats.sections['Resumen']?.find((r) => r.stat === 'Valoración media del jugador por partido')?.orso ?? '—', rival: stats.sections['Resumen']?.find((r) => r.stat === 'Valoración media del jugador por partido')?.rival ?? '—', win: true },
            ].map(({ label, orso, rival, win }) => (
              <div key={label} className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: '#64748b', marginBottom: 6 }}>{label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: 'right' }}>{String(rival)}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>vs</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: win ? '#059669' : '#dc2626' }}>{String(orso)}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, fontSize: 9, color: '#94a3b8', justifyContent: 'center', marginTop: 4 }}>
                  <span>Rival</span><span>·</span><span style={{ color: '#1557d6', fontWeight: 800 }}>Orsomarso</span>
                </div>
              </div>
            ))}
          </div>

          {/* Secciones estadísticas */}
          {Object.entries(stats.sections).map(([section, rows]) => (
            <SectionBlock key={section} title={section} rows={rows} rivalName={stats.rivalName} />
          ))}
        </div>
      )}
    </div>
  );
}
