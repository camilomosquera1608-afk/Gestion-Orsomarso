'use client';

import { useEffect, useMemo, useState } from 'react';
import { BodyMapSelector } from '@/components/body-map-selector';
import { ToneBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { categoryLabel } from '@/lib/labels';
import { getTrafficLight } from '@/lib/rules';
import { supabase, tableSchemaSyncEnabled } from '@/lib/supabase';
import { appendBodyMapRecord, bodyMapRecordToRemoteRow, getBodyMapDecision, newBodyMapId, REMOTE_BODY_MAP_TABLE, type BodyMapRecord, type BodyMapRecordType, type BodyMapSide } from '@/lib/body-map';
import type { ClubCategory } from '@/lib/types';

type WellnessFormState = {
  sleep: number;
  fatigue: number;
  stress: number;
  musclePain: number;
  mood: number;
};

type WellnessPublicPlayer = {
  id: string;
  remoteId?: string;
  name: string;
  category: ClubCategory;
  source: 'remote' | 'local';
};

const defaultState: WellnessFormState = {
  sleep: 0,
  fatigue: 0,
  stress: 0,
  musclePain: 0,
  mood: 0,
};

const categoryAliases: Record<string, ClubCategory> = {
  u15: 'Sub15',
  sub15: 'Sub15',
  'sub-15': 'Sub15',
  u17: 'Sub17',
  sub17: 'Sub17',
  'sub-17': 'Sub17',
  u20: 'Sub20',
  sub20: 'Sub20',
  'sub-20': 'Sub20',
};

export const parseWellnessCategory = (value?: string | null): ClubCategory | null => {
  if (!value) return null;
  return categoryAliases[value.trim().toLowerCase()] ?? null;
};

const questionMeta: Record<keyof WellnessFormState, { title: string; options: Record<number, string> }> = {
  sleep: {
    title: '¿Cómo fue la calidad de tu sueño?',
    options: { 0: 'Selecciona', 1: 'Muy malo', 2: 'Malo', 3: 'Normal', 4: 'Bueno', 5: 'Excelente' },
  },
  fatigue: {
    title: '¿Qué tan descansado y con energía te sientes?',
    options: { 0: 'Selecciona', 1: 'Muy fatigado', 2: 'Fatigado', 3: 'Normal', 4: 'Con buena energía', 5: 'Muy fresco' },
  },
  stress: {
    title: '¿Cómo está tu nivel de estrés hoy?',
    options: { 0: 'Selecciona', 1: 'Muy estresado', 2: 'Estresado', 3: 'Normal', 4: 'Tranquilo', 5: 'Muy tranquilo' },
  },
  musclePain: {
    title: '¿Cómo está tu estado muscular hoy?',
    options: { 0: 'Selecciona', 1: 'Dolor fuerte', 2: 'Dolor moderado', 3: 'Molestia leve', 4: 'Casi sin dolor', 5: 'Sin dolor' },
  },
  mood: {
    title: '¿Cómo está tu ánimo hoy?',
    options: { 0: 'Selecciona', 1: 'Muy bajo', 2: 'Bajo', 3: 'Normal', 4: 'Bueno', 5: 'Muy bueno' },
  },
};

const toneText = {
  green: 'Bien',
  yellow: 'Normal',
  red: 'Atención',
};

const isComplete = (values: WellnessFormState) => Object.values(values).every((value) => value >= 1 && value <= 5);

export function WellnessPublicForm({ forcedCategory }: { forcedCategory?: ClubCategory | null }) {
  const { data, upsertWellness } = useApp();
  const [message, setMessage] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [loadMessage, setLoadMessage] = useState('Cargando jugadores...');
  const [remotePlayers, setRemotePlayers] = useState<WellnessPublicPlayer[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [values, setValues] = useState<WellnessFormState>(defaultState);
  const [bodyRegion, setBodyRegion] = useState('Isquiotibial');
  const [bodySide, setBodySide] = useState<BodyMapSide>('Derecha');
  const [bodyType, setBodyType] = useState<BodyMapRecordType>('Molestia');
  const [bodyIntensity, setBodyIntensity] = useState(0);
  const [bodyLimitation, setBodyLimitation] = useState(false);
  const [bodySprint, setBodySprint] = useState(false);
  const [bodyCod, setBodyCod] = useState(false);

  const localPlayers = useMemo<WellnessPublicPlayer[]>(() => data.players
    .filter((player) => !forcedCategory || player.category === forcedCategory)
    .map((player) => ({ id: player.id, name: player.name, category: player.category ?? 'Sub20', source: 'local' })), [data.players, forcedCategory]);

  useEffect(() => {
    let active = true;
    const loadPlayers = async () => {
      setLoadMessage('Cargando jugadores...');
      if (!supabase || !tableSchemaSyncEnabled) {
        setRemotePlayers([]);
        setLoadMessage(localPlayers.length ? 'Jugadores cargados localmente.' : 'No hay jugadores cargados en esta categoría.');
        return;
      }

      let query = supabase
        .from('players')
        .select('id, legacy_id, name, category, status')
        .order('name');

      if (forcedCategory) query = query.eq('category', forcedCategory);
      const { data: rows, error } = await query;

      if (!active) return;
      if (error) {
        setRemotePlayers([]);
        setLoadMessage(localPlayers.length ? 'Usando jugadores locales. Revisa permisos públicos de Wellness en Supabase.' : 'No se pudieron cargar jugadores. Ejecuta el SQL v108.1 de Wellness público.');
        return;
      }

      const players = (rows ?? [])
        .filter((row: any) => !forcedCategory || row.category === forcedCategory)
        .map((row: any) => ({
          id: String(row.legacy_id ?? row.id),
          remoteId: String(row.id),
          name: String(row.name ?? 'Jugador'),
          category: (row.category === 'Sub15' || row.category === 'Sub17' || row.category === 'Sub20' ? row.category : 'Sub20') as ClubCategory,
          source: 'remote' as const,
        }));

      setRemotePlayers(players);
      setLoadMessage(players.length ? 'Jugadores cargados.' : `No hay jugadores ${forcedCategory ? categoryLabel(forcedCategory) : ''} disponibles.`);
    };

    void loadPlayers();
    return () => { active = false; };
  }, [forcedCategory, localPlayers.length]);

  const players = remotePlayers.length ? remotePlayers : localPlayers;

  useEffect(() => {
    if (!players.length) {
      setSelectedPlayerId('');
      return;
    }
    if (!players.some((player) => player.id === selectedPlayerId)) {
      setSelectedPlayerId(players[0].id);
    }
  }, [players, selectedPlayerId]);

  const average = useMemo(() => {
    const total = values.sleep + values.fatigue + values.stress + values.musclePain + values.mood;
    return (total / 5).toFixed(1);
  }, [values]);

  const showBodyMap = (values.musclePain > 0 && values.musclePain <= 3) || (values.fatigue > 0 && values.fatigue <= 2);
  const bodyDecision = getBodyMapDecision({
    region: bodyRegion,
    type: bodyType,
    intensity: bodyIntensity,
    limitation: bodyLimitation,
    increasesWithSprint: bodySprint,
    increasesWithChangeOfDirection: bodyCod,
    status: 'Abierto',
  });

  const handleSubmit = async (formData: FormData) => {
    if (submitState === 'saving') return;
    setSubmitState('saving');
    setMessage('Enviando wellness...');

    const playerId = String(formData.get('playerId'));
    const player = players.find((item) => item.id === playerId);
    const recordDate = String(formData.get('date'));
    const payload = {
      id: crypto.randomUUID(),
      playerId,
      date: recordDate,
      category: player?.category ?? forcedCategory ?? 'Sub20',
      sleep: Number(formData.get('sleep')),
      fatigue: Number(formData.get('fatigue')),
      stress: Number(formData.get('stress')),
      musclePain: Number(formData.get('musclePain')),
      mood: Number(formData.get('mood')),
    };

    if (!player) {
      setSubmitState('error');
      setMessage('Selecciona un jugador.');
      return;
    }
    const wellnessAnswers: WellnessFormState = {
      sleep: payload.sleep,
      fatigue: payload.fatigue,
      stress: payload.stress,
      musclePain: payload.musclePain,
      mood: payload.mood,
    };

    if (!isComplete(wellnessAnswers)) {
      setSubmitState('error');
      setMessage('Completa las 5 respuestas antes de enviar.');
      return;
    }

    const alreadyAnsweredLocal = data.wellness.some((record) =>
      record.playerId === playerId && record.date === recordDate && (!record.category || record.category === payload.category)
    );
    if (alreadyAnsweredLocal) {
      setSubmitState('error');
      setMessage('Ya registraste wellness para esta fecha. Si fue un error, avisa al cuerpo técnico.');
      return;
    }

    try {
      if (player.source === 'remote' && player.remoteId && supabase && tableSchemaSyncEnabled) {
        const { error: rpcError } = await supabase.rpc('submit_public_wellness', {
          p_player_id: player.remoteId,
          p_date: recordDate,
          p_category: payload.category,
          p_sleep: payload.sleep,
          p_fatigue: payload.fatigue,
          p_stress: payload.stress,
          p_muscle_pain: payload.musclePain,
          p_mood: payload.mood,
        });

        if (rpcError) {
          const { error } = await supabase.from('daily_wellness').upsert({
            legacy_id: payload.id,
            player_id: player.remoteId,
            date: recordDate,
            category: payload.category,
            sleep: payload.sleep,
            fatigue: payload.fatigue,
            stress: payload.stress,
            muscle_pain: payload.musclePain,
            mood: payload.mood,
          }, { onConflict: 'player_id,date', ignoreDuplicates: false });

          if (error) throw error;
        }
      } else {
        upsertWellness(payload);
      }

      if (showBodyMap && bodyIntensity > 0) {
        const bodyMapRecord: BodyMapRecord = {
          id: newBodyMapId(),
          playerId,
          date: recordDate,
          category: payload.category,
          source: 'Jugador',
          type: bodyType,
          region: bodyRegion,
          side: bodySide,
          intensity: bodyIntensity,
          limitation: bodyLimitation,
          increasesWithSprint: bodySprint,
          increasesWithChangeOfDirection: bodyCod,
          status: 'Abierto',
          action: `${bodyDecision.decision} · ${bodyDecision.pct}`,
          restriction: bodyDecision.restriction,
          createdAt: new Date().toISOString(),
        };

        appendBodyMapRecord(bodyMapRecord);

        if (player.source === 'remote' && player.remoteId && supabase && tableSchemaSyncEnabled) {
          const rpcResult = await supabase.rpc('submit_public_body_map_report', {
            p_player_id: player.remoteId,
            p_player_legacy_id: playerId,
            p_date: recordDate,
            p_category: payload.category,
            p_type: bodyMapRecord.type,
            p_region: bodyMapRecord.region,
            p_side: bodyMapRecord.side,
            p_intensity: bodyMapRecord.intensity,
            p_limitation: bodyMapRecord.limitation,
            p_increases_with_sprint: bodyMapRecord.increasesWithSprint ?? false,
            p_increases_with_change_of_direction: bodyMapRecord.increasesWithChangeOfDirection ?? false,
            p_action: bodyMapRecord.action ?? null,
            p_restriction: bodyMapRecord.restriction ?? null,
            p_legacy_id: bodyMapRecord.id,
          });

          if (rpcResult.error) {
            const { error: directBodyMapError } = await supabase
              .from(REMOTE_BODY_MAP_TABLE)
              .upsert(bodyMapRecordToRemoteRow(bodyMapRecord, player.remoteId), { onConflict: 'legacy_id', ignoreDuplicates: false });
            if (directBodyMapError) {
              console.warn('No se pudo guardar mapa corporal remoto. Ejecuta el SQL V130_BODY_MAP_WELLNESS_STAFF.sql.', directBodyMapError.message);
            }
          }
        }
      }

      setSelectedPlayerId(playerId);
      setDate(recordDate);
      setValues(defaultState);
      setBodyIntensity(0);
      setBodyLimitation(false);
      setBodySprint(false);
      setBodyCod(false);
      setSubmitState('success');
      setMessage(`Wellness enviado correctamente por ${player.name} · ${recordDate}. Puedes cerrar esta pantalla.`);
    } catch (error) {
      console.error('public wellness submit error', error);
      setSubmitState('error');
      setMessage('No se pudo enviar. Revisa conexión o ejecuta el SQL Wellness público.');
    }
  };

  const categoryTitle = forcedCategory ? `Wellness ${categoryLabel(forcedCategory)}` : 'Wellness jugadores';
  const connectionLabel = remotePlayers.length ? 'Conectado' : players.length ? 'Modo local' : 'Sin jugadores';
  const connectionTone = remotePlayers.length ? 'green' : players.length ? 'yellow' : 'red';

  return (
    <div className="grid wellness-public-page">
      <div className="wellness-public-hero">
        <span>Orsomarso Performance</span>
        <h2>Wellness diario</h2>
        <p>{forcedCategory ? `Formulario público · ${categoryLabel(forcedCategory)}` : 'Formulario público para jugadores'}</p>
      </div>

      <div className="card wellness-form-card">
        <div className="wellness-public-header">
          <div>
            <span className="section-eyebrow">{categoryTitle}</span>
            <h3>Formulario wellness</h3>
            <div className="wellness-average">Promedio actual: {average}</div>
          </div>
          <div className="btn-row wellness-public-badges">
            <ToneBadge text="Escala 1 a 5" tone="green" />
            {forcedCategory ? <ToneBadge text={categoryLabel(forcedCategory)} tone="blue" /> : null}
            <ToneBadge text={connectionLabel} tone={connectionTone as 'green' | 'yellow' | 'red'} />
          </div>
        </div>

        <form action={handleSubmit} className="grid wellness-public-form">
          <div className="grid grid-2 wellness-public-fields">
            <div className="field">
              <label>Jugador</label>
              <select className="select" name="playerId" value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} disabled={!players.length}>
                {!players.length ? <option value="">Sin jugadores disponibles</option> : null}
                {players.map((player) => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
              <span className="field-help">{loadMessage}</span>
            </div>

            <div className="field">
              <label>Fecha</label>
              <input className="input" type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="wellness-preview-grid wellness-public-question-grid">
            {(Object.keys(values) as (keyof WellnessFormState)[]).map((key, index) => {
              const tone = getTrafficLight(values[key]) as 'green' | 'yellow' | 'red';
              return (
                <div key={key} className={`wellness-preview-card tone-${tone}`}>
                  <div className="question-number">Pregunta {index + 1}</div>
                  <div className="field">
                    <label className="wellness-question-label">{questionMeta[key].title}</label>
                    <select
                      className="select wellness-select-large"
                      name={key}
                      value={values[key]}
                      onChange={(e) => setValues((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                    >
                      {Object.entries(questionMeta[key].options).map(([value, text]) => (
                        <option key={value} value={value}>{Number(value) === 0 ? text : `${value}. ${text}`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="wellness-preview-footer">
                    <strong>{values[key]}/5</strong>
                    <ToneBadge text={toneText[tone]} tone={tone} />
                  </div>
                </div>
              );
            })}
          </div>

          {showBodyMap ? (
            <div className="card wellness-body-map-card">
              <div className="section-eyebrow">Mapa corporal</div>
              <h3>Ubica la fatiga, molestia o dolor muscular</h3>
              <p className="muted-line">No diagnostica lesión. Sirve para que el cuerpo técnico y fisioterapia ajusten la carga con mejor información.</p>
              <div className="grid grid-2 wellness-body-map-fields">
                <label>Tipo
                  <select className="select" value={bodyType} onChange={(event) => setBodyType(event.target.value as BodyMapRecordType)}>
                    {['Fatiga muscular', 'Molestia', 'Dolor muscular'].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>Lado
                  <select className="select" value={bodySide} onChange={(event) => setBodySide(event.target.value as BodyMapSide)}>
                    {['Derecha', 'Izquierda', 'Bilateral', 'Central'].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>Intensidad 0 a 10
                  <input className="input" type="number" min="0" max="10" value={bodyIntensity} onChange={(event) => setBodyIntensity(Number(event.target.value))} />
                </label>
                <div className="body-map-checks">
                  <label><input type="checkbox" checked={bodyLimitation} onChange={(event) => setBodyLimitation(event.target.checked)} /> Me limita para entrenar</label>
                  <label><input type="checkbox" checked={bodySprint} onChange={(event) => setBodySprint(event.target.checked)} /> Aumenta al correr/sprintar</label>
                  <label><input type="checkbox" checked={bodyCod} onChange={(event) => setBodyCod(event.target.checked)} /> Aumenta al frenar/girar</label>
                </div>
              </div>
              <BodyMapSelector value={bodyRegion} onChange={setBodyRegion} />
              <div className="soft-alert warning"><strong>{bodyDecision.decision} · {bodyDecision.pct}</strong> {bodyDecision.restriction}</div>
            </div>
          ) : null}

          <button className="btn wellness-submit-button" type="submit" disabled={!players.length || submitState === 'saving'}>
            {submitState === 'saving' ? 'Enviando...' : 'Enviar wellness'}
          </button>
        </form>

        {message ? <div className={`wellness-form-message ${submitState === 'error' ? 'error' : submitState === 'success' ? 'success' : ''}`}>{message}</div> : null}
      </div>
    </div>
  );
}
