'use client';

import Link from 'next/link';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { PlayerStatusBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { PlayerStatus } from '@/lib/types';

const statuses: PlayerStatus[] = ['Disponible', 'Molestia', 'Readaptación', 'Lesionado'];

export default function JugadoresPage() {
  const { data, filters, deletePlayer, updatePlayer } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const players = data.players.filter((player) =>
    (filters.playerId === 'all' || player.id === filters.playerId) &&
    ((master ? filters.category : session.category) === 'all' || player.category === (master ? filters.category : session.category)) &&
    (filters.position === 'all' || player.position === filters.position) &&
    (filters.status === 'all' || player.status === filters.status)
  );

  return (
    <div className="grid">
      <AppHero title="Gestión de jugadores" subtitle="Administra el plantel, cambia el estado actual y registra novedades físicas." />
      <GlobalFiltersBar />
      <div className="grid grid-2">
        {players.map((player) => (
          <div className="card player-card" key={player.id}>
            <img src={player.photo} alt={player.name} width={90} height={90} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 18 }} />
            <div>
              <h3 style={{ margin: 0 }}>{player.name}</h3>
              <div className="player-meta">
                <span>{player.position}</span>
                <span>{player.category ?? 'Sub20'}</span>
                <span>{player.age} años</span>
                <span>{player.height} cm</span>
                <span>{player.weight} kg</span>
              </div>
              <div className="btn-row" style={{ marginTop: 10, alignItems: 'center' }}>
                <PlayerStatusBadge status={player.status} />
                {!master ? <select className="select" value={player.status} style={{ maxWidth: 180 }} onChange={(e) => updatePlayer({ ...player, status: e.target.value as PlayerStatus })}>
                  {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select> : null}
              </div>
              {player.status !== 'Disponible' ? <div className="muted-line" style={{ marginTop: 8 }}>{player.injuryArea || 'Sin zona'} · {player.injuryType || 'Sin detalle'}</div> : null}
            </div>
            <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
              <Link className="btn secondary" href={`/jugadores/${player.id}`}>Ver perfil</Link>
              {!master ? <button
                type="button"
                className="btn danger"
                onClick={() => {
                  const confirmed = window.confirm(`¿Deseas eliminar a ${player.name}? Esta acción borrará sus registros relacionados.`);
                  if (confirmed) deletePlayer(player.id);
                }}
              >
                Eliminar
              </button> : null}
            </div>
          </div>
        ))}
      </div>
      {!players.length ? <div className="empty">No hay jugadores con los filtros actuales.</div> : null}
    </div>
  );
}
