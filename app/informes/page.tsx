'use client';

import Link from 'next/link';
import { BarChart3, ClipboardList, FileText, HeartPulse, ShieldCheck, Trophy, UserRound, Zap } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { EmptyState, ReportTypeCard, SectionHeader } from '@/components/pro-ui';
import { PlayerReportTemplate } from '@/components/player-report';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { calculateInternalLoad, averageWellness } from '@/lib/utils';
import { supportsGps } from '@/lib/report-utils';

export default function InformesPage() {
  const { data, filters, setFilters } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;
  const categoryPlayers = data.players.filter((player) => activeCategory === 'all' || player.category === activeCategory);
  const selectedPlayerId = filters.playerId === 'all' ? categoryPlayers[0]?.id ?? data.players[0]?.id ?? '' : filters.playerId;
  const player = data.players.find((item) => item.id === selectedPlayerId) ?? categoryPlayers[0] ?? data.players[0];
  const playerCategory = player?.category ?? (activeCategory === 'all' ? 'Sub20' : activeCategory);
  const gpsEnabled = supportsGps(playerCategory);

  const wellnessHistory = data.wellness
    .filter((record) => record.playerId === selectedPlayerId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((record) => ({ date: record.date, value: averageWellness(record) }));
  const internalHistory = data.internalLoads
    .filter((record) => record.playerId === selectedPlayerId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((record) => ({ date: record.date, load: calculateInternalLoad(record), rpe: record.rpe, duration: record.duration }));
  const externalHistory = gpsEnabled
    ? data.externalLoads
      .filter((record) => record.playerId === selectedPlayerId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((record) => ({ date: record.date, min: record.min, acc: record.acc, dcc: record.dcc, sprints: record.sprints, rhie: record.rhie, ima: record.ima, rpe: record.rpe }))
    : [];
  const nutritionHistory = data.nutritionRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => a.date.localeCompare(b.date));
  const neuromuscularHistory = data.neuromuscularRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => a.date.localeCompare(b.date));
  const cmjHistory = data.cmjRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => a.date.localeCompare(b.date));
  const fmsHistory = data.fmsRecords
    .filter((record) => record.playerId === selectedPlayerId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((record) => ({
      ...record,
      total: record.shoulderMobility + record.squat + record.legRaise + record.hurdleStep + record.lunge + record.trunkStability + record.rotaryStability,
    }));
  const competitionHistory = data.competitionRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => a.date.localeCompare(b.date));
  const hasDailyData = data.wellness.some((row) => row.date === filters.date) || data.internalLoads.some((row) => row.date === filters.date) || (gpsEnabled && data.externalLoads.some((row) => row.date === filters.date));
  const hasCompetitionData = data.competitionMatchSummaries.length > 0 || data.competitionRecords.length > 0;
  const hasSessionData = data.trainingSessionSummaries.length > 0;
  const hasEvaluationData = nutritionHistory.length || cmjHistory.length || fmsHistory.length || neuromuscularHistory.length;

  if (!player) return <EmptyState title="No hay jugadores disponibles" text="Agrega jugadores al plantel para generar informes individuales." />;

  const reportRows: Record<string, string | number>[] = [
    ...wellnessHistory.map((row) => ({ seccion: 'Wellness', fecha: row.date, promedio: row.value.toFixed(1) })),
    ...internalHistory.map((row) => ({ seccion: 'Carga interna', fecha: row.date, carga: row.load.toFixed(0), rpe: row.rpe, duracion: row.duration })),
    ...(gpsEnabled ? externalHistory.map((row) => ({ seccion: 'GPS', fecha: row.date, minutos: row.min, acc: row.acc ?? 0, dcc: row.dcc ?? 0, sprints: row.sprints ?? 0, rhie: row.rhie ?? 0, ima: row.ima ?? 0 })) : []),
    ...competitionHistory.map((row) => ({ seccion: 'Competencia', fecha: row.date, rival: row.opponent, minutos: row.minutesPlayed, goles: row.goals, asistencias: row.assists, amarillas: row.yellowCards, rojas: row.redCards })),
  ];

  return (
    <div className="grid report-page">
      <AppHero
        title="Centro de informes"
        subtitle="Reportes institucionales."
      
        heroClass="hero-informes"
      />

      <section className="card report-command-center no-print">
        <SectionHeader eyebrow="Reportes" title="Centro de informes" />
        <div className="report-center-grid premium-report-center-grid">
          <ReportTypeCard title="Informe diario" description="Wellness, carga y alertas." status={hasDailyData ? 'Listo' : 'No disponible'} primaryLabel="Ir a Diario" onPrimary={() => window.location.href = '/diario'} />
          <ReportTypeCard title="Informe de sesión" description="Sesión, participación, RPE y MIN." status={hasSessionData ? 'Disponible' : 'Sin sesión'} primaryLabel="Ir a Sesión" onPrimary={() => window.location.href = '/sesion-entrenamiento'} />
          <ReportTypeCard title="Informe de competencia" description="Marcador, planilla e incidencias." status={hasCompetitionData ? 'Con datos' : 'Sin partidos'} primaryLabel="Ir a Competencia" onPrimary={() => window.location.href = '/competencia'} />
          <ReportTypeCard title="Informe de valoraciones" description="Nutrición, CMJ, FMS y neuromuscular." status={hasEvaluationData ? 'Con datos' : 'Sin valoraciones'} primaryLabel="Ir a Valoraciones" onPrimary={() => window.location.href = '/valoraciones'} />
          <ReportTypeCard title="Informe individual 360" description="Perfil, carga, competencia y valoraciones." status={player ? 'Listo' : 'Sin jugador'} primaryLabel="Vista previa abajo" />
          <ReportTypeCard title="Reporte por periodo" description="Exporta números reales por jugador y rango de fechas." status={player ? 'Listo' : 'Sin jugador'} primaryLabel="Abrir reporte" onPrimary={() => window.location.href = '/informes/jugador-periodo'} />
          <ReportTypeCard title="Informe médico" description="Disponibilidad e incidencias." status="Listo" primaryLabel="Ver disponibilidad" onPrimary={() => window.location.href = '/disponibilidad'} />
          <ReportTypeCard title="Informe de carga" description="Carga interna y exposición." status={gpsEnabled ? 'GPS U20' : 'Listo'} primaryLabel="Ver carga" onPrimary={() => window.location.href = '/carga'} />
          <ReportTypeCard title="Informe ejecutivo" description="Plantel, alertas, carga y competencia." status="Listo" primaryLabel="Panel ejecutivo" onPrimary={() => window.location.href = '/ejecutivo'} />
        </div>
      </section>

      <section className="card no-print report-toolbar-premium">
        <div>
          <span className="section-eyebrow">Individual</span>
          <h3>Vista previa</h3>
          
        </div>
        <div className="btn-row">
          <div className="field compact-field">
            <label>Jugador</label>
            <select className="select" value={selectedPlayerId} onChange={(event) => setFilters({ playerId: event.target.value })}>
              {categoryPlayers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <button type="button" className="btn secondary" onClick={() => downloadCsv(`informe-${player.name.replaceAll(' ', '_')}.csv`, reportRows)}>Exportar CSV</button>
          <button type="button" className="btn" onClick={() => window.print()}>Exportar PDF</button>
        </div>
      </section>

      <section className="report-preview-shell">
        <PlayerReportTemplate
          player={player}
          category={playerCategory}
          wellnessHistory={wellnessHistory}
          internalHistory={internalHistory}
          externalHistory={externalHistory}
          competitionHistory={competitionHistory}
          nutritionHistory={nutritionHistory}
          cmjHistory={cmjHistory}
          fmsHistory={fmsHistory}
          neuromuscularHistory={neuromuscularHistory}
        />
      </section>

      <div className="card no-print report-next-actions">
        <SectionHeader eyebrow="Informes" title="Módulos disponibles" />
        <div className="strategy-link-grid">
          <Link href="/informes/jugador-periodo" className="strategy-link"><FileText size={18} /><strong>Reporte jugador</strong><span>Exportación por periodo.</span></Link>
          <Link href="/disponibilidad" className="strategy-link"><HeartPulse size={18} /><strong>Informe médico</strong><span>Disponibilidad y readaptación.</span></Link>
          <Link href="/carga" className="strategy-link"><BarChart3 size={18} /><strong>Informe de carga</strong><span>Carga.</span></Link>
          <Link href="/wellness" className="strategy-link"><ShieldCheck size={18} /><strong>Informe wellness</strong><span>Bienestar y fatiga.</span></Link>
          <Link href="/competencia" className="strategy-link"><Trophy size={18} /><strong>Informe competencia</strong><span>Competencia.</span></Link>
          <Link href="/sesion-entrenamiento" className="strategy-link"><ClipboardList size={18} /><strong>Informe sesión</strong><span>Sesión.</span></Link>
          <Link href="/jugadores" className="strategy-link"><UserRound size={18} /><strong>Perfil 360</strong><span>Jugador.</span></Link>
          <Link href="/alertas" className="strategy-link"><Zap size={18} /><strong>Alertas</strong><span>Alertas.</span></Link>
          <Link href="/ejecutivo" className="strategy-link"><FileText size={18} /><strong>Ejecutivo</strong><span>Dirección deportiva.</span></Link>
        </div>
      </div>
    </div>
  );
}
