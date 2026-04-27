import { categoryLabel } from '@/lib/labels';
'use client';

import { ClubCategory, MovementType, Position, PlayerStatus } from '@/lib/types';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';

const allPositions: Position[] = ['Portero', 'Defensa central', 'Lateral', 'Mediocampista', 'Extremo', 'Delantero'];
const allStatuses: PlayerStatus[] = ['Disponible', 'Lesionado', 'Molestia', 'Readaptación'];
const allCategories: ClubCategory[] = ['Sub15', 'Sub17', 'Sub20'];
const movementOptions: Array<{ value: MovementType; label: string }> = [
  { value: 'base', label: 'Sin movimiento' },
  { value: 'subio_a_entrenar', label: 'Subió a entrenar' },
  { value: 'bajo_a_entrenar', label: 'Bajó a entrenar' },
  { value: 'subio_a_competir', label: 'Subió a competir' },
  { value: 'bajo_a_competir', label: 'Bajó a competir' },
];

export const GlobalFiltersBar = () => {
  const { data, filters, setFilters, resetFilters } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const allowedCategory = master ? filters.category : session.category;
  const microcycleNumber = Number(String(filters.microcycleId).replace('mc-', '')) || 1;
  const currentMicrocycle = data.microcycles.find((m) => m.id === filters.microcycleId);
  const filteredPlayers = data.players.filter((player) => allowedCategory === 'all' || player.category === allowedCategory);

  return (
    <div className="filters filters-wide">
      <div className="field">
        <label>Fecha</label>
        <input className="input" type="date" value={filters.date} onChange={(e) => setFilters({ date: e.target.value })} />
      </div>

      <div className="field">
        <label>Microciclo</label>
        <input
          className="input"
          type="number"
          min="1"
          max="51"
          value={microcycleNumber}
          onChange={(e) => {
            const next = Math.max(1, Math.min(51, Number(e.target.value) || 1));
            setFilters({ microcycleId: `mc-${next}` });
          }}
        />
        {currentMicrocycle ? <small className="field-help">{currentMicrocycle.startDate} · {currentMicrocycle.endDate}</small> : null}
      </div>

      <div className="field">
        <label>Número de sesión</label>
        <input className="input" type="number" min="1" value={filters.sessionNumber} onChange={(e) => setFilters({ sessionNumber: Number(e.target.value) || 1 })} />
      </div>

      <div className="field">
        <label>Categoría base</label>
        {master ? (
          <select className="select" value={filters.category} onChange={(e) => setFilters({ category: e.target.value, playerId: 'all' })}>
            <option value="all">Todas las categorías</option>
            {allCategories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
          </select>
        ) : (
          <input className="input" value={categoryLabel(session.category)} readOnly />
        )}
      </div>

      <div className="field">
        <label>Jugador</label>
        <select className="select" value={filters.playerId} onChange={(e) => setFilters({ playerId: e.target.value })}>
          <option value="all">Todos los jugadores</option>
          {filteredPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="field">
        <label>Posición</label>
        <select className="select" value={filters.position} onChange={(e) => setFilters({ position: e.target.value })}>
          <option value="all">Todas las posiciones</option>
          {allPositions.map((position) => <option key={position} value={position}>{position}</option>)}
        </select>
      </div>

      <div className="field">
        <label>Estado</label>
        <select className="select" value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}>
          <option value="all">Todos los estados</option>
          {allStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>

      {master ? (
        <>
          <div className="field">
            <label>Categoría participación</label>
            <select className="select" value={filters.actingCategory} onChange={(e) => setFilters({ actingCategory: e.target.value })}>
              <option value="all">Todas</option>
              {allCategories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Movimiento</label>
            <select className="select" value={filters.movementType} onChange={(e) => setFilters({ movementType: e.target.value })}>
              <option value="all">Todos</option>
              {movementOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </>
      ) : null}

      <div className="field" style={{ alignSelf: 'end' }}>
        <button className="btn secondary" onClick={resetFilters}>Resetear filtros</button>
      </div>
    </div>
  );
};
