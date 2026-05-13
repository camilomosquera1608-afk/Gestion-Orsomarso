'use client';

import { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Download, FileSpreadsheet, Footprints, Gauge, HeartPulse, Printer, ShieldCheck, UserRound, Weight } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { EmptyState, SectionHeader } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { downloadCsv } from '@/lib/export';
import { categoryLabel } from '@/lib/labels';
import { buildPlayerPeriodReport, type PeriodReportMetricRow } from '@/lib/player-period-report';

const addDays = (date: string, days: number) => {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const formatNumber = (value: unknown, decimals = 1) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('es-CO', { maximumFractionDigits: decimals });
};

const asNumber = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : 0;
};

const calcAge = (birthDate?: string) => {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
};

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

type ReportSectionKey = 'internal' | 'external' | 'strength' | 'competition' | 'evaluations';

const SECTION_LABELS: Record<ReportSectionKey, string> = {
  internal: 'Carga interna',
  external: 'GPS / carga externa',
  strength: 'Fuerza',
  competition: 'Competencia',
  evaluations: 'Valoraciones',
};

const DEFAULT_SECTIONS: Record<ReportSectionKey, boolean> = {
  internal: true,
  external: true,
  strength: true,
  competition: false,
  evaluations: false,
};

const numberDisplay = (value: string | number) => {
  if (typeof value !== 'number') return value || '—';
  return Number.isFinite(value) ? value.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—';
};

function DataTable({ title, rows, limit }: { title: string; rows: PeriodReportMetricRow[]; limit?: number }) {
  const visibleRows = typeof limit === 'number' ? rows.slice(0, limit) : rows;
  const headers = Array.from(new Set(visibleRows.flatMap((row) => Object.keys(row))));
  return (
    <section className="pdf-report-section player-period-print-break">
      <div className="pdf-report-section-heading">
        <span className="pdf-report-icon pdf-report-tone-blue"><FileSpreadsheet size={15} /></span>
        <div>
          <span>Datos reales</span>
          <h3>{title}</h3>
          <p>{rows.length} registro(s)</p>
        </div>
      </div>
      {visibleRows.length ? (
        <div className="table-scroll">
          <table className="pdf-report-table compact">
            <thead>
              <tr>{headers.map((header) => <th key={header}>{header.replaceAll('_', ' ')}</th>)}</tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {headers.map((header) => <td key={header}>{numberDisplay(row[header] ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="pdf-report-empty">Sin registros en el periodo seleccionado.</p>}
    </section>
  );
}

function PlayerPeriodKpi({ label, value, note, icon: Icon = Gauge }: { label: string; value: string | number; note?: string; icon?: typeof Gauge }) {
  return (
    <div className="pdf-report-kpi player-period-kpi">
      <span className="pdf-report-icon pdf-report-tone-blue"><Icon size={15} /></span>
      <div>
        <span>{label}</span>
        <strong>{value || '—'}</strong>
        {note ? <small>{note}</small> : null}
      </div>
    </div>
  );
}

function BarChart({ title, rows, valueKey, labelKey = 'fecha', unit = '', maxItems = 10 }: { title: string; rows: PeriodReportMetricRow[]; valueKey: string; labelKey?: string; unit?: string; maxItems?: number }) {
  const items = rows
    .map((row) => ({ label: String(row[labelKey] ?? ''), value: asNumber(row[valueKey]) }))
    .filter((item) => item.label && item.value > 0)
    .slice(-maxItems);
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="player-period-chart-card">
      <div className="player-period-chart-head">
        <strong>{title}</strong>
        <span>{items.length} dato(s)</span>
      </div>
      {items.length ? (
        <div className="player-period-bars">
          {items.map((item, index) => (
            <div className="player-period-bar-row" key={`${title}-${item.label}-${index}`}>
              <span>{item.label}</span>
              <i><em style={{ width: `${Math.max(4, Math.min(100, (item.value / max) * 100))}%` }} /></i>
              <strong>{formatNumber(item.value)}{unit}</strong>
            </div>
          ))}
        </div>
      ) : <p className="pdf-report-empty compact">Sin datos suficientes.</p>}
    </div>
  );
}

function MiniTrend({ title, rows, valueKey, unit = '' }: { title: string; rows: PeriodReportMetricRow[]; valueKey: string; unit?: string }) {
  const points = rows
    .map((row) => ({ label: String(row.fecha ?? ''), value: asNumber(row[valueKey]) }))
    .filter((item) => item.label && item.value > 0)
    .slice(-12);
  const max = Math.max(...points.map((item) => item.value), 1);
  const min = Math.min(...points.map((item) => item.value), 0);
  const range = Math.max(max - min, 1);
  const width = 520;
  const height = 160;
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - ((point.value - min) / range) * (height - 24) - 12;
    return { ...point, x, y };
  });
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  return (
    <div className="player-period-chart-card">
      <div className="player-period-chart-head">
        <strong>{title}</strong>
        <span>{points.length} dato(s)</span>
      </div>
      {points.length ? (
        <svg className="player-period-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          <line x1="0" y1={height - 12} x2={width} y2={height - 12} />
          <line x1="0" y1="12" x2="0" y2={height - 12} />
          <path d={path} />
          {coords.map((point, index) => <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="4" />)}
        </svg>
      ) : <p className="pdf-report-empty compact">Sin datos suficientes.</p>}
      {points.length ? <div className="player-period-chart-foot"><span>{points[0]?.label}</span><strong>{formatNumber(points.at(-1)?.value)}{unit}</strong><span>{points.at(-1)?.label}</span></div> : null}
    </div>
  );
}

function SectionToggles({ sections, onChange, showTables, onShowTablesChange }: { sections: Record<ReportSectionKey, boolean>; onChange: (key: ReportSectionKey, value: boolean) => void; showTables: boolean; onShowTablesChange: (value: boolean) => void }) {
  return (
    <div className="player-period-selector-grid">
      {(Object.keys(SECTION_LABELS) as ReportSectionKey[]).map((key) => (
        <label key={key} className={`player-period-selector ${sections[key] ? 'active' : ''}`}>
          <input type="checkbox" checked={sections[key]} onChange={(event) => onChange(key, event.target.checked)} />
          <span>{SECTION_LABELS[key]}</span>
        </label>
      ))}
      <label className={`player-period-selector ${showTables ? 'active' : ''}`}>
        <input type="checkbox" checked={showTables} onChange={(event) => onShowTablesChange(event.target.checked)} />
        <span>Tablas detalladas</span>
      </label>
    </div>
  );
}

export default function PlayerPeriodReportPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const players = data.players
    .filter((player) => activeCategory === 'all' || player.category === activeCategory)
    .sort((a, b) => a.name.localeCompare(b.name));

  const defaultPlayerId = filters.playerId !== 'all' && players.some((player) => player.id === filters.playerId)
    ? filters.playerId
    : players[0]?.id ?? '';
  const [playerId, setPlayerId] = useState(defaultPlayerId);
  const [endDate, setEndDate] = useState(filters.date);
  const [startDate, setStartDate] = useState(addDays(filters.date, -28));
  const [sections, setSections] = useState<Record<ReportSectionKey, boolean>>(DEFAULT_SECTIONS);
  const [showTables, setShowTables] = useState(false);

  const report = useMemo(() => buildPlayerPeriodReport(data, playerId, startDate, endDate), [data, playerId, startDate, endDate]);

  if (!players.length) {
    return <EmptyState title="No hay jugadores disponibles" text="Agrega jugadores al plantel para exportar reportes por periodo." />;
  }

  const safePlayerName = report?.player.name.replaceAll(' ', '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? 'jugador';
  const fileName = `reporte_jugador_${safePlayerName}_${startDate}_${endDate}.csv`;
  const summaryMap = new Map((report?.summaryRows ?? []).map((row) => [String(row.indicador), Number(row.valor ?? 0)]));
  const playerAge = calcAge(report?.player.birthDate) ?? report?.player.age ?? null;
  const selectedCsvRows = (report?.csvRows ?? []).filter((row) => {
    const section = normalize(String(row.seccion ?? ''));
    if (section === 'ficha' || section === 'resumen') return true;
    if (section.includes('carga interna')) return sections.internal;
    if (section.includes('gps')) return sections.external;
    if (section.includes('fuerza')) return sections.strength;
    if (section.includes('competencia')) return sections.competition;
    if (section.includes('valoraciones')) return sections.evaluations;
    return true;
  });

  return (
    <div className="grid report-page player-period-page">
      <AppHero
        title="Reporte premium por jugador"
        subtitle="Reporte exportable por periodo, compuesto por datos reales seleccionados por el staff. Sin notas de IA."
        heroClass="hero-informes"
      />

      <section className="card no-print">
        <div className="form-grid three-cols">
          <label>Jugador
            <select className="select" value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
              {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </label>
          <label>Desde
            <input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>Hasta
            <input className="input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
        <SectionHeader eyebrow="Contenido" title="Selecciona qué incluir" subtitle="Competencia, fuerza y valoraciones solo salen si las activas." />
        <SectionToggles sections={sections} onChange={(key, value) => setSections((current) => ({ ...current, [key]: value }))} showTables={showTables} onShowTablesChange={setShowTables} />
        <div className="btn-row mt-3">
          <button type="button" className="btn secondary" onClick={() => report && downloadCsv(fileName, selectedCsvRows)}>
            <Download size={16} /> Exportar CSV seleccionado
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>
      </section>

      {report ? (
        <article className="pdf-report-document player-period-report-doc">
          <header className="pdf-report-header player-period-premium-header">
            <div className="pdf-report-brand">
              <img src="/orsomarso-crest.jpg" alt="Orsomarso SC" />
              <div>
                <span>Orsomarso SC · Departamento de rendimiento</span>
                <h1>Reporte individual de rendimiento</h1>
                <p>{startDate} a {endDate}</p>
              </div>
            </div>
            <div className="pdf-report-header-meta">
              <strong>Documento para seguimiento deportivo</strong>
              <span>Datos reales exportados desde la plataforma</span>
            </div>
          </header>

          <section className="player-period-profile-hero">
            <div className="player-period-profile-photo">
              <img src={report.player.photo || '/orsomarso-crest.jpg'} alt={report.player.name} />
            </div>
            <div className="player-period-profile-main">
              <span>{report.player.category ? categoryLabel(report.player.category) : 'Sin categoría'}</span>
              <h2>{report.player.name}</h2>
              <div className="player-period-profile-tags">
                <b>{report.player.position}</b>
                {report.player.secondaryPosition ? <b>Sec. {report.player.secondaryPosition}</b> : null}
                <b>Pie {report.player.dominantFoot ?? 'sin definir'}</b>
                {report.player.jerseyNumber ? <b>#{report.player.jerseyNumber}</b> : null}
              </div>
            </div>
            <div className="player-period-profile-facts">
              <div><span>Fecha nacimiento</span><strong>{report.player.birthDate ?? '—'}</strong></div>
              <div><span>Edad</span><strong>{playerAge ? `${playerAge} años` : '—'}</strong></div>
              <div><span>Estatura</span><strong>{report.player.height ? `${report.player.height} cm` : '—'}</strong></div>
              <div><span>Peso</span><strong>{report.player.weight ? `${report.player.weight} kg` : '—'}</strong></div>
            </div>
          </section>

          <section className="pdf-report-section">
            <div className="pdf-report-section-heading">
              <span className="pdf-report-icon pdf-report-tone-blue"><Gauge size={15} /></span>
              <div>
                <span>Resumen del periodo</span>
                <h3>Indicadores principales</h3>
                <p>Promedios y totales calculados únicamente con registros guardados.</p>
              </div>
            </div>
            <div className="pdf-report-kpi-grid">
              <PlayerPeriodKpi icon={HeartPulse} label="Wellness promedio" value={formatNumber(summaryMap.get('Wellness promedio'))} note={`${formatNumber(summaryMap.get('Registros wellness'), 0)} registro(s)`} />
              <PlayerPeriodKpi icon={Gauge} label="RPE promedio" value={formatNumber(summaryMap.get('RPE promedio'))} note={`${formatNumber(summaryMap.get('Sesiones con RPE'), 0)} sesión(es)`} />
              <PlayerPeriodKpi icon={Footprints} label="Distancia GPS" value={`${formatNumber(summaryMap.get('Distancia total m'), 0)} m`} note="Total del periodo" />
              <PlayerPeriodKpi icon={Weight} label="Carga interna" value={`${formatNumber(summaryMap.get('Carga interna total UA'), 0)} UA`} note="Total del periodo" />
              <PlayerPeriodKpi icon={BarChart3} label="Player Load" value={formatNumber(summaryMap.get('Player Load total'), 1)} note="Total del periodo" />
              <PlayerPeriodKpi icon={ShieldCheck} label="ACC / DCC" value={`${formatNumber(summaryMap.get('ACC total'), 0)} / ${formatNumber(summaryMap.get('DCC total'), 0)}`} note="Totales" />
              <PlayerPeriodKpi icon={BarChart3} label="Sprints / RHIE" value={`${formatNumber(summaryMap.get('Sprints total'), 0)} / ${formatNumber(summaryMap.get('RHIE total'), 0)}`} note="Totales" />
              <PlayerPeriodKpi icon={CalendarDays} label="Minutos" value={`${formatNumber(summaryMap.get('Duracion total entrenamiento min'), 0)} min`} note="Entrenamiento registrado" />
            </div>
          </section>

          <section className="pdf-report-section">
            <div className="pdf-report-section-heading">
              <span className="pdf-report-icon pdf-report-tone-blue"><BarChart3 size={15} /></span>
              <div>
                <span>Visualización</span>
                <h3>Gráficas del periodo seleccionado</h3>
                <p>Solo se grafican las secciones activadas y con registros disponibles.</p>
              </div>
            </div>
            <div className="player-period-chart-grid">
              {sections.internal ? <MiniTrend title="Carga interna por sesión" rows={report.internalRows} valueKey="carga_interna_ua" unit=" UA" /> : null}
              {sections.internal ? <BarChart title="RPE por sesión" rows={report.internalRows} valueKey="rpe" unit="" /> : null}
              {sections.external ? <BarChart title="Distancia GPS" rows={report.externalRows} valueKey="distancia_m" unit=" m" /> : null}
              {sections.external ? <BarChart title="Player Load" rows={report.externalRows} valueKey="player_load" /> : null}
              {sections.external ? <BarChart title="ACC + DCC" rows={report.externalRows.map((row) => ({ ...row, neuromuscular: asNumber(row.acc) + asNumber(row.dcc) }))} valueKey="neuromuscular" /> : null}
              {sections.external ? <BarChart title="Sprints + RHIE" rows={report.externalRows.map((row) => ({ ...row, sprint_rhie: asNumber(row.sprints) + asNumber(row.rhie) }))} valueKey="sprint_rhie" /> : null}
              {sections.strength ? <BarChart title="Fuerza percibida" rows={report.strengthRows} valueKey="carga_percibida_ua" unit=" UA" /> : null}
              {sections.competition ? <BarChart title="Minutos en competencia" rows={report.competitionRows} valueKey="minutos" unit=" min" /> : null}
            </div>
          </section>

          <section className="pdf-report-section player-period-summary-table">
            <div className="pdf-report-section-heading">
              <span className="pdf-report-icon pdf-report-tone-blue"><FileSpreadsheet size={15} /></span>
              <div>
                <span>Resumen numérico</span>
                <h3>Totales y promedios reales</h3>
                <p>Tabla compacta para lectura institucional y exportación.</p>
              </div>
            </div>
            <table className="pdf-report-table compact">
              <thead><tr><th>Indicador</th><th>Valor</th></tr></thead>
              <tbody>{report.summaryRows.map((row) => <tr key={String(row.indicador)}><td>{row.indicador}</td><td>{numberDisplay(row.valor ?? '')}</td></tr>)}</tbody>
            </table>
          </section>

          {showTables ? (
            <>
              {sections.internal ? <DataTable title="Carga interna" rows={report.internalRows} /> : null}
              {sections.external ? <DataTable title="GPS / carga externa" rows={report.externalRows} /> : null}
              {sections.strength ? <DataTable title="Fuerza" rows={report.strengthRows} /> : null}
              {sections.competition ? <DataTable title="Competencia" rows={report.competitionRows} /> : null}
              {sections.evaluations ? <DataTable title="Valoraciones" rows={report.evaluationRows} /> : null}
            </>
          ) : null}

          <footer className="pdf-report-footer">
            <span>Orsomarso SC · Reporte individual</span>
            <span>Generado desde registros reales del periodo seleccionado</span>
          </footer>
        </article>
      ) : <EmptyState title="No se pudo generar el reporte" text="Selecciona un jugador y un rango de fechas válido." />}
    </div>
  );
}
