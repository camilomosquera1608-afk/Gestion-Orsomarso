'use client';

import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Printer, UserRound } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { EmptyState, SectionHeader } from '@/components/pro-ui';
import { KpiCard } from '@/components/kpi-card';
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

const numberDisplay = (value: string | number) => {
  if (typeof value !== 'number') return value || '—';
  return Number.isFinite(value) ? value.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—';
};

function DataTable({ title, rows, limit }: { title: string; rows: PeriodReportMetricRow[]; limit?: number }) {
  const visibleRows = typeof limit === 'number' ? rows.slice(0, limit) : rows;
  const headers = Array.from(new Set(visibleRows.flatMap((row) => Object.keys(row))));
  return (
    <section className="card report-numeric-section">
      <SectionHeader eyebrow="Datos" title={title} subtitle={`${rows.length} registro(s)`} />
      {visibleRows.length ? (
        <div className="table-scroll">
          <table className="pro-table compact-table">
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
      ) : <p className="muted small-text">Sin registros en el periodo seleccionado.</p>}
    </section>
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

  const report = useMemo(() => buildPlayerPeriodReport(data, playerId, startDate, endDate), [data, playerId, startDate, endDate]);

  if (!players.length) {
    return <EmptyState title="No hay jugadores disponibles" text="Agrega jugadores al plantel para exportar reportes por periodo." />;
  }

  const safePlayerName = report?.player.name.replaceAll(' ', '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? 'jugador';
  const fileName = `reporte_jugador_${safePlayerName}_${startDate}_${endDate}.csv`;
  const summaryMap = new Map((report?.summaryRows ?? []).map((row) => [String(row.indicador), Number(row.valor ?? 0)]));

  return (
    <div className="grid report-page">
      <AppHero
        title="Reporte numérico por jugador"
        subtitle="Exportación por periodo basada únicamente en registros guardados. Sin notas automáticas ni interpretación generada."
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
        <div className="btn-row mt-3">
          <button type="button" className="btn secondary" onClick={() => report && downloadCsv(fileName, report.csvRows)}>
            <Download size={16} /> Exportar CSV
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>
      </section>

      {report ? (
        <>
          <section className="card report-header-card">
            <div className="split-row">
              <div>
                <span className="section-eyebrow">Jugador</span>
                <h2>{report.player.name}</h2>
                <p className="muted">{report.player.category ? categoryLabel(report.player.category) : 'Sin categoría'} · {report.player.position} · {startDate} a {endDate}</p>
              </div>
              <div className="report-print-logo"><UserRound size={36} /></div>
            </div>
          </section>

          <div className="grid grid-4">
            <KpiCard label="Wellness prom." value={String(summaryMap.get('Wellness promedio') ?? 0)} tone="blue" trend="Registros reales" />
            <KpiCard label="Carga interna UA" value={String(summaryMap.get('Carga interna total UA') ?? 0)} tone="green" trend="Total periodo" />
            <KpiCard label="Distancia GPS" value={`${summaryMap.get('Distancia total m') ?? 0} m`} tone="amber" trend="Total periodo" />
            <KpiCard label="Fuerza percibida" value={`${summaryMap.get('Carga fuerza percibida total UA') ?? 0} UA`} tone="red" trend="Total periodo" />
          </div>

          <DataTable title="Resumen numérico" rows={report.summaryRows} />
          <DataTable title="Wellness" rows={report.wellnessRows} />
          <DataTable title="Carga interna" rows={report.internalRows} />
          <DataTable title="GPS / carga externa" rows={report.externalRows} />
          <DataTable title="Fuerza" rows={report.strengthRows} />
          <DataTable title="Competencia" rows={report.competitionRows} />
          <DataTable title="Valoraciones" rows={report.evaluationRows} />

          <section className="card no-print">
            <SectionHeader eyebrow="Exportación" title="Archivos disponibles" subtitle="El CSV incluye todas las secciones numéricas del periodo." />
            <div className="btn-row">
              <button type="button" className="btn secondary" onClick={() => downloadCsv(fileName, report.csvRows)}><FileSpreadsheet size={16} /> Descargar CSV</button>
              <button type="button" className="btn" onClick={() => window.print()}><Printer size={16} /> Imprimir / guardar PDF</button>
            </div>
          </section>
        </>
      ) : <EmptyState title="No se pudo generar el reporte" text="Selecciona un jugador y un rango de fechas válido." />}
    </div>
  );
}
