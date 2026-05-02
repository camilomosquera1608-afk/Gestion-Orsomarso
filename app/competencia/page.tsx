'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { CompetitionReportTemplate } from '@/components/competition-report';
import { EmptyState, MatchCard, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { KpiCard } from '@/components/kpi-card';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { calculateMatchResult, formatMatchScore, isGoalkeeper } from '@/lib/performance-helpers';
import { buildMatchCenterStats } from '@/lib/operational-helpers';
import { buildCompetitionReportData } from '@/lib/competition-report';
import { findDuplicateMatch } from '@/lib/operational-validation';
import { ClubCategory, MovementType, CompetitionMedicalStatus, CompetitionPlayerRole, CompetitionRecord, CompetitionVenue } from '@/lib/types';

const categories: ClubCategory[] = ['Sub15', 'Sub17', 'Sub20'];
const starterOptions: CompetitionPlayerRole[] = ['Titular', 'Suplente'];
const medicalOptions: CompetitionMedicalStatus[] = ['Sin lesión', 'Lesionado'];

type MatchDraft = {
  id: string;
  opponent: string;
  customOpponent: string;
  competitionName: string;
  date: string;
  venue: CompetitionVenue;
  goalsFor: string;
  goalsAgainst: string;
  observation: string;
};

type MatchPlayerDraftMap = Record<string, PlayerDraft>;

type PlayerDraft = {
  playerId: string;
  minutesPlayed: string;
  goals: string;
  assists: string;
  goalsConceded: string;
  goalsPrevented: string;
  yellowCards: string;
  redCards: string;
  startingRole: CompetitionPlayerRole;
  medicalStatus: CompetitionMedicalStatus;
  medicalObservation: string;
};

const emptyPlayerDraft = (playerId = ''): PlayerDraft => ({
  playerId,
  minutesPlayed: '',
  goals: '',
  assists: '',
  goalsConceded: '',
  goalsPrevented: '',
  yellowCards: '',
  redCards: '',
  startingRole: 'Titular',
  medicalStatus: 'Sin lesión',
  medicalObservation: '',
});

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isNegative = (value: string) => value.trim() !== '' && toNumber(value) < 0;
const displayNumber = (value?: number) => (value && value > 0 ? String(value) : '');
const displayOptionalNumber = (value?: number) => (typeof value === 'number' ? String(value) : '');

export default function CompetenciaPage() {
  const { data, filters, addCompetitionRecord, updateCompetitionRecord, deleteCompetitionRecord, upsertCompetitionMatchSummary, deleteCompetitionMatchSummary } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = (master ? (filters.category === 'all' ? 'Sub20' : filters.category) : session.category) as ClubCategory;
  const [message, setMessage] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [editingRecordId, setEditingRecordId] = useState('');
  const [sourceCategory, setSourceCategory] = useState<ClubCategory>(activeCategory);
  const [matchDraft, setMatchDraft] = useState<MatchDraft>({ id: '', opponent: '', customOpponent: '', competitionName: 'Partido oficial', date: filters.date, venue: 'Local', goalsFor: '', goalsAgainst: '', observation: '' });
  const [playerDraft, setPlayerDraft] = useState<PlayerDraft>(emptyPlayerDraft());
  const [showGroupReport, setShowGroupReport] = useState(false);
  const [isSavingMatch, setIsSavingMatch] = useState(false);
  const [isSavingPlayer, setIsSavingPlayer] = useState(false);
  const [editingMatchPlayers, setEditingMatchPlayers] = useState(false);
  const [matchPlayerDrafts, setMatchPlayerDrafts] = useState<MatchPlayerDraftMap>({});
  const [isSavingMatchPlayers, setIsSavingMatchPlayers] = useState(false);

  const playersBySource = useMemo(() => data.players.filter((player) => player.category === sourceCategory), [data.players, sourceCategory]);
  // Fix #5: rivals known from existing match history — no more hardcoded list
  const knownRivalsFromHistory = useMemo(() => {
    const all = data.competitionMatchSummaries
      .filter((m) => m.category === activeCategory)
      .map((m) => m.opponent.trim())
      .filter(Boolean);
    return [...new Set(all)].sort();
  }, [data.competitionMatchSummaries, activeCategory]);

  const matchSummaries = useMemo(
    () => data.competitionMatchSummaries.filter((match) => match.category === activeCategory).sort((a, b) => b.date.localeCompare(a.date)),
    [data.competitionMatchSummaries, activeCategory],
  );
  const selectedMatch = matchSummaries.find((match) => match.id === selectedMatchId) ?? matchSummaries[0];
  const matchRecords = useMemo(
    () => data.competitionRecords
      .filter((record) => selectedMatch && (record.matchId === selectedMatch.id || (!record.matchId && record.date === selectedMatch.date && record.opponent === selectedMatch.opponent)))
      .sort((a, b) => (data.players.find((player) => player.id === a.playerId)?.name ?? '').localeCompare(data.players.find((player) => player.id === b.playerId)?.name ?? '')),
    [data.competitionRecords, data.players, selectedMatch],
  );
  useEffect(() => {
    const nextDrafts: MatchPlayerDraftMap = {};
    matchRecords.forEach((record) => {
      nextDrafts[record.id] = {
        playerId: record.playerId,
        minutesPlayed: displayNumber(record.minutesPlayed),
        goals: displayNumber(record.goals),
        assists: displayNumber(record.assists),
        goalsConceded: displayNumber(record.goalsConceded),
        goalsPrevented: displayNumber(record.goalsPrevented),
        yellowCards: displayNumber(record.yellowCards),
        redCards: displayNumber(record.redCards),
        startingRole: record.startingRole ?? 'Titular',
        medicalStatus: record.medicalStatus ?? (record.postCompetitionStatus === 'Lesionado' ? 'Lesionado' : 'Sin lesión'),
        medicalObservation: record.medicalObservation ?? '',
      };
    });
    setMatchPlayerDrafts(nextDrafts);
  }, [selectedMatch?.id, matchRecords]);

  const allCategoryRecords = useMemo(
    () => data.competitionRecords.filter((record) => (record.category ?? record.actingCategory ?? activeCategory) === activeCategory),
    [data.competitionRecords, activeCategory],
  );

  const availableOpponents = useMemo(() => Array.from(new Set([
    ...knownRivalsFromHistory,
    ...matchSummaries.map((match) => match.opponent).filter(Boolean),
    ...allCategoryRecords.map((record) => record.opponent).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b)), [activeCategory, matchSummaries, allCategoryRecords]);

  const currentPlayer = data.players.find((player) => player.id === playerDraft.playerId) ?? playersBySource[0];
  const goalkeeper = isGoalkeeper(currentPlayer);
  const editingRecord = editingRecordId ? data.competitionRecords.find((record) => record.id === editingRecordId) : undefined;

  const medicalAlerts = matchRecords.filter((record) => (record.medicalStatus ?? (record.postCompetitionStatus === 'Lesionado' ? 'Lesionado' : 'Sin lesión')) === 'Lesionado');
  const matchCenterStats = buildMatchCenterStats(matchRecords, data.players);
  const competitionReport = selectedMatch
    ? buildCompetitionReportData({ data, match: selectedMatch, records: matchRecords, activeCategory })
    : undefined;

  useEffect(() => {
    setSourceCategory(activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    if (!selectedMatchId && matchSummaries[0]) setSelectedMatchId(matchSummaries[0].id);
    if (selectedMatchId && !matchSummaries.some((match) => match.id === selectedMatchId)) setSelectedMatchId(matchSummaries[0]?.id ?? '');
  }, [matchSummaries, selectedMatchId]);

  useEffect(() => {
    if (!playerDraft.playerId || !playersBySource.some((player) => player.id === playerDraft.playerId)) {
      setPlayerDraft((prev) => ({ ...prev, playerId: playersBySource[0]?.id ?? '' }));
    }
  }, [playersBySource, playerDraft.playerId]);

  const resetMatchDraft = () => {
    setMatchDraft({ id: '', opponent: '', customOpponent: '', competitionName: 'Partido oficial', date: filters.date, venue: 'Local', goalsFor: '', goalsAgainst: '', observation: '' });
    setMessage('Listo para crear un partido nuevo.');
  };

  const loadMatchDraft = (matchId: string) => {
    const match = matchSummaries.find((item) => item.id === matchId);
    if (!match) return;
    setSelectedMatchId(match.id);
    setMatchDraft({
      id: match.id,
      opponent: availableOpponents.includes(match.opponent) ? match.opponent : 'new',
      customOpponent: availableOpponents.includes(match.opponent) ? '' : match.opponent,
      date: match.date,
      venue: match.venue ?? 'Local',
      competitionName: match.competitionName ?? 'Partido oficial',
      goalsFor: displayOptionalNumber(match.goalsFor),
      goalsAgainst: displayOptionalNumber(match.goalsAgainst),
      observation: match.observation ?? '',
    });
    setMessage('Editando datos generales del partido.');
  };

  const startEditFullMatch = (matchId: string) => {
    loadMatchDraft(matchId);
    setEditingMatchPlayers(true);
    setMessage('Editando partido completo. Corrige datos generales arriba y datos de jugadores en la planilla.');
  };

  const updateMatchPlayerDraft = (recordId: string, patch: Partial<PlayerDraft>) => {
    setMatchPlayerDrafts((prev) => ({
      ...prev,
      [recordId]: { ...(prev[recordId] ?? emptyPlayerDraft()), ...patch },
    }));
  };

  const saveAllMatchPlayerDrafts = () => {
    if (isSavingMatchPlayers) return;
    if (!selectedMatch) {
      setMessage('Selecciona un partido antes de guardar jugadores.');
      return;
    }
    const duplicatedPlayer = new Set<string>();
    for (const record of matchRecords) {
      const draft = matchPlayerDrafts[record.id];
      if (!draft) continue;
      if (duplicatedPlayer.has(draft.playerId)) {
        setMessage('Hay un jugador duplicado en la planilla del partido.');
        return;
      }
      duplicatedPlayer.add(draft.playerId);
      const numberFields = [draft.minutesPlayed, draft.yellowCards, draft.redCards, draft.goals, draft.assists, draft.goalsConceded, draft.goalsPrevented];
      if (numberFields.some(isNegative)) {
        setMessage('Minutos, goles, asistencias y tarjetas no pueden ser negativos.');
        return;
      }
      if (toNumber(draft.minutesPlayed) > 120) {
        setMessage('Los minutos por jugador no pueden superar 120.');
        return;
      }
      if (draft.redCards.trim() && toNumber(draft.redCards) > 1) {
        setMessage('La tarjeta roja debe ser 0 o 1.');
        return;
      }
      if (draft.medicalStatus === 'Lesionado' && !draft.medicalObservation.trim()) {
        setMessage('Si un jugador está lesionado, agrega una observación médica breve.');
        return;
      }
    }

    setIsSavingMatchPlayers(true);
    matchRecords.forEach((record) => {
      const draft = matchPlayerDrafts[record.id];
      if (!draft) return;
      const player = data.players.find((item) => item.id === draft.playerId);
      const recordGoalkeeper = isGoalkeeper(player);
      updateCompetitionRecord({
        ...record,
        playerId: draft.playerId,
        minutesPlayed: toNumber(draft.minutesPlayed),
        goals: recordGoalkeeper ? 0 : toNumber(draft.goals),
        assists: recordGoalkeeper ? 0 : toNumber(draft.assists),
        goalsConceded: recordGoalkeeper ? toNumber(draft.goalsConceded) : 0,
        goalsPrevented: recordGoalkeeper ? toNumber(draft.goalsPrevented) : 0,
        yellowCards: toNumber(draft.yellowCards),
        redCards: toNumber(draft.redCards),
        startingRole: draft.startingRole,
        medicalStatus: draft.medicalStatus,
        medicalObservation: draft.medicalStatus === 'Lesionado' ? draft.medicalObservation.trim() : '',
        postCompetitionStatus: draft.medicalStatus === 'Lesionado' ? 'Lesionado' : 'Disponible',
      });
    });
    setIsSavingMatchPlayers(false);
    setEditingMatchPlayers(false);
    setMessage('Partido y jugadores actualizados correctamente.');
  };

  const saveMatch = () => {
    const opponent = (matchDraft.opponent === 'new' ? matchDraft.customOpponent : matchDraft.opponent).trim();
    const goalsFor = toNumber(matchDraft.goalsFor);
    const goalsAgainst = toNumber(matchDraft.goalsAgainst);

    if (!opponent) {
      setMessage('No puedes guardar un partido sin rival.');
      return;
    }
    if (!matchDraft.date) {
      setMessage('No puedes guardar un partido sin fecha.');
      return;
    }
    if ([matchDraft.goalsFor, matchDraft.goalsAgainst].some(isNegative)) {
      setMessage('El resultado no puede tener goles negativos.');
      return;
    }

    const duplicateMatch = findDuplicateMatch(data.competitionMatchSummaries, { id: matchDraft.id || undefined, date: matchDraft.date, category: activeCategory, opponent });
    if (duplicateMatch) {
      setMessage('Ya existe un partido de esta categoría contra ese rival en esta fecha. Edita el partido existente.');
      return;
    }

    if (isSavingMatch) return;
    setIsSavingMatch(true);

    const id = matchDraft.id || crypto.randomUUID();
    const resultType = calculateMatchResult(goalsFor, goalsAgainst);
    upsertCompetitionMatchSummary({
      id,
      date: matchDraft.date,
      category: activeCategory,
      competitionName: matchDraft.competitionName.trim() || 'Partido oficial',
      opponent,
      venue: matchDraft.venue,
      goalsFor,
      goalsAgainst,
      resultType,
      result: `${goalsFor}-${goalsAgainst}`,
      observation: matchDraft.observation.trim(),
      status: selectedMatch?.id === id ? selectedMatch.status ?? 'Borrador' : 'Borrador',
    });
    setSelectedMatchId(id);
    setIsSavingMatch(false);
    setMatchDraft((prev) => ({ ...prev, id, opponent: availableOpponents.includes(opponent) ? opponent : 'new', customOpponent: availableOpponents.includes(opponent) ? '' : opponent }));
    setMessage(`Partido guardado: ${opponent} · ${resultType}. Ahora puedes cargar jugadores.`);
  };

  const editPlayerRecord = (record: CompetitionRecord) => {
    const player = data.players.find((item) => item.id === record.playerId);
    setSourceCategory((player?.category ?? activeCategory) as ClubCategory);
    setEditingRecordId(record.id);
    setPlayerDraft({
      playerId: record.playerId,
      minutesPlayed: displayNumber(record.minutesPlayed),
      goals: displayNumber(record.goals),
      assists: displayNumber(record.assists),
      goalsConceded: displayNumber(record.goalsConceded),
      goalsPrevented: displayNumber(record.goalsPrevented),
      yellowCards: displayNumber(record.yellowCards),
      redCards: displayNumber(record.redCards),
      startingRole: record.startingRole ?? 'Titular',
      medicalStatus: record.medicalStatus ?? (record.postCompetitionStatus === 'Lesionado' ? 'Lesionado' : 'Sin lesión'),
      medicalObservation: record.medicalObservation ?? '',
    });
    setMessage('Editando jugador del partido.');
  };

  const resetPlayerDraft = () => {
    setEditingRecordId('');
    setPlayerDraft(emptyPlayerDraft(playersBySource[0]?.id ?? ''));
  };

  const savePlayerRecord = () => {
    if (!selectedMatch) {
      setMessage('Primero debes crear o seleccionar un partido.');
      return;
    }
    const player = data.players.find((item) => item.id === playerDraft.playerId);
    if (!player) {
      setMessage('Debes seleccionar un jugador válido.');
      return;
    }
    const numberFields = [playerDraft.minutesPlayed, playerDraft.yellowCards, playerDraft.redCards, playerDraft.goals, playerDraft.assists, playerDraft.goalsConceded, playerDraft.goalsPrevented];
    if (numberFields.some(isNegative)) {
      setMessage('Minutos, goles, asistencias y tarjetas no pueden ser negativos.');
      return;
    }
    if (toNumber(playerDraft.minutesPlayed) > 120) {
      setMessage('Los minutos por jugador no pueden superar 120.');
      return;
    }
    if (playerDraft.redCards.trim() && toNumber(playerDraft.redCards) > 1) {
      setMessage('La tarjeta roja debe ser 0 o 1.');
      return;
    }
    if (playerDraft.medicalStatus === 'Lesionado' && !playerDraft.medicalObservation.trim()) {
      setMessage('Si el jugador está lesionado, debes agregar una observación médica breve.');
      return;
    }
    const duplicated = matchRecords.find((record) => record.playerId === player.id && record.id !== editingRecordId);
    if (duplicated) {
      setMessage('Ese jugador ya está cargado en este partido.');
      return;
    }

    if (isSavingPlayer) return;
    setIsSavingPlayer(true);

    const goalkeeperRecord = isGoalkeeper(player);
    const movementType = (sourceCategory === activeCategory ? 'base' : 'subio_a_competir') as MovementType;
    const baseRecord = {
      id: editingRecordId || crypto.randomUUID(),
      matchId: selectedMatch.id,
      playerId: player.id,
      date: selectedMatch.date,
      opponent: selectedMatch.opponent,
      competitionName: selectedMatch.competitionName,
      minutesPlayed: toNumber(playerDraft.minutesPlayed),
      yellowCards: toNumber(playerDraft.yellowCards),
      redCards: toNumber(playerDraft.redCards),
      startingRole: playerDraft.startingRole,
      category: activeCategory,
      baseCategory: player.category ?? sourceCategory,
      actingCategory: activeCategory,
      movementType,
      movementModule: 'competencia' as const,
      loggedBy: session.displayName,
      postCompetitionStatus: playerDraft.medicalStatus === 'Lesionado' ? 'Lesionado' : 'Sin novedad',
      medicalStatus: playerDraft.medicalStatus,
      medicalObservation: playerDraft.medicalStatus === 'Lesionado' ? playerDraft.medicalObservation.trim() : '',
    };
    const record: CompetitionRecord = goalkeeperRecord
      ? { ...baseRecord, goals: 0, assists: 0, goalsConceded: toNumber(playerDraft.goalsConceded), goalsPrevented: toNumber(playerDraft.goalsPrevented) }
      : { ...baseRecord, goals: toNumber(playerDraft.goals), assists: toNumber(playerDraft.assists), goalsConceded: undefined, goalsPrevented: undefined };

    if (editingRecord) updateCompetitionRecord(record);
    else addCompetitionRecord(record);
    setIsSavingPlayer(false);
    resetPlayerDraft();
    setMessage('Jugador guardado correctamente dentro del partido.');
  };

  const removeMatch = (matchId: string) => {
    deleteCompetitionMatchSummary(matchId);
    if (selectedMatchId === matchId) setSelectedMatchId('');
    setMessage('Partido eliminado con sus jugadores asociados.');
  };

  const updateMatchStatus = (status: 'Borrador' | 'En revisión' | 'Cerrada' | 'Reabierta') => {
    if (!selectedMatch) return;
    upsertCompetitionMatchSummary({ ...selectedMatch, status });
    setMessage(status === 'Cerrada' ? 'Partido cerrado. Reabre solo si necesitas corregir datos.' : 'Partido reabierto para correcciones.');
  };

  return (
    <div className="grid competition-page-root">
      <div className="competition-operational no-print">
      <AppHero heroClass="hero-competencia" title="Ficha profesional de partido" subtitle={`Competencia · ${categoryLabel(activeCategory)}`} />

      <div className="grid grid-4">
        <KpiCard label="Partidos registrados" value={String(matchSummaries.length)} tone="blue" trend="Historial activo" />
        <KpiCard label="Jugadores del partido" value={String(matchRecords.length)} tone="green" trend="Planilla cargada" />
        <KpiCard label="Titulares" value={String(matchCenterStats.starters)} tone="dark" trend="Once inicial" />
        <KpiCard label="Alertas médicas" value={String(medicalAlerts.length)} tone={medicalAlerts.length ? "red" : "green"} trend="Incidencias" />
      </div>

      {message ? <div className="card"><strong>{message}</strong></div> : null}

      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <span className="section-eyebrow">Paso 1</span><h3 style={{ margin: 0 }}>Datos generales del partido</h3>
            <div className="summary-chip" style={{ marginTop: 8 }}>Rival · Fecha · Local/Visitante · Resultado calculado</div>
          </div>
          <div className="btn-row">
            <button type="button" className="btn secondary" onClick={resetMatchDraft}>Nuevo partido</button>
            <button type="button" className="btn secondary" onClick={() => downloadCsv('competencia-partidos.csv', matchSummaries.map((match) => ({ fecha: match.date, categoria: categoryLabel(match.category), rival: match.opponent, condicion: match.venue ?? '', marcador: formatMatchScore(match), resultado: match.resultType ?? '' })))}>Exportar partidos</button>
          </div>
        </div>

        <div className="grid grid-4" style={{ marginTop: 16 }}>
          <div className="field">
            <label>Rival existente</label>
            <select className="select" value={matchDraft.opponent} onChange={(event) => setMatchDraft((prev) => ({ ...prev, opponent: event.target.value }))}>
              <option value="">Selecciona rival</option>
              {availableOpponents.map((name) => <option key={name} value={name}>{name}</option>)}
              <option value="new">Escribir rival nuevo</option>
            </select>
          </div>
          {matchDraft.opponent === 'new' ? (
            <div className="field">
              <label>Nombre del rival nuevo</label>
              <input className="input" value={matchDraft.customOpponent} onChange={(event) => setMatchDraft((prev) => ({ ...prev, customOpponent: event.target.value }))} placeholder="Nombre del rival" />
            </div>
          ) : null}
          <div className="field">
            <label>Fecha</label>
            <input className="input" type="date" value={matchDraft.date} onChange={(event) => setMatchDraft((prev) => ({ ...prev, date: event.target.value }))} />
          </div>
          <div className="field">
            <label>Nombre del torneo / liga</label>
            <input
              className="input"
              value={matchDraft.competitionName}
              onChange={(e) => setMatchDraft((prev) => ({ ...prev, competitionName: e.target.value }))}
              placeholder="Ej. Liga BetPlay, Copa Colombia..."
            />
          </div>
          <div className="field">
            <label>Condición</label>
            <select className="select" value={matchDraft.venue} onChange={(event) => setMatchDraft((prev) => ({ ...prev, venue: event.target.value as CompetitionVenue }))}>
              <option value="Local">Local</option>
              <option value="Visitante">Visitante</option>
            </select>
          </div>
          <div className="field">
            <label>Goles Orsomarso</label>
            <input className="input" min="0" type="number" value={matchDraft.goalsFor} onChange={(event) => setMatchDraft((prev) => ({ ...prev, goalsFor: event.target.value }))} />
          </div>
          <div className="field">
            <label>Goles rival</label>
            <input className="input" min="0" type="number" value={matchDraft.goalsAgainst} onChange={(event) => setMatchDraft((prev) => ({ ...prev, goalsAgainst: event.target.value }))} />
          </div>
          <div className="field">
            <label>Resultado</label>
            <input className="input" readOnly value={calculateMatchResult(toNumber(matchDraft.goalsFor), toNumber(matchDraft.goalsAgainst))} />
          </div>
          <div className="field">
            <label>Observación general</label>
            <input className="input" value={matchDraft.observation} onChange={(event) => setMatchDraft((prev) => ({ ...prev, observation: event.target.value }))} />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn" disabled={isSavingMatch} onClick={saveMatch}>{isSavingMatch ? 'Guardando...' : matchDraft.id ? 'Actualizar partido' : 'Guardar partido'}</button>
        </div>
      </div>

      {selectedMatch ? (
        <MatchCard
          away={selectedMatch.opponent}
          score={formatMatchScore(selectedMatch)}
          meta={`${selectedMatch.date} · ${selectedMatch.venue ?? 'Local'}`}
          result={<StatusBadge text={selectedMatch.resultType ?? 'Sin resultado'} tone={selectedMatch.resultType === 'Victoria' ? 'green' : selectedMatch.resultType === 'Derrota' ? 'red' : 'blue'} />}
          stats={[
            { label: 'Titulares', value: matchCenterStats.starters },
            { label: 'Suplentes', value: matchCenterStats.substitutes },
            { label: 'Porteros', value: matchCenterStats.goalkeepers },
            { label: 'Goles', value: matchCenterStats.goals },
            { label: 'Amarillas', value: matchCenterStats.yellowCards },
            { label: 'Rojas', value: matchCenterStats.redCards },
            { label: 'Lesionados', value: matchCenterStats.medical },
          ]}
        />
      ) : null}

      {matchSummaries.length ? (
        <div className="card">
          <SectionHeader eyebrow="Partido" title="Partido seleccionado" />
          <div className="grid grid-3">
            <div className="field">
              <label>Seleccionar partido</label>
              <select className="select" value={selectedMatch?.id ?? ''} onChange={(event) => setSelectedMatchId(event.target.value)}>
                {matchSummaries.map((match) => <option key={match.id} value={match.id}>{match.date} · {match.venue ?? 'Local'} vs {match.opponent} · {formatMatchScore(match)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Resumen</label>
              <input className="input" readOnly value={selectedMatch ? `${selectedMatch.resultType ?? ''} · ${formatMatchScore(selectedMatch)}` : 'Sin partido'} />
            </div>
            <div className="btn-row" style={{ alignSelf: 'end' }}>
              {selectedMatch ? <button type="button" className="btn secondary" onClick={() => startEditFullMatch(selectedMatch.id)}>Editar partido y jugadores</button> : null}
              {selectedMatch ? <button type="button" className="btn danger" onClick={() => removeMatch(selectedMatch.id)}>Eliminar partido</button> : null}
            </div>
          </div>
        </div>
      ) : <EmptyState title="Aún no hay partidos" text="Crea primero los datos generales del partido y luego carga los jugadores." />}

      {selectedMatch ? (
        <div className="card grid">
          <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <span className="section-eyebrow">Paso 2</span><h3 style={{ margin: 0 }}>Jugadores del partido</h3>
              <div className="summary-chip" style={{ marginTop: 8 }}>{selectedMatch.date} · {selectedMatch.venue ?? 'Local'} vs {selectedMatch.opponent} · {formatMatchScore(selectedMatch)}</div>
            </div>
            <div className="btn-row"><button type="button" className="btn secondary" onClick={() => setEditingMatchPlayers((value) => !value)}>{editingMatchPlayers ? 'Cerrar edición rápida' : 'Editar jugadores cargados'}</button><button type="button" className="btn secondary" onClick={resetPlayerDraft}>Limpiar jugador</button></div>
          </div>

          <div className="grid grid-4">
            <div className="field"><label>Categoría del jugador</label><select className="select" value={sourceCategory} onChange={(event) => setSourceCategory(event.target.value as ClubCategory)}>{categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}</select></div>
            <div className="field"><label>Jugador</label><select className="select" value={playerDraft.playerId} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, playerId: event.target.value }))}>{playersBySource.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.position}</option>)}</select></div>
            <div className="field"><label>Minutos jugados</label><input className="input" min="0" type="number" value={playerDraft.minutesPlayed} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, minutesPlayed: event.target.value }))} /></div>
            <div className="field"><label>Titular / suplente</label><select className="select" value={playerDraft.startingRole} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, startingRole: event.target.value as CompetitionPlayerRole }))}>{starterOptions.map((option) => <option key={option}>{option}</option>)}</select></div>
          </div>

          {goalkeeper ? (
            <div className="grid grid-2">
              <div className="field"><label>Goles encajados</label><input className="input" min="0" type="number" value={playerDraft.goalsConceded} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, goalsConceded: event.target.value }))} /></div>
              <div className="field"><label>Goles evitados</label><input className="input" min="0" type="number" value={playerDraft.goalsPrevented} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, goalsPrevented: event.target.value }))} /></div>
            </div>
          ) : (
            <div className="grid grid-2">
              <div className="field"><label>Goles</label><input className="input" min="0" type="number" value={playerDraft.goals} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, goals: event.target.value }))} /></div>
              <div className="field"><label>Asistencias</label><input className="input" min="0" type="number" value={playerDraft.assists} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, assists: event.target.value }))} /></div>
            </div>
          )}

          <div className="grid grid-4">
            <div className="field"><label>Tarjetas amarillas</label><input className="input" min="0" type="number" value={playerDraft.yellowCards} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, yellowCards: event.target.value }))} /></div>
            <div className="field"><label>Tarjeta roja</label><input className="input" min="0" max="1" type="number" value={playerDraft.redCards} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, redCards: event.target.value }))} /></div>
            <div className="field"><label>Estado médico</label><select className="select" value={playerDraft.medicalStatus} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, medicalStatus: event.target.value as CompetitionMedicalStatus, medicalObservation: event.target.value === 'Lesionado' ? prev.medicalObservation : '' }))}>{medicalOptions.map((option) => <option key={option}>{option}</option>)}</select></div>
            <div className="field"><label>Plantilla</label><input className="input" readOnly value={goalkeeper ? 'Portero' : 'Jugador de campo'} /></div>
          </div>

          {playerDraft.medicalStatus === 'Lesionado' ? (
            <div className="field">
              <label>Observación médica</label>
              <textarea className="input" value={playerDraft.medicalObservation} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, medicalObservation: event.target.value }))} placeholder="Describe la lesión o la novedad médica" />
            </div>
          ) : null}

          <button type="button" className="btn" disabled={isSavingPlayer} onClick={savePlayerRecord}>{isSavingPlayer ? 'Guardando...' : editingRecordId ? 'Actualizar jugador' : 'Agregar jugador al partido'}</button>
        </div>
      ) : null}

      {selectedMatch ? (
        <div className="card">
          <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <span className="section-eyebrow">Informe</span><h3 style={{ margin: 0 }}>Informe profesional de competencia</h3>
              <div className="summary-chip" style={{ marginTop: 8 }}>{selectedMatch.date} · {selectedMatch.venue ?? 'Local'} vs {selectedMatch.opponent} · {selectedMatch.resultType ?? ''} · {selectedMatch.status ?? 'Borrador'}</div>
            </div>
            <div className="btn-row">
              <button type="button" className="btn secondary" onClick={() => updateMatchStatus(selectedMatch.status === 'Cerrada' ? 'Reabierta' : 'Cerrada')}>{selectedMatch.status === 'Cerrada' ? 'Reabrir partido' : 'Cerrar partido'}</button>
              <button type="button" className="btn secondary" onClick={() => setShowGroupReport((value) => !value)}>{showGroupReport ? 'Ocultar vista previa' : 'Ver vista previa profesional'}</button>
              <button type="button" className="btn" onClick={() => window.print()}>Exportar PDF</button>
            </div>
          </div>
          {showGroupReport && competitionReport ? (
            <div style={{ marginTop: 16 }}>
              <CompetitionReportTemplate report={competitionReport} category={activeCategory} compact />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card table-wrap">
        <SectionHeader eyebrow="Planilla" title="Jugadores cargados en el partido" subtitle="Titulares, suplentes, porteros e incidencias médicas." />
        {selectedMatch && matchRecords.length ? (
          <div className="btn-row" style={{ marginBottom: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="btn secondary" onClick={() => setEditingMatchPlayers((value) => !value)}>{editingMatchPlayers ? 'Cerrar edición rápida' : 'Editar jugadores cargados'}</button>
            {editingMatchPlayers ? <button type="button" className="btn" disabled={isSavingMatchPlayers} onClick={saveAllMatchPlayerDrafts}>{isSavingMatchPlayers ? 'Guardando...' : 'Guardar cambios de jugadores'}</button> : null}
          </div>
        ) : null}
        {selectedMatch && matchRecords.length ? (
          <table>
            <thead>
              <tr><th>Jugador</th><th>Posición</th><th>Rol</th><th>MIN</th><th>G/A o Portero</th><th>Tarjetas</th><th>Estado médico</th><th>Observación</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {matchRecords.map((record) => {
                const player = data.players.find((item) => item.id === record.playerId);
                const recordGoalkeeper = isGoalkeeper(player);
                const medicalStatus = record.medicalStatus ?? (record.postCompetitionStatus === 'Lesionado' ? 'Lesionado' : 'Sin lesión');
                const draft = matchPlayerDrafts[record.id] ?? emptyPlayerDraft(record.playerId);
                return (
                  <tr key={record.id}>
                    <td>{player?.name ?? 'Jugador'}</td>
                    <td>{player?.position ?? '-'}</td>
                    <td>{editingMatchPlayers ? <select className="select compact-input" value={draft.startingRole} onChange={(event) => updateMatchPlayerDraft(record.id, { startingRole: event.target.value as CompetitionPlayerRole })}>{starterOptions.map((option) => <option key={option}>{option}</option>)}</select> : record.startingRole ?? '-'}</td>
                    <td>{editingMatchPlayers ? <input className="input compact-input" type="number" min="0" max="120" value={draft.minutesPlayed} onChange={(event) => updateMatchPlayerDraft(record.id, { minutesPlayed: event.target.value })} /> : record.minutesPlayed}</td>
                    <td>{editingMatchPlayers ? (recordGoalkeeper ? <div className="btn-row"><input className="input compact-input" type="number" min="0" placeholder="GE" value={draft.goalsConceded} onChange={(event) => updateMatchPlayerDraft(record.id, { goalsConceded: event.target.value })} /><input className="input compact-input" type="number" min="0" placeholder="EV" value={draft.goalsPrevented} onChange={(event) => updateMatchPlayerDraft(record.id, { goalsPrevented: event.target.value })} /></div> : <div className="btn-row"><input className="input compact-input" type="number" min="0" placeholder="G" value={draft.goals} onChange={(event) => updateMatchPlayerDraft(record.id, { goals: event.target.value })} /><input className="input compact-input" type="number" min="0" placeholder="A" value={draft.assists} onChange={(event) => updateMatchPlayerDraft(record.id, { assists: event.target.value })} /></div>) : recordGoalkeeper ? `GE ${record.goalsConceded ?? 0} · EV ${record.goalsPrevented ?? 0}` : `G ${record.goals ?? 0} · A ${record.assists ?? 0}`}</td>
                    <td>{editingMatchPlayers ? <div className="btn-row"><input className="input compact-input" type="number" min="0" value={draft.yellowCards} onChange={(event) => updateMatchPlayerDraft(record.id, { yellowCards: event.target.value })} /><input className="input compact-input" type="number" min="0" max="1" value={draft.redCards} onChange={(event) => updateMatchPlayerDraft(record.id, { redCards: event.target.value })} /></div> : <>TA {record.yellowCards ?? 0} · TR {record.redCards ?? 0}</>}</td>
                    <td>{editingMatchPlayers ? <select className="select compact-input" value={draft.medicalStatus} onChange={(event) => updateMatchPlayerDraft(record.id, { medicalStatus: event.target.value as CompetitionMedicalStatus })}>{medicalOptions.map((option) => <option key={option}>{option}</option>)}</select> : medicalStatus}</td>
                    <td>{editingMatchPlayers ? <input className="input compact-input" value={draft.medicalObservation} onChange={(event) => updateMatchPlayerDraft(record.id, { medicalObservation: event.target.value })} placeholder="Observación" /> : medicalStatus === 'Lesionado' ? record.medicalObservation || '-' : '-'}</td>
                    <td><div className="btn-row"><button type="button" className="btn secondary" onClick={() => editPlayerRecord(record)}>Editar</button><button type="button" className="btn danger" onClick={() => deleteCompetitionRecord(record.id)}>Eliminar</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState title="Planilla vacía" text="Selecciona o crea un partido y carga jugadores." />}
      </div>

      <div className="card table-wrap">
        <SectionHeader eyebrow="Historial" title="Historial de partidos" subtitle="Registro competitivo por categoría." />
        {matchSummaries.length ? (
          <table>
            <thead><tr><th>Fecha</th><th>Categoría</th><th>Rival</th><th>Condición</th><th>Marcador</th><th>Resultado</th><th>Jugadores</th><th>Acciones</th></tr></thead>
            <tbody>
              {matchSummaries.map((match) => {
                const records = data.competitionRecords.filter((record) => record.matchId === match.id);
                return (
                  <tr key={match.id}>
                    <td>{match.date}</td>
                    <td>{categoryLabel(match.category)}</td>
                    <td>{match.opponent}</td>
                    <td>{match.venue ?? '-'}</td>
                    <td>{formatMatchScore(match)}</td>
                    <td>{match.resultType ?? '-'}</td>
                    <td>{records.length}</td>
                    <td><div className="btn-row"><button type="button" className="btn secondary" onClick={() => { setSelectedMatchId(match.id); startEditFullMatch(match.id); }}>Editar partido y jugadores</button><button type="button" className="btn danger" onClick={() => removeMatch(match.id)}>Eliminar</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState title="Sin partidos guardados" text="Los partidos creados aparecerán en este historial." />}
      </div>
      </div>

      {competitionReport ? <CompetitionReportTemplate report={competitionReport} category={activeCategory} className="print-only" /> : null}
    </div>
  );
}
