'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, Bell, ClipboardList, HeartPulse, ShieldCheck, Target, Trophy, Users, Zap } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { PlayerStatusBadge, WellnessBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel, calcAge } from '@/lib/labels';
import { ClubCategory, Player } from '@/lib/types';
import { averageWellness, calculateInternalLoad, groupAverage } from '@/lib/utils';
import { formatDateShort } from '@/lib/operational-helpers';
import { formatMatchScore } from '@/lib/performance-helpers';
import { getCanonicalPlayers, getEffectiveExternalLoads, getRelatedPlayerIds, getRelatedPlayerIdSet, getWellnessRecordsForDate } from '@/lib/relational-data';

const normalizeCategoryText = (category: string | undefined) => {
  if (!category || category === 'all') return 'Todas';
  return categoryLabel(category as ClubCategory);
};

const safeNumber = (value: number | undefined | null) => Number.isFinite(Number(value)) ? Number(value) : 0;
const sum = (values: Array<number | undefined | null>) => values.reduce<number>((acc, value) => acc + safeNumber(value), 0);
const avg = (values: Array<number | undefined | null>) => {
  const clean = values.map(safeNumber).filter((value) => value > 0);
  return clean.length ? clean.reduce((acc, value) => acc + value, 0) / clean.length : 0;
};

export default function ExecutivePage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;
  const activeCategoryLabel = normalizeCategoryText(activeCategory);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

  const dashboard = useMemo(() => {
    const categoryFilter = activeCategory === 'all' ? undefined : activeCategory as ClubCategory;
    const players = getCanonicalPlayers(data, data.players.filter((player) => !categoryFilter || player.category === categoryFilter));
    const playerIds = getRelatedPlayerIdSet(data.players, players);
    const microcycle = data.microcycles.find((item) => (!categoryFilter || item.category === categoryFilter) && filters.date >= item.startDate && filters.date <= item.endDate);
    const sessionSummary = data.trainingSessionSummaries.find((item) => item.date === filters.date && (!categoryFilter || item.category === categoryFilter));
    const dayWellness = getWellnessRecordsForDate(data, filters.date, playerIds);
    const dayInternal = data.internalLoads.filter((item) => item.date === filters.date && playerIds.has(item.playerId));
    const dayExternal = getEffectiveExternalLoads(data, { activeCategory, date: filters.date, playerIds });
    const recentMatches = data.competitionMatchSummaries
      .filter((item) => !categoryFilter || item.category === categoryFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
    const latestMatch = recentMatches.find((item) => item.date <= filters.date) ?? recentMatches[0];
    const upcomingMatch = [...recentMatches].reverse().find((item) => item.date > filters.date);
    const wellnessAverage = avg(dayWellness.map((item) => averageWellness(item)));
    const internalLoadTotal = sum(dayInternal.map((item) => calculateInternalLoad(item)));
    const minutesTotal = sum(dayExternal.map((item) => item.min));
    const gpsEnabled = categoryFilter === 'Sub20';
    const gpsSummary = {
      distance: sum(dayExternal.map((item) => item.totalDistance)),
      playerLoad: sum(dayExternal.map((item) => item.playerLoad)),
      highSpeed: sum(dayExternal.map((item) => item.highSpeedDistance)),
      sprintDistance: sum(dayExternal.map((item) => item.sprintDistance)),
      maxVelocity: Math.max(0, ...dayExternal.map((item) => safeNumber(item.maxVelocity))),
      acc: sum(dayExternal.map((item) => item.acc)),
      dcc: sum(dayExternal.map((item) => item.dcc)),
    };
    const statusCounts = players.reduce<Record<string, number>>((acc, player) => {
      acc[player.status] = (acc[player.status] ?? 0) + 1;
      return acc;
    }, {});

    const playerCards = players.map((player) => {
      const relatedIds = getRelatedPlayerIds(data.players, player.id);
      const latestWellness = data.wellness.filter((item) => relatedIds.has(item.playerId)).sort((a, b) => b.date.localeCompare(a.date))[0];
      const latestExternal = data.externalLoads.filter((item) => relatedIds.has(item.playerId)).sort((a, b) => b.date.localeCompare(a.date))[0];
      const latestInternal = data.internalLoads.filter((item) => relatedIds.has(item.playerId)).sort((a, b) => b.date.localeCompare(a.date))[0];
      const latestCompetition = data.competitionRecords.filter((item) => relatedIds.has(item.playerId)).sort((a, b) => b.date.localeCompare(a.date))[0];
      const wellness = latestWellness ? averageWellness(latestWellness) : 0;
      const load = latestInternal ? calculateInternalLoad(latestInternal) : 0;
      const alerts = [
        !latestWellness ? 'Sin wellness reciente' : '',
        wellness > 0 && wellness < 3 ? 'Wellness bajo' : '',
        load >= 500 ? 'Carga interna alta' : '',
        player.status !== 'Disponible' ? `Estado: ${player.status}` : '',
        !latestCompetition ? 'Sin competencia registrada' : '',
      ].filter(Boolean);
      return { player, latestWellness, latestExternal, latestInternal, latestCompetition, wellness, load, alerts };
    });

    const priorityPlayers = [...playerCards]
      .sort((a, b) => b.alerts.length - a.alerts.length || b.load - a.load)
      .slice(0, 8);

    const loadTrend = Array.from(new Set([...data.internalLoads, ...data.externalLoads]
      .filter((item) => playerIds.has(item.playerId))
      .map((item) => item.date)))
      .sort()
      .slice(-7)
      .map((date) => {
        const internal = data.internalLoads.filter((item) => item.date === date && playerIds.has(item.playerId));
        const external = data.externalLoads.filter((item) => item.date === date && playerIds.has(item.playerId));
        return {
          fecha: formatDateShort(date),
          Carga: Math.round(sum(internal.map((item) => calculateInternalLoad(item)))),
          Min: Math.round(sum(external.map((item) => item.min))),
          Wellness: Number(avg(getWellnessRecordsForDate(data, date, playerIds).map((item) => averageWellness(item))).toFixed(1)),
        };
      });

    const qualityChecks = [
      { label: 'Jugadores con posición', value: players.filter((player) => Boolean(player.position)).length, total: players.length },
      { label: 'Wellness del día', value: dayWellness.length, total: players.length },
      { label: 'Carga del día', value: dayInternal.length || dayExternal.length, total: players.length },
      { label: 'Sesión del día', value: sessionSummary ? 1 : 0, total: 1 },
      { label: 'Microciclo activo', value: microcycle ? 1 : 0, total: 1 },
    ];

    const operationalAlerts = [
      !microcycle ? `No hay microciclo activo para ${activeCategoryLabel} en la fecha seleccionada.` : '',
      !sessionSummary ? `No hay sesión registrada para ${activeCategoryLabel} en la fecha seleccionada.` : '',
      dayWellness.length < players.length ? `${players.length - dayWellness.length} jugadores sin wellness hoy.` : '',
      (dayInternal.length || dayExternal.length) < players.length ? `${players.length - (dayInternal.length || dayExternal.length)} jugadores sin carga registrada hoy.` : '',
      gpsEnabled && dayExternal.length === 0 ? 'U20 sin datos GPS/Catapult para la fecha activa.' : '',
      priorityPlayers.filter((item) => item.alerts.length).length ? `${priorityPlayers.filter((item) => item.alerts.length).length} jugadores requieren revisión.` : '',
    ].filter(Boolean);

    return {
      players,
      playerCards,
      priorityPlayers,
      microcycle,
      sessionSummary,
      latestMatch,
      upcomingMatch,
      dayWellness,
      dayInternal,
      dayExternal,
      wellnessAverage,
      internalLoadTotal,
      minutesTotal,
      gpsEnabled,
      gpsSummary,
      statusCounts,
      loadTrend,
      qualityChecks,
      operationalAlerts,
    };
  }, [activeCategory, activeCategoryLabel, data, filters.date]);

  const selectedPlayer = dashboard.playerCards.find((item) => item.player.id === selectedPlayerId) ?? dashboard.priorityPlayers[0];

  return (
    <div className="grid executive-page live-dashboard-page">
      <AppHero
        title="Dashboard vivo"
        subtitle={`Centro de control · ${activeCategoryLabel} · ${formatDateShort(filters.date)}`}
      />
      <GlobalFiltersBar />

      <section className="live-command-center card">
        <div>
          <span className="section-eyebrow">Orsomarso Performance</span>
          <h2>Centro de control en vivo</h2>
          <p>Lectura rápida de microciclo, sesión, carga, wellness, competencia, GPS U20 y jugadores que requieren atención.</p>
        </div>
        <div className="live-command-actions">
          <StatusBadge text={activeCategoryLabel} tone="blue" />
          {dashboard.microcycle ? <StatusBadge text={dashboard.microcycle.name} tone="dark" /> : <StatusBadge text="Sin microciclo" tone="amber" />}
          {dashboard.sessionSummary ? <StatusBadge text={`Sesión ${dashboard.sessionSummary.sessionNumber}`} tone="green" /> : <StatusBadge text="Sin sesión" tone="amber" />}
        </div>
      </section>

      <div className="grid grid-5">
        <KpiCard label="Jugadores" value={String(dashboard.players.length)} icon={<Users size={18} />} tone="blue" trend="Plantilla filtrada" />
        <KpiCard label="Disponibles" value={String(dashboard.statusCounts.Disponible ?? 0)} icon={<ShieldCheck size={18} />} tone="green" trend="Habilitados" />
        <KpiCard label="Wellness" value={dashboard.wellnessAverage ? dashboard.wellnessAverage.toFixed(1) : '0.0'} icon={<HeartPulse size={18} />} tone={dashboard.wellnessAverage && dashboard.wellnessAverage < 3 ? 'red' : 'blue'} trend="Promedio día" />
        <KpiCard label="Carga interna" value={String(Math.round(dashboard.internalLoadTotal))} icon={<Activity size={18} />} tone="dark" trend="UA día" />
        <KpiCard label="Alertas" value={String(dashboard.operationalAlerts.length)} icon={<Bell size={18} />} tone={dashboard.operationalAlerts.length ? 'amber' : 'green'} trend="Operativas" />
      </div>

      {dashboard.gpsEnabled ? (
        <div className="card live-gps-strip">
          <SectionHeader eyebrow="Catapult U20" title="Carga externa GPS" subtitle="Métricas reales cargadas para la fecha activa." />
          <div className="live-gps-grid">
            <div><span>Distancia</span><strong>{Math.round(dashboard.gpsSummary.distance)} m</strong></div>
            <div><span>Player Load</span><strong>{Math.round(dashboard.gpsSummary.playerLoad)}</strong></div>
            <div><span>Vel. máx.</span><strong>{dashboard.gpsSummary.maxVelocity.toFixed(1)} km/h</strong></div>
            <div><span>Alta velocidad</span><strong>{Math.round(dashboard.gpsSummary.highSpeed)} m</strong></div>
            <div><span>Sprint dist.</span><strong>{Math.round(dashboard.gpsSummary.sprintDistance)} m</strong></div>
            <div><span>ACC / DCC</span><strong>{Math.round(dashboard.gpsSummary.acc)} / {Math.round(dashboard.gpsSummary.dcc)}</strong></div>
          </div>
        </div>
      ) : (
        <div className="card live-gps-strip youth-simple-strip">
          <SectionHeader eyebrow="U17 / U15" title="Carga simple" subtitle="Lectura combinada con minutos, RPE y wellness. No se muestran métricas GPS en esta categoría." />
          <div className="live-gps-grid">
            <div><span>Minutos</span><strong>{Math.round(dashboard.minutesTotal)}</strong></div>
            <div><span>RPE promedio</span><strong>{avg(dashboard.dayInternal.map((item) => item.rpe)).toFixed(1)}</strong></div>
            <div><span>Carga interna</span><strong>{Math.round(dashboard.internalLoadTotal)}</strong></div>
            <div><span>Wellness</span><strong>{dashboard.wellnessAverage.toFixed(1)}</strong></div>
          </div>
        </div>
      )}

      <div className="live-dashboard-layout">
        <div className="card">
          <SectionHeader eyebrow="Prioridad" title="Jugadores a revisar" subtitle="Ordenados por alertas, carga reciente y datos pendientes." />
          <div className="live-player-list">
            {dashboard.priorityPlayers.map((item) => (
              <button type="button" className={`live-player-row ${selectedPlayer?.player.id === item.player.id ? 'active' : ''}`} key={item.player.id} onClick={() => setSelectedPlayerId(item.player.id)}>
                <img src={item.player.photo || '/orsomarso-crest.jpg'} alt={item.player.name} />
                <div>
                  <strong>{item.player.name}</strong>
                  <span>{item.player.position} · {categoryLabel(item.player.category ?? 'Sub20')} · {item.latestCompetition ? `${item.latestCompetition.minutesPlayed} min comp.` : 'Sin competencia'}</span>
                </div>
                <div className="live-player-tags">
                  <PlayerStatusBadge status={item.player.status} />
                  {item.latestWellness ? <WellnessBadge value={item.wellness} /> : <span className="status-badge ui-tone-neutral">Sin wellness</span>}
                </div>
              </button>
            ))}
            {!dashboard.priorityPlayers.length ? <EmptyState title="Sin jugadores visibles" text="Ajusta la categoría o carga jugadores para iniciar seguimiento." /> : null}
          </div>
        </div>

        <aside className="card live-player-panel">
          {selectedPlayer ? (
            <>
              <SectionHeader eyebrow="Perfil 360" title={selectedPlayer.player.name} subtitle={`${selectedPlayer.player.position} · ${categoryLabel(selectedPlayer.player.category ?? 'Sub20')}`} />
              <div className="live-player-profile-head">
                <img src={selectedPlayer.player.photo || '/orsomarso-crest.jpg'} alt={selectedPlayer.player.name} />
                <div>
                  <PlayerStatusBadge status={selectedPlayer.player.status} />
                  <p>{calcAge(selectedPlayer.player.birthDate) ?? selectedPlayer.player.age} años · {selectedPlayer.player.height} cm · {selectedPlayer.player.weight} kg</p>
                </div>
              </div>
              <div className="live-player-metrics">
                <div><span>Wellness</span><strong>{selectedPlayer.latestWellness ? selectedPlayer.wellness.toFixed(1) : 'Sin registro'}</strong></div>
                <div><span>Carga</span><strong>{selectedPlayer.load}</strong></div>
                <div><span>Última sesión</span><strong>{selectedPlayer.latestExternal?.date ?? 'Sin registro'}</strong></div>
                <div><span>Último partido</span><strong>{selectedPlayer.latestCompetition?.date ?? 'Sin registro'}</strong></div>
                <div><span>Minutos comp.</span><strong>{selectedPlayer.latestCompetition?.minutesPlayed ?? 0}</strong></div>
                <div><span>GPS Player Load</span><strong>{selectedPlayer.latestExternal?.playerLoad ?? '—'}</strong></div>
              </div>
              <div className="live-alert-stack">
                {selectedPlayer.alerts.length ? selectedPlayer.alerts.map((alert) => <div className="alert-item tone-yellow" key={alert}>{alert}</div>) : <div className="alert-item tone-green">Sin alertas recientes.</div>}
              </div>
              <div className="btn-row">
                <Link className="btn" href={`/jugadores/${selectedPlayer.player.id}`}>Abrir ficha</Link>
                <Link className="btn secondary" href="/informes/jugador-periodo">Informe</Link>
              </div>
            </>
          ) : <EmptyState title="Selecciona un jugador" text="El perfil 360 aparecerá aquí." />}
        </aside>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Tendencia" title="Últimos registros" subtitle="Minutos, carga y wellness de los últimos días con datos." />
          {dashboard.loadTrend.length ? (
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={dashboard.loadTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="Carga" fill="#1557d6" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="Min" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="Sin tendencia disponible" text="Carga sesiones, RPE o GPS para construir la lectura." />}
        </div>
        <div className="card">
          <SectionHeader eyebrow="Control" title="Calidad de datos" subtitle="Señales para operar antes de generar informes." />
          <div className="quality-check-list">
            {dashboard.qualityChecks.map((item) => {
              const percent = item.total ? Math.round((item.value / item.total) * 100) : 0;
              return (
                <div className="quality-check-row" key={item.label}>
                  <div><strong>{item.label}</strong><span>{item.value}/{item.total}</span></div>
                  <div className="quality-check-bar"><span style={{ width: `${Math.min(100, percent)}%` }} /></div>
                </div>
              );
            })}
          </div>
          <div className="live-alert-stack compact">
            {dashboard.operationalAlerts.map((alert) => <div className="alert-item tone-yellow" key={alert}>{alert}</div>)}
            {!dashboard.operationalAlerts.length ? <div className="alert-item tone-green">Datos operativos sin alertas críticas.</div> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Competencia" title="Lectura rápida" subtitle="Último y próximo partido por categoría activa." />
          {dashboard.latestMatch ? (
            <div className="executive-match-summary">
              <strong>Último partido</strong>
              <span>{formatDateShort(dashboard.latestMatch.date)} · {dashboard.latestMatch.venue ?? 'Local'}</span>
              <h3>Orsomarso SC {formatMatchScore(dashboard.latestMatch)} {dashboard.latestMatch.opponent}</h3>
              <StatusBadge text={dashboard.latestMatch.resultType ?? 'Resultado'} tone={dashboard.latestMatch.resultType === 'Victoria' ? 'green' : dashboard.latestMatch.resultType === 'Derrota' ? 'red' : 'blue'} />
            </div>
          ) : <EmptyState title="Sin competencia registrada" text="Carga partidos para activar el bloque competitivo." />}
          {dashboard.upcomingMatch ? <div className="muted-line">Próximo partido: {formatDateShort(dashboard.upcomingMatch.date)} vs {dashboard.upcomingMatch.opponent}</div> : null}
        </div>
        <div className="card">
          <SectionHeader eyebrow="Acciones" title="Accesos rápidos" subtitle="Operación diaria desde el dashboard." />
          <div className="strategy-link-grid">
            <Link href="/sesion-entrenamiento" className="strategy-link"><ClipboardList size={18} /><strong>Sesión</strong><span>Cargar, editar o cerrar sesión.</span></Link>
            <Link href="/carga" className="strategy-link"><BarChart3 size={18} /><strong>Carga</strong><span>RPE, minutos y GPS U20.</span></Link>
            <Link href="/wellness" className="strategy-link"><HeartPulse size={18} /><strong>Wellness</strong><span>Estado diario.</span></Link>
            <Link href="/alertas" className="strategy-link"><Target size={18} /><strong>Alertas</strong><span>Prioridades del staff.</span></Link>
            <Link href="/informes/jugador-periodo" className="strategy-link"><Zap size={18} /><strong>Informes</strong><span>Reportes para staff.</span></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
