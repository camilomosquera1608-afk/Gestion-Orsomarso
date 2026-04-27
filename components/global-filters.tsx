'use client';

import { usePathname } from 'next/navigation';
import { categoryLabel } from '@/lib/labels';
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

const getFilterLayout = (pathname: string) => {
  if (pathname === '/') return { date: false, microcycle: false, sessionNumber: false, category: true, player: true, position: true, status: true, acting: false, movement: false };
  if (pathname.startsWith('/diario')) return { date: true, microcycle: true, sessionNumber: false, category: true, player: true, position: true, status: true, acting: false, movement: false };
  if (pathname.startsWith('/microciclo')) return { date: false, microcycle: true, sessionNumber: false, category: true, player: true, position: true, status: true, acting: false, movement: false };
  if (pathname.startsWith('/sesion-entrenamiento')) return { date: true, microcycle: true, sessionNumber: true, category: true, player: true, position: true, status: true, acting: false, movement: false };
  if (pathname.startsWith('/competencia')) return { date: true, microcycle: false, sessionNumber: false, category: true, player: true, position: true, status: true, acting: false, movement: false };
  if (pathname.startsWith('/informes')) return { date: false, microcycle: false, sessionNumber: false, category: true, player: true, position: false, status: false, acting: true, movement: true };
  if (pathname.startsWith('/ranking')) return { date: false, microcycle: false, sessionNumber: false, category: true, player: false, position: false, status: false, acting: false, movement: false };
  if (pathname.startsWith('/jugadores')) return { date: false, microcycle: false, sessionNumber: false, category: true, player: true, position: true, status: true, acting: false, movement: false };
  if (pathname.startsWith('/registro')) return { date: false, microcycle: false, sessionNumber: false, category: false, player: false, position: false, status: false, acting: false, movement: false };
  return { date: true, microcycle: false, sessionNumber: false, category: true, player: true, position: true, status: true, acting: false, movement: false };
};

export const GlobalFiltersBar = () => {
  const { data, filters, setFilters, resetFilters } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const pathname = usePathname();
  const layout = getFilterLayout(pathname);
  const allowedCategory = master ? filters.category : session.category;
  const allMicrocycles = Array.from({ length: 52 }, (_, index) => {
    const number = index + 1;
    const existing = data.microcycles.find((m) => m.id === `mc-${number}`);
    return existing ?? { id: `mc-${number}`, name: `Microciclo ${number}`, startDate: '-', endDate: '-' };
  });
  const currentMicrocycle = allMicrocycles.find((m) => m.id === filters.microcycleId) ?? allMicrocycles[0];
  const filteredPlayers = data.players.filter((player) => allowedCategory === 'all' || player.category === allowedCategory);

  const activeFields = [
    layout.date,
    layout.microcycle,
    layout.sessionNumber,
    layout.category,
    layout.player,
    layout.position,
    layout.status,
    master && layout.acting,
    master && layout.movement,
  ].filter(Boolean).length;

  if (activeFields === 0) return null;

  return (
    <div className="filters filters-wide">
      {layout.date ? (
        <div className="field">
          <label>Fecha</label>
          <input className="input" type="date" value={filters.date} onChange={(e) => setFilters({ date: e.target.value })} />
        </div>
      ) : null}

      {layout.microcycle ? (
        <div className="field">
          <label>Microciclo</label>
          <select className="select" value={filters.microcycleId} onChange={(e) => setFilters({ microcycleId: e.target.value })}>
            {allMicrocycles.map((microcycle) => (
              <option key={microcycle.id} value={microcycle.id}>
                {microcycle.name}
              </option>
            ))}
          </select>
          {currentMicrocycle ? <small className="field-help">{currentMicrocycle.startDate} · {currentMicrocycle.endDate}</small> : null}
        </div>
      ) : null}

      {layout.sessionNumber ? (
        <div className="field">
          <label>Número de sesión</label>
          <input className="input" type="number" min="1" value={filters.sessionNumber} onChange={(e) => setFilters({ sessionNumber: Number(e.target.value) || 1 })} />
        </div>
      ) : null}

      {layout.category ? (
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
      ) : null}

      {layout.player ? (
        <div className="field">
          <label>Jugador</label>
          <select className="select" value={filters.playerId} onChange={(e) => setFilters({ playerId: e.target.value })}>
            <option value="all">Todos los jugadores</option>
            {filteredPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      ) : null}

      {layout.position ? (
        <div className="field">
          <label>Posición</label>
          <select className="select" value={filters.position} onChange={(e) => setFilters({ position: e.target.value })}>
            <option value="all">Todas las posiciones</option>
            {allPositions.map((position) => <option key={position} value={position}>{position}</option>)}
          </select>
        </div>
      ) : null}

      {layout.status ? (
        <div className="field">
          <label>Estado</label>
          <select className="select" value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}>
            <option value="all">Todos los estados</option>
            {allStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
      ) : null}

      {master && layout.acting ? (
        <div className="field">
          <label>Categoría participación</label>
          <select className="select" value={filters.actingCategory} onChange={(e) => setFilters({ actingCategory: e.target.value })}>
            <option value="all">Todas</option>
            {allCategories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
          </select>
        </div>
      ) : null}

      {master && layout.movement ? (
        <div className="field">
          <label>Movimiento</label>
          <select className="select" value={filters.movementType} onChange={(e) => setFilters({ movementType: e.target.value })}>
            <option value="all">Todos</option>
            {movementOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      ) : null}

      <div className="field" style={{ alignSelf: 'end' }}>
        <button className="btn secondary" onClick={resetFilters}>Resetear filtros</button>
      </div>
    </div>
  );
};
