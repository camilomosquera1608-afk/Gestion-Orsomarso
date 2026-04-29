'use client';

import Link from 'next/link';
import { ClipboardList, HeartPulse, PlusCircle, ShieldCheck, Trophy } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { PlayerStatusBadge, WellnessBadge } from '@/components/status-badge';
import { CompactInfoList, EmptyState, SectionHeader } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel, calcAge } from '@/lib/labels';
import { PlayerStatus } from '@/lib/types';
import { averageWellness, calculateInternalLoad } from '@/lib/utils';

const statuses: PlayerStatus[] = ['Disponible', 'Molestia', 'Readaptación', 'Lesionado'];

export default function JugadoresPage() {
  const { data, filters, deletePlayer, updatePlayer } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;
  const players = data.players.filter((player) =>
    (filters.playerId === 'all' || player.id === filters.playerId) &&
    (activeCategory === 'all' || player.category === activeCategory) &&
    (filters.position === 'all' || player.position === filters.position) &&
    (filters.status === 'all' || player.status === filters.status),
  );
  const statusSummary = {
    disponibles: players.filter((player) => player.status === 'Disponible').length,
    molestia: players.filter((player) => player.status === 'Molestia').length,
    readaptacion: players.filter((player) => player.status === 'Readaptación').length,
    lesionados: players.filter((player) => player.status === 'Lesionado').length,
  };

  return (
    <div className="grid">
      <AppHero title="Plantilla deportiva" subtitle="Gestión del plantel, disponibilidad, últimos registros y acceso a ficha individual." />
      <GlobalFiltersBar />

      <div className="toolbar card">
        <div>
          <span className="section-eyebrow">Control de plantilla</span>
          <h3 style={{ margin: 0 }}>Seguimiento individual del jugador</h3>
          <div className="muted-line">Cada card abre una ficha con carga, wellness, competencia, valoraciones e historial médico.</div>
        </div>
        <div className="btn-row">
          {!master ? <Link className="btn" href="/registro"><PlusCircle size={16} />Agregar jugador</Link> : null}
          <Link className="btn secondary" href="/diario">Parte diario</Link>
        </div>
      </div>

      <div className="grid grid-4">
        <KpiCard label="Jugadores visibles" value={String(players.length)} tone="blue" trend="Plantilla filtrada" icon={<ShieldCheck size={18} />} />
        <KpiCard label="Disponibles" value={String(statusSummary.disponibles)} tone="green" trend="Habilitados" />
        <KpiCard label="Molestia/Readaptación" value={String(statusSummary.molestia + statusSummary.readaptacion)} tone="amber" trend="Seguimiento especial" icon={<HeartPulse size={18} />} />
        <KpiCard label="Lesionados" value={String(statusSummary.lesionados)} tone="red" trend="Área médica" />
      </div>

      <div className="card">
        <SectionHeader eyebrow="Roster" title="Plantel filtrado" subtitle="Vista tipo club con últimas señales operativas." />
        <div className="grid grid-2 player-roster-grid">
          {players.map((player) => {
            const latestWellness = data.wellness.filter((row) => row.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date))[0];
            const latestInternal = data.internalLoads.filter((row) => row.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date))[0];
            const latestExternal = data.externalLoads.filter((row) => row.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date))[0];
            const recentCompetition = data.competitionRecords.filter((row) => row.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date))[0];
            const wellnessValue = averageWellness(latestWellness);
            const internalLoad = latestInternal ? calculateInternalLoad(latestInternal) : 0;
            return (
              <div className="card player-card" key={player.id}>
                <img src={player.photo || '/orsomarso-crest.jpg'} alt={player.name} />
                <div>
                  <h3 style={{ margin: 0 }}>{player.name}</h3>
                  <div className="muted-line">{player.position} · {categoryLabel(player.category)} · {calcAge(player.birthDate) ?? player.age} años</div>
                  <div className="btn-row" style={{ marginTop: 10, alignItems: 'center' }}>
                    <PlayerStatusBadge status={player.status} />
                    {wellnessValue ? <WellnessBadge value={wellnessValue} /> : <span className="status-badge ui-tone-neutral">Sin wellness</span>}
                  </div>
                  <div className="roster-stat-row">
                    <span><ClipboardList size={13} /> Carga {internalLoad}</span>
                    <span>MIN {latestExternal?.min ?? 0}</span>
                    <span>RPE {latestExternal?.rpe ?? '-'}</span>
                    <span><Trophy size={13} /> {recentCompetition ? `${recentCompetition.minutesPlayed} min` : 'Sin partido'}</span>
                  </div>
                  {player.status !== 'Disponible' ? <div className="muted-line" style={{ marginTop: 8 }}>{player.injuryArea || 'Zona sin definir'} · {player.injuryType || 'Sin detalle médico'}</div> : null}
                  <div style={{ marginTop: 12 }}>
                    <CompactInfoList items={[
                      { label: 'Último wellness', value: latestWellness?.date ?? 'Sin registro' },
                      { label: 'Última sesión', value: latestExternal?.date ?? 'Sin registro' },
                      { label: 'Último partido', value: recentCompetition?.date ?? 'Sin registro' },
                    ]} />
                  </div>
                </div>
                <div className="roster-actions">
                  <Link className="btn secondary" href={`/jugadores/${player.id}`}>Abrir ficha</Link>
                  {!master ? (
                    <>
                      <select className="select" value={player.status} style={{ maxWidth: 190 }} onChange={(e) => updatePlayer({ ...player, status: e.target.value as PlayerStatus })}>
                        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <button
                        type="button"
                        className="btn danger"
                        onClick={() => {
                          const confirmed = window.confirm(`¿Deseas eliminar a ${player.name}? Esta acción borrará sus registros relacionados.`);
                          if (confirmed) deletePlayer(player.id);
                        }}
                      >
                        Eliminar
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {!players.length ? <EmptyState title="No hay jugadores con los filtros actuales" text="Ajusta los filtros o agrega un jugador para iniciar seguimiento de plantilla." action={!master ? <Link className="btn" href="/registro">Agregar jugador</Link> : undefined} /> : null}
      </div>
    </div>
  );
}
