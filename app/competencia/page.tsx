'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { CompetitionReportTemplate } from '@/components/competition-report';
import { PremiumCompetitionReport } from '@/components/pdf/premium-competition-report';
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
import { ClubCategory, MovementType, CompetitionMedicalStatus, CompetitionPlayerRole, CompetitionRecord, CompetitionVenue, type CompetitionLineupSlot, type DailyExternalLoadRecord } from '@/lib/types';
import { type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { Upload as UploadIcon, FileText, X as XIcon } from 'lucide-react';
import { parseEyeballCsv, type EyeballMatchStats } from '@/components/eyeball-importer';
import { CsvImporter } from '@/components/csv-importer';
import { supportsGps } from '@/lib/report-utils';
import { buildCompetitionLogic, buildDataInconsistencyAlerts, buildReturnToPlayAlerts, buildRoleLoadControl } from '@/lib/logic-insights';
import { getCanonicalPlayers } from '@/lib/relational-data';

const categories: ClubCategory[] = ['Sub15', 'Sub17', 'Sub20'];
const starterOptions: CompetitionPlayerRole[] = ['Titular', 'Suplente'];
const medicalOptions: CompetitionMedicalStatus[] = ['Sin lesión', 'Lesionado'];

const CATEGORY_RANK: Record<ClubCategory, number> = { Sub15: 15, Sub17: 17, Sub20: 20 };
const inferCompetitionMovement = (baseCategory: ClubCategory | undefined, actingCategory: ClubCategory): MovementType => {
  const base = baseCategory ?? actingCategory;
  if (base === actingCategory) return 'base';
  return CATEGORY_RANK[base] < CATEGORY_RANK[actingCategory] ? 'subio_a_competir' : 'bajo_a_competir';
};

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
  penaltiesSaved: string;
  crossesDefended: string;
  footworkActions: string;
  yellowCards: string;
  redCards: string;
  startingRole: CompetitionPlayerRole;
  medicalStatus: CompetitionMedicalStatus;
  medicalObservation: string;
  // GPS — solo jugadores de campo
  acc: string;
  dcc: string;
  sprints: string;
  rhie: string;
  totalDistance: string;
  highSpeedDistance: string;
  sprintDistance: string;
  maxVelocity: string;
  playerLoad: string;
};

const emptyPlayerDraft = (playerId = ''): PlayerDraft => ({
  playerId,
  minutesPlayed: '',
  goals: '',
  assists: '',
  goalsConceded: '',
  goalsPrevented: '',
  penaltiesSaved: '',
  crossesDefended: '',
  footworkActions: '',
  yellowCards: '',
  redCards: '',
  startingRole: 'Titular',
  medicalStatus: 'Sin lesión',
  medicalObservation: '',
  acc: '', dcc: '', sprints: '', rhie: '',
  totalDistance: '', highSpeedDistance: '', sprintDistance: '', maxVelocity: '', playerLoad: '',
});

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isNegative = (value: string) => value.trim() !== '' && toNumber(value) < 0;
const displayNumber = (value?: number) => (value && value > 0 ? String(value) : '');
const displayOptionalNumber = (value?: number) => (typeof value === 'number' ? String(value) : '');
const clampPercent = (value: number) => Math.max(4, Math.min(96, value));

type FormationKey = '4-2-3-1' | '4-3-3' | '4-4-2' | '3-5-2' | '4-1-4-1' | '3-4-3' | '5-3-2' | '5-4-1';
const formationOptions: FormationKey[] = ['4-2-3-1', '4-3-3', '4-4-2', '3-5-2', '4-1-4-1', '3-4-3', '5-3-2', '5-4-1'];
const formationTemplates: Record<FormationKey, Omit<CompetitionLineupSlot, 'playerId'>[]> = {
  '4-2-3-1': [
    { id: 'gk', label: 'POR', line: 'Arquero', x: 50, y: 91 },
    { id: 'lb', label: 'LI', line: 'Defensa', x: 18, y: 72 }, { id: 'lcb', label: 'DFC', line: 'Defensa', x: 39, y: 76 }, { id: 'rcb', label: 'DFC', line: 'Defensa', x: 61, y: 76 }, { id: 'rb', label: 'LD', line: 'Defensa', x: 82, y: 72 },
    { id: 'dm1', label: 'MCD', line: 'Mediocampo', x: 42, y: 55 }, { id: 'dm2', label: 'MCD', line: 'Mediocampo', x: 58, y: 55 },
    { id: 'lw', label: 'EI', line: 'Ataque', x: 20, y: 36 }, { id: 'am', label: 'MCO', line: 'Ataque', x: 50, y: 32 }, { id: 'rw', label: 'ED', line: 'Ataque', x: 80, y: 36 },
    { id: 'st', label: 'DC', line: 'Ataque', x: 50, y: 15 },
  ],
  '4-3-3': [
    { id: 'gk', label: 'POR', line: 'Arquero', x: 50, y: 91 },
    { id: 'lb', label: 'LI', line: 'Defensa', x: 18, y: 72 }, { id: 'lcb', label: 'DFC', line: 'Defensa', x: 39, y: 76 }, { id: 'rcb', label: 'DFC', line: 'Defensa', x: 61, y: 76 }, { id: 'rb', label: 'LD', line: 'Defensa', x: 82, y: 72 },
    { id: 'cm1', label: 'MC', line: 'Mediocampo', x: 30, y: 51 }, { id: 'cm2', label: 'MC', line: 'Mediocampo', x: 50, y: 56 }, { id: 'cm3', label: 'MC', line: 'Mediocampo', x: 70, y: 51 },
    { id: 'lw', label: 'EI', line: 'Ataque', x: 22, y: 25 }, { id: 'st', label: 'DC', line: 'Ataque', x: 50, y: 16 }, { id: 'rw', label: 'ED', line: 'Ataque', x: 78, y: 25 },
  ],
  '4-4-2': [
    { id: 'gk', label: 'POR', line: 'Arquero', x: 50, y: 91 },
    { id: 'lb', label: 'LI', line: 'Defensa', x: 18, y: 72 }, { id: 'lcb', label: 'DFC', line: 'Defensa', x: 39, y: 76 }, { id: 'rcb', label: 'DFC', line: 'Defensa', x: 61, y: 76 }, { id: 'rb', label: 'LD', line: 'Defensa', x: 82, y: 72 },
    { id: 'lm', label: 'MI', line: 'Mediocampo', x: 18, y: 50 }, { id: 'cm1', label: 'MC', line: 'Mediocampo', x: 40, y: 54 }, { id: 'cm2', label: 'MC', line: 'Mediocampo', x: 60, y: 54 }, { id: 'rm', label: 'MD', line: 'Mediocampo', x: 82, y: 50 },
    { id: 'st1', label: 'DC', line: 'Ataque', x: 40, y: 18 }, { id: 'st2', label: 'DC', line: 'Ataque', x: 60, y: 18 },
  ],
  '3-5-2': [
    { id: 'gk', label: 'POR', line: 'Arquero', x: 50, y: 91 },
    { id: 'lcb', label: 'DFC', line: 'Defensa', x: 30, y: 75 }, { id: 'cb', label: 'DFC', line: 'Defensa', x: 50, y: 78 }, { id: 'rcb', label: 'DFC', line: 'Defensa', x: 70, y: 75 },
    { id: 'lwb', label: 'CAI', line: 'Mediocampo', x: 13, y: 52 }, { id: 'cm1', label: 'MC', line: 'Mediocampo', x: 35, y: 56 }, { id: 'cm2', label: 'MC', line: 'Mediocampo', x: 50, y: 48 }, { id: 'cm3', label: 'MC', line: 'Mediocampo', x: 65, y: 56 }, { id: 'rwb', label: 'CAD', line: 'Mediocampo', x: 87, y: 52 },
    { id: 'st1', label: 'DC', line: 'Ataque', x: 40, y: 18 }, { id: 'st2', label: 'DC', line: 'Ataque', x: 60, y: 18 },
  ],
  '4-1-4-1': [
    { id: 'gk', label: 'POR', line: 'Arquero', x: 50, y: 91 },
    { id: 'lb', label: 'LI', line: 'Defensa', x: 18, y: 72 }, { id: 'lcb', label: 'DFC', line: 'Defensa', x: 39, y: 76 }, { id: 'rcb', label: 'DFC', line: 'Defensa', x: 61, y: 76 }, { id: 'rb', label: 'LD', line: 'Defensa', x: 82, y: 72 },
    { id: 'dm', label: 'MCD', line: 'Mediocampo', x: 50, y: 60 },
    { id: 'lm', label: 'MI', line: 'Mediocampo', x: 18, y: 43 }, { id: 'cm1', label: 'MC', line: 'Mediocampo', x: 40, y: 45 }, { id: 'cm2', label: 'MC', line: 'Mediocampo', x: 60, y: 45 }, { id: 'rm', label: 'MD', line: 'Mediocampo', x: 82, y: 43 },
    { id: 'st', label: 'DC', line: 'Ataque', x: 50, y: 16 },
  ],
  '3-4-3': [
    { id: 'gk', label: 'POR', line: 'Arquero', x: 50, y: 91 },
    { id: 'lcb', label: 'DFC', line: 'Defensa', x: 30, y: 75 }, { id: 'cb', label: 'DFC', line: 'Defensa', x: 50, y: 78 }, { id: 'rcb', label: 'DFC', line: 'Defensa', x: 70, y: 75 },
    { id: 'lm', label: 'MI', line: 'Mediocampo', x: 16, y: 51 }, { id: 'cm1', label: 'MC', line: 'Mediocampo', x: 40, y: 55 }, { id: 'cm2', label: 'MC', line: 'Mediocampo', x: 60, y: 55 }, { id: 'rm', label: 'MD', line: 'Mediocampo', x: 84, y: 51 },
    { id: 'lw', label: 'EI', line: 'Ataque', x: 22, y: 23 }, { id: 'st', label: 'DC', line: 'Ataque', x: 50, y: 15 }, { id: 'rw', label: 'ED', line: 'Ataque', x: 78, y: 23 },
  ],
  '5-3-2': [
    { id: 'gk', label: 'POR', line: 'Arquero', x: 50, y: 91 },
    { id: 'lb', label: 'LI', line: 'Defensa', x: 12, y: 70 }, { id: 'lcb', label: 'DFC', line: 'Defensa', x: 32, y: 76 }, { id: 'cb', label: 'DFC', line: 'Defensa', x: 50, y: 79 }, { id: 'rcb', label: 'DFC', line: 'Defensa', x: 68, y: 76 }, { id: 'rb', label: 'LD', line: 'Defensa', x: 88, y: 70 },
    { id: 'cm1', label: 'MC', line: 'Mediocampo', x: 35, y: 52 }, { id: 'cm2', label: 'MC', line: 'Mediocampo', x: 50, y: 47 }, { id: 'cm3', label: 'MC', line: 'Mediocampo', x: 65, y: 52 },
    { id: 'st1', label: 'DC', line: 'Ataque', x: 42, y: 18 }, { id: 'st2', label: 'DC', line: 'Ataque', x: 58, y: 18 },
  ],
  '5-4-1': [
    { id: 'gk', label: 'POR', line: 'Arquero', x: 50, y: 91 },
    { id: 'lb', label: 'LI', line: 'Defensa', x: 12, y: 70 }, { id: 'lcb', label: 'DFC', line: 'Defensa', x: 32, y: 76 }, { id: 'cb', label: 'DFC', line: 'Defensa', x: 50, y: 79 }, { id: 'rcb', label: 'DFC', line: 'Defensa', x: 68, y: 76 }, { id: 'rb', label: 'LD', line: 'Defensa', x: 88, y: 70 },
    { id: 'lm', label: 'MI', line: 'Mediocampo', x: 18, y: 48 }, { id: 'cm1', label: 'MC', line: 'Mediocampo', x: 40, y: 52 }, { id: 'cm2', label: 'MC', line: 'Mediocampo', x: 60, y: 52 }, { id: 'rm', label: 'MD', line: 'Mediocampo', x: 82, y: 48 },
    { id: 'st', label: 'DC', line: 'Ataque', x: 50, y: 16 },
  ],
};
const buildFormationSlots = (formation: FormationKey, existing: CompetitionLineupSlot[] = []): CompetitionLineupSlot[] => {
  const existingById = new Map(existing.map((slot) => [slot.id, slot]));
  return formationTemplates[formation].map((slot) => {
    const prev = existingById.get(slot.id);
    return { ...slot, x: typeof prev?.x === 'number' ? prev.x : slot.x, y: typeof prev?.y === 'number' ? prev.y : slot.y, playerId: prev?.playerId || '' };
  });
};


// ── Helpers para EyeballReport ────────────────────────────────────────────────
const numVal = (v: string | number): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const displayVal = (v: string | number): string => {
  if (typeof v === 'string') return v;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};
type WinSide = 'orso' | 'rival' | 'draw';
const winSide = (orso: number, rival: number, higherBetter = true): WinSide => {
  if (orso === rival) return 'draw';
  return (orso > rival) === higherBetter ? 'orso' : 'rival';
};
const LOWER_BETTER = new Set(['Faltas', 'Fuera de juego', 'Errores', 'Tiros fuera de puerta', 'Tiros fuera del área']);

function EyeballStatRow({ stat, orso, rival }: { stat: string; orso: string | number; rival: string | number }) {
  const on = numVal(orso); const rn = numVal(rival);
  const hb = !LOWER_BETTER.has(stat);
  const win = winSide(on, rn, hb);
  const total = on + rn || 1;
  const orsoW = Math.round((on / total) * 100);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 1fr', gap: 8, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f0f4fb' }}>
      <div style={{ textAlign: 'right', fontWeight: win === 'rival' ? 900 : 700, color: win === 'rival' ? '#065f46' : '#334155', fontSize: 12 }}>{displayVal(rival)}</div>
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', textAlign: 'center', marginBottom: 3 }}>{stat}</div>
        <div style={{ display: 'flex', height: 5, borderRadius: 999, overflow: 'hidden', gap: 1 }}>
          <div style={{ width: `${100 - orsoW}%`, background: '#94a3b8', borderRadius: '999px 0 0 999px' }} />
          <div style={{ width: `${orsoW}%`, background: win === 'orso' ? '#059669' : win === 'rival' ? '#dc2626' : '#94a3b8', borderRadius: '0 999px 999px 0' }} />
        </div>
      </div>
      <div style={{ fontWeight: win === 'orso' ? 900 : 700, color: win === 'orso' ? '#065f46' : '#334155', fontSize: 12 }}>{displayVal(orso)}</div>
    </div>
  );
}

function EyeballReport({ stats }: { stats: EyeballMatchStats }) {
  const result = stats.goalsFor > stats.goalsAgainst ? 'Victoria' : stats.goalsFor < stats.goalsAgainst ? 'Derrota' : 'Empate';
  const resultColor = result === 'Victoria' ? '#059669' : result === 'Derrota' ? '#dc2626' : '#d97706';
  return (
    <div>
      {/* Score hero */}
      <div style={{ background: 'linear-gradient(135deg,#06152f 0%,#1a3a8a 100%)', borderRadius: 16, padding: '20px 24px', color: '#fff', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 3 }}>Rival</div>
          <div style={{ fontSize: 14, fontWeight: 900 }}>{stats.rivalName}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-.06em', lineHeight: 1 }}>
            <span style={{ color: 'rgba(255,255,255,.5)' }}>{stats.goalsAgainst}</span>
            <span style={{ color: 'rgba(255,255,255,.25)', margin: '0 8px', fontWeight: 300 }}>:</span>
            <span style={{ color: '#fff' }}>{stats.goalsFor}</span>
          </div>
          <div style={{ marginTop: 8, display: 'inline-block', padding: '4px 12px', borderRadius: 999, background: resultColor, fontSize: 11, fontWeight: 800 }}>{result}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 3 }}>Orsomarso SC</div>
          <div style={{ fontSize: 14, fontWeight: 900 }}>Orsomarso SC</div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Posesión', orso: `${stats.possession}%`, rival: `${100 - stats.possession}%`, good: stats.possession >= 50 },
          { label: 'Precisión pase', orso: `${stats.passPrecision}%`, rival: '—', good: stats.passPrecision >= 75 },
          { label: 'Conversión', orso: `${stats.conversionRate}%`, rival: '—', good: stats.conversionRate >= 15 },
        ].map(({ label, orso, rival: rv, good }) => (
          <div key={label} style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 14px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: '#64748b', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: good ? '#059669' : '#dc2626' }}>{orso}</div>
            {rv !== '—' && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Rival: {rv}</div>}
          </div>
        ))}
      </div>

      {/* Section stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {Object.entries(stats.sections).map(([section, rows]) => (
          <div key={section} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#06152f', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 11, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '.08em' }}>{section}</strong>
              <div style={{ display: 'flex', gap: 20, fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,.45)' }}>
                <span>{stats.rivalName}</span><span>Orsomarso</span>
              </div>
            </div>
            <div style={{ padding: '4px 14px 8px' }}>
              {rows.map((row) => <EyeballStatRow key={row.stat} stat={row.stat} orso={row.orso} rival={row.rival} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CompetenciaPage() {
  const { data, filters, deleteCompetitionRecord, upsertCompetitionMatchSummary, saveCompetitionMatchBundle, deleteCompetitionMatchSummary } = useApp();
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
  const [showGpsCsv, setShowGpsCsv] = useState(false);
  const [isSavingMatch, setIsSavingMatch] = useState(false);
  const [isSavingPlayer, setIsSavingPlayer] = useState(false);
  const [editingMatchPlayers, setEditingMatchPlayers] = useState(false);
  const [eyeballStats, setEyeballStats] = useState<EyeballMatchStats | null>(null);
  const [eyeballFirstHalfStats, setEyeballFirstHalfStats] = useState<EyeballMatchStats | null>(null);
  const [eyeballSecondHalfStats, setEyeballSecondHalfStats] = useState<EyeballMatchStats | null>(null);
  const [eyeballFile, setEyeballFile] = useState('');
  const [eyeballFirstHalfFile, setEyeballFirstHalfFile] = useState('');
  const [eyeballSecondHalfFile, setEyeballSecondHalfFile] = useState('');
  const [eyeballError, setEyeballError] = useState('');
  const [activeLineupSlotId, setActiveLineupSlotId] = useState('');
  const [reportStyle, setReportStyle] = useState<'classic' | 'premium'>('classic');

  const processEyeballFile = (file: File, period: 'full' | 'first' | 'second' = 'full') => {
    setEyeballError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = String(e.target?.result ?? '');
      const parsed = parseEyeballCsv(raw);
      if (!parsed) { setEyeballError('No se pudo leer el CSV. Verifica el formato Eyeball.'); return; }
      if (period === 'first') {
        setEyeballFirstHalfStats(parsed);
        setEyeballFirstHalfFile(file.name);
        if (selectedMatch) upsertCompetitionMatchSummary({ ...selectedMatch, eyeballFirstHalfStats: parsed });
        return;
      }
      if (period === 'second') {
        setEyeballSecondHalfStats(parsed);
        setEyeballSecondHalfFile(file.name);
        if (selectedMatch) upsertCompetitionMatchSummary({ ...selectedMatch, eyeballSecondHalfStats: parsed });
        return;
      }
      setEyeballStats(parsed);
      setEyeballFile(file.name);
      if (selectedMatch) upsertCompetitionMatchSummary({ ...selectedMatch, eyeballStats: parsed, goalsFor: selectedMatch.goalsFor ?? parsed.goalsFor, goalsAgainst: selectedMatch.goalsAgainst ?? parsed.goalsAgainst });
    };
    reader.readAsText(file, 'UTF-8');
  };
  const [matchPlayerDrafts, setMatchPlayerDrafts] = useState<MatchPlayerDraftMap>({});
  const [isSavingMatchPlayers, setIsSavingMatchPlayers] = useState(false);

  const playersBySource = useMemo(
    () => getCanonicalPlayers(data, data.players.filter((player) => player.category === sourceCategory)),
    [data, sourceCategory],
  );
  const gpsPlayersForImport = useMemo(() => playersBySource.filter((player) => !isGoalkeeper(player)), [playersBySource]);
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

  const selectedFormation = ((selectedMatch?.lineupFormation || '4-2-3-1') as FormationKey);
  const selectedLineupSlots = useMemo(
    () => buildFormationSlots(selectedFormation, selectedMatch?.lineupSlots ?? []),
    [selectedFormation, selectedMatch?.lineupSlots],
  );
  const lineupPlayerOptions = useMemo(() => {
    const records = matchRecords.length ? matchRecords : data.competitionRecords.filter((record) => selectedMatch && record.matchId === selectedMatch.id);
    return records
      .map((record) => ({ record, player: data.players.find((player) => player.id === record.playerId) }))
      .filter((item) => item.player)
      .sort((a, b) => (a.player?.name ?? '').localeCompare(b.player?.name ?? ''));
  }, [matchRecords, data.competitionRecords, data.players, selectedMatch]);
  const saveLineup = (formation: FormationKey, slots: CompetitionLineupSlot[]) => {
    if (!selectedMatch) return;
    upsertCompetitionMatchSummary({ ...selectedMatch, lineupFormation: formation, lineupSlots: slots });
    setMessage('Alineación actualizada.');
  };
  const changeLineupFormation = (formation: FormationKey) => {
    const nextSlots = buildFormationSlots(formation, selectedLineupSlots);
    saveLineup(formation, nextSlots);
  };
  const assignLineupPlayer = (slotId: string, playerId: string) => {
    const nextSlots = selectedLineupSlots.map((slot) => ({
      ...slot,
      playerId: slot.id === slotId ? playerId : slot.playerId === playerId && playerId ? '' : slot.playerId,
    }));
    setActiveLineupSlotId(slotId);
    saveLineup(selectedFormation, nextSlots);
  };
  const moveLineupSlot = (slotId: string, axis: 'x' | 'y', value: string) => {
    const numeric = clampPercent(Number(value) || 0);
    const nextSlots = selectedLineupSlots.map((slot) => slot.id === slotId ? { ...slot, [axis]: numeric } : slot);
    saveLineup(selectedFormation, nextSlots);
  };
  const moveActiveLineupSlot = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!activeLineupSlotId) {
      setMessage('Selecciona primero un puesto de la alineación para ubicarlo en la cancha.');
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
    const y = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
    const nextSlots = selectedLineupSlots.map((slot) => slot.id === activeLineupSlotId ? { ...slot, x, y } : slot);
    saveLineup(selectedFormation, nextSlots);
  };
  const nudgeActiveLineupSlot = (dx: number, dy: number) => {
    if (!activeLineupSlotId) {
      setMessage('Selecciona primero un puesto de la alineación.');
      return;
    }
    const nextSlots = selectedLineupSlots.map((slot) => slot.id === activeLineupSlotId ? { ...slot, x: clampPercent(slot.x + dx), y: clampPercent(slot.y + dy) } : slot);
    saveLineup(selectedFormation, nextSlots);
  };
  const uploadOpponentLogo = (file?: File | null) => {
    if (!selectedMatch || !file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Carga una imagen válida para el escudo rival.');
      return;
    }
    if (file.size > 350 * 1024) {
      setMessage('El escudo es muy pesado. Usa una imagen menor a 350 KB para no llenar el almacenamiento.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const logo = String(reader.result ?? '');
      upsertCompetitionMatchSummary({ ...selectedMatch, opponentLogo: logo });
      setMessage('Escudo rival actualizado.');
    };
    reader.readAsDataURL(file);
  };
  const removeOpponentLogo = () => {
    if (!selectedMatch) return;
    upsertCompetitionMatchSummary({ ...selectedMatch, opponentLogo: undefined });
    setMessage('Escudo rival eliminado.');
  };
  const exportCleanPdf = () => {
    if (!selectedMatch) return window.print();
    const previousTitle = document.title;
    const rival = selectedMatch.opponent.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    document.title = `Informe-Competencia-Orsomarso-vs-${rival}-${selectedMatch.date}-${categoryLabel(activeCategory)}`;
    setTimeout(() => {
      window.print();
      setTimeout(() => { document.title = previousTitle; }, 600);
    }, 50);
  };

  const handleCompetitionGpsImport = (records: Omit<DailyExternalLoadRecord, 'id'>[]) => {
    if (!selectedMatch) {
      setMessage('Primero debes crear o seleccionar un partido.');
      setShowGpsCsv(false);
      return;
    }
    if (!supportsGps(activeCategory)) {
      setMessage('La importación GPS de competencia está habilitada para Sub20.');
      setShowGpsCsv(false);
      return;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const nextByPlayer = new Map<string, CompetitionRecord>();
    matchRecords.forEach((record) => nextByPlayer.set(record.playerId, record));

    records.forEach((gps) => {
      const player = data.players.find((item) => item.id === gps.playerId);
      if (!player || isGoalkeeper(player)) { skipped += 1; return; }

      const existing = nextByPlayer.get(gps.playerId);
      const baseCategory = (player.category ?? sourceCategory) as ClubCategory;
      const movementType = (gps.movementType ?? inferCompetitionMovement(baseCategory, activeCategory)) as MovementType;
      const gpsPatch = {
        minutesPlayed: gps.min ?? existing?.minutesPlayed ?? 0,
        acc: gps.acc ?? existing?.acc ?? 0,
        dcc: gps.dcc ?? existing?.dcc ?? 0,
        sprints: gps.sprints ?? existing?.sprints ?? 0,
        rhie: gps.rhie ?? existing?.rhie ?? 0,
        ima: gps.ima ?? existing?.ima ?? 0,
        totalDistance: gps.totalDistance ?? existing?.totalDistance,
        highSpeedDistance: gps.highSpeedDistance ?? gps.hsr ?? existing?.highSpeedDistance ?? existing?.hsr,
        hsr: gps.highSpeedDistance ?? gps.hsr ?? existing?.hsr ?? existing?.highSpeedDistance,
        sprintDistance: gps.sprintDistance ?? existing?.sprintDistance,
        maxVelocity: gps.maxVelocity ?? existing?.maxVelocity,
        playerLoad: gps.playerLoad ?? existing?.playerLoad,
      };

      if (existing) {
        nextByPlayer.set(gps.playerId, {
          ...existing,
          ...gpsPatch,
          category: activeCategory,
          baseCategory,
          actingCategory: activeCategory,
          movementType,
          movementModule: 'competencia',
          loggedBy: session.displayName,
        });
        updated += 1;
        return;
      }

      nextByPlayer.set(gps.playerId, {
        id: crypto.randomUUID(),
        matchId: selectedMatch.id,
        playerId: player.id,
        date: selectedMatch.date,
        opponent: selectedMatch.opponent,
        competitionName: selectedMatch.competitionName,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        startingRole: gpsPatch.minutesPlayed >= 45 ? 'Titular' : 'Suplente',
        category: activeCategory,
        baseCategory,
        actingCategory: activeCategory,
        movementType,
        movementModule: 'competencia',
        loggedBy: session.displayName,
        postCompetitionStatus: 'Sin novedad',
        medicalStatus: 'Sin lesión',
        medicalObservation: '',
        ...gpsPatch,
      });
      created += 1;
    });

    saveCompetitionMatchBundle(selectedMatch, Array.from(nextByPlayer.values()));
    setShowGpsCsv(false);
    setMessage(`CSV GPS importado: ${updated} actualizados · ${created} creados${skipped ? ` · ${skipped} ignorados` : ''}.`);
  };
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
        penaltiesSaved: displayNumber(record.penaltiesSaved),
        crossesDefended: displayNumber(record.crossesDefended),
        footworkActions: displayNumber(record.footworkActions),
        yellowCards: displayNumber(record.yellowCards),
        redCards: displayNumber(record.redCards),
        startingRole: record.startingRole ?? 'Titular',
        medicalStatus: record.medicalStatus ?? (record.postCompetitionStatus === 'Lesionado' ? 'Lesionado' : 'Sin lesión'),
        medicalObservation: record.medicalObservation ?? '',
        acc: displayNumber(record.acc ?? 0),
        dcc: displayNumber(record.dcc ?? 0),
        sprints: displayNumber(record.sprints ?? 0),
        rhie: displayNumber(record.rhie ?? 0),
        totalDistance: displayOptionalNumber(record.totalDistance),
        highSpeedDistance: displayOptionalNumber(record.highSpeedDistance ?? record.hsr),
        sprintDistance: displayOptionalNumber(record.sprintDistance),
        maxVelocity: displayOptionalNumber(record.maxVelocity),
        playerLoad: displayOptionalNumber(record.playerLoad),
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

  const competitionLogic = useMemo(
    () => buildCompetitionLogic({ match: selectedMatch, records: matchRecords, players: data.players }),
    [selectedMatch, matchRecords, data.players],
  );
  const roleLoadAlerts = useMemo(
    () => buildRoleLoadControl({ players: data.players, competitionRecords: data.competitionRecords, internalLoads: data.internalLoads, externalLoads: data.externalLoads, referenceDate: selectedMatch?.date ?? filters.date, category: activeCategory, limit: 5 }),
    [data.players, data.competitionRecords, data.internalLoads, data.externalLoads, selectedMatch?.date, filters.date, activeCategory],
  );
  const returnToPlayAlerts = useMemo(
    () => buildReturnToPlayAlerts({ players: data.players, competitionRecords: data.competitionRecords, internalLoads: data.internalLoads, externalLoads: data.externalLoads, referenceDate: selectedMatch?.date ?? filters.date, category: activeCategory, limit: 5 }),
    [data.players, data.competitionRecords, data.internalLoads, data.externalLoads, selectedMatch?.date, filters.date, activeCategory],
  );
  const competitionInconsistencies = useMemo(
    () => buildDataInconsistencyAlerts({ players: data.players, internalLoads: data.internalLoads, externalLoads: data.externalLoads, competitionRecords: data.competitionRecords, referenceDate: selectedMatch?.date ?? filters.date, category: activeCategory, limit: 5 }),
    [data.players, data.internalLoads, data.externalLoads, data.competitionRecords, selectedMatch?.date, filters.date, activeCategory],
  );

  useEffect(() => {
    if (!selectedMatch) {
      setEyeballStats(null);
      setEyeballFirstHalfStats(null);
      setEyeballSecondHalfStats(null);
      return;
    }
    setEyeballStats((selectedMatch.eyeballStats as EyeballMatchStats | undefined) ?? null);
    setEyeballFirstHalfStats((selectedMatch.eyeballFirstHalfStats as EyeballMatchStats | undefined) ?? null);
    setEyeballSecondHalfStats((selectedMatch.eyeballSecondHalfStats as EyeballMatchStats | undefined) ?? null);
  }, [selectedMatch?.id]);

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
      const numberFields = [draft.minutesPlayed, draft.yellowCards, draft.redCards, draft.goals, draft.assists, draft.goalsConceded, draft.goalsPrevented, draft.penaltiesSaved, draft.crossesDefended, draft.footworkActions];
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
    const nextRecords = matchRecords.map((record) => {
      const draft = matchPlayerDrafts[record.id];
      if (!draft) return record;
      const player = data.players.find((item) => item.id === draft.playerId);
      const recordGoalkeeper = isGoalkeeper(player);
      return {
        ...record,
        playerId: draft.playerId,
        minutesPlayed: toNumber(draft.minutesPlayed),
        goals: recordGoalkeeper ? 0 : toNumber(draft.goals),
        assists: recordGoalkeeper ? 0 : toNumber(draft.assists),
        goalsConceded: recordGoalkeeper ? toNumber(draft.goalsConceded) : 0,
        goalsPrevented: recordGoalkeeper ? toNumber(draft.goalsPrevented) : 0,
        penaltiesSaved: recordGoalkeeper ? toNumber(draft.penaltiesSaved) : 0,
        crossesDefended: recordGoalkeeper ? toNumber(draft.crossesDefended) : 0,
        footworkActions: recordGoalkeeper ? toNumber(draft.footworkActions) : 0,
        yellowCards: toNumber(draft.yellowCards),
        redCards: toNumber(draft.redCards),
        startingRole: draft.startingRole,
        medicalStatus: draft.medicalStatus,
        medicalObservation: draft.medicalStatus === 'Lesionado' ? draft.medicalObservation.trim() : '',
        postCompetitionStatus: draft.medicalStatus === 'Lesionado' ? 'Lesionado' : 'Disponible',
        ...(recordGoalkeeper ? {} : {
          acc: toNumber(draft.acc),
          dcc: toNumber(draft.dcc),
          sprints: toNumber(draft.sprints),
          rhie: toNumber(draft.rhie),
          totalDistance: toNumber(draft.totalDistance) || undefined,
          highSpeedDistance: toNumber(draft.highSpeedDistance) || undefined,
          hsr: toNumber(draft.highSpeedDistance) || undefined,
          sprintDistance: toNumber(draft.sprintDistance) || undefined,
          maxVelocity: toNumber(draft.maxVelocity) || undefined,
          playerLoad: toNumber(draft.playerLoad) || undefined,
        }),
      };
    });
    saveCompetitionMatchBundle(selectedMatch, nextRecords);
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
      lineupFormation: selectedMatch?.id === id ? selectedMatch.lineupFormation : '4-2-3-1',
      lineupSlots: selectedMatch?.id === id ? selectedMatch.lineupSlots : buildFormationSlots('4-2-3-1'),
      opponentLogo: selectedMatch?.id === id ? selectedMatch.opponentLogo : undefined,
      eyeballStats: selectedMatch?.id === id ? selectedMatch.eyeballStats : eyeballStats ?? undefined,
      eyeballFirstHalfStats: selectedMatch?.id === id ? selectedMatch.eyeballFirstHalfStats : eyeballFirstHalfStats ?? undefined,
      eyeballSecondHalfStats: selectedMatch?.id === id ? selectedMatch.eyeballSecondHalfStats : eyeballSecondHalfStats ?? undefined,
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
      penaltiesSaved: displayNumber(record.penaltiesSaved),
      crossesDefended: displayNumber(record.crossesDefended),
      footworkActions: displayNumber(record.footworkActions),
      yellowCards: displayNumber(record.yellowCards),
      redCards: displayNumber(record.redCards),
      startingRole: record.startingRole ?? 'Titular',
      medicalStatus: record.medicalStatus ?? (record.postCompetitionStatus === 'Lesionado' ? 'Lesionado' : 'Sin lesión'),
      medicalObservation: record.medicalObservation ?? '',
      acc: displayNumber(record.acc ?? 0),
      dcc: displayNumber(record.dcc ?? 0),
      sprints: displayNumber(record.sprints ?? 0),
      rhie: displayNumber(record.rhie ?? 0),
      totalDistance: displayOptionalNumber(record.totalDistance),
      highSpeedDistance: displayOptionalNumber(record.highSpeedDistance ?? record.hsr),
      sprintDistance: displayOptionalNumber(record.sprintDistance),
      maxVelocity: displayOptionalNumber(record.maxVelocity),
      playerLoad: displayOptionalNumber(record.playerLoad),
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
    const numberFields = [playerDraft.minutesPlayed, playerDraft.yellowCards, playerDraft.redCards, playerDraft.goals, playerDraft.assists, playerDraft.goalsConceded, playerDraft.goalsPrevented, playerDraft.penaltiesSaved, playerDraft.crossesDefended, playerDraft.footworkActions];
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
      // GPS — solo jugadores de campo
      ...(goalkeeperRecord ? {} : {
        acc: toNumber(playerDraft.acc),
        dcc: toNumber(playerDraft.dcc),
        sprints: toNumber(playerDraft.sprints),
        rhie: toNumber(playerDraft.rhie),
        totalDistance: toNumber(playerDraft.totalDistance) || undefined,
        highSpeedDistance: toNumber(playerDraft.highSpeedDistance) || undefined,
        hsr: toNumber(playerDraft.highSpeedDistance) || undefined,
        sprintDistance: toNumber(playerDraft.sprintDistance) || undefined,
        maxVelocity: toNumber(playerDraft.maxVelocity) || undefined,
        playerLoad: toNumber(playerDraft.playerLoad) || undefined,
      }),
    };
    const record: CompetitionRecord = goalkeeperRecord
      ? {
        ...baseRecord,
        goals: 0,
        assists: 0,
        goalsConceded: toNumber(playerDraft.goalsConceded),
        goalsPrevented: toNumber(playerDraft.goalsPrevented),
        penaltiesSaved: toNumber(playerDraft.penaltiesSaved),
        crossesDefended: toNumber(playerDraft.crossesDefended),
        footworkActions: toNumber(playerDraft.footworkActions),
      }
      : {
        ...baseRecord,
        goals: toNumber(playerDraft.goals),
        assists: toNumber(playerDraft.assists),
        goalsConceded: undefined,
        goalsPrevented: undefined,
        penaltiesSaved: undefined,
        crossesDefended: undefined,
        footworkActions: undefined,
      };

    const nextRecords = editingRecord
      ? matchRecords.map((item) => item.id === record.id ? record : item)
      : [record, ...matchRecords];
    saveCompetitionMatchBundle(selectedMatch, nextRecords);
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

      <div className="card compact-card">
        <span className="section-eyebrow">Alertas del partido</span>
        <h3 style={{ margin: '4px 0 8px' }}>Incidencias importantes</h3>
        <div className="grid" style={{ gap: 8 }}>
          {medicalAlerts.length ? medicalAlerts.map((alert) => {
            const player = data.players.find(p => p.id === alert.playerId);
            return (
              <div key={alert.id} className={`alert-item tone-red`}>
                <strong>{player?.name || 'Jugador'}</strong> · {alert.medicalStatus || 'Sin estado'}<br />
                {alert.postCompetitionStatus || 'Sin observación'}
              </div>
            );
          }) : <div className="empty">Sin alertas médicas.</div>}
        </div>
      </div>

      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <span className="section-eyebrow">Paso 1</span><h3 style={{ margin: 0 }}>Datos generales del partido</h3>
            <div className="summary-chip" style={{ marginTop: 8 }}>Rival · Fecha · Local/Visitante · Resultado</div>
          </div>
          <div className="btn-row">
            <button type="button" className="btn secondary" onClick={resetMatchDraft}>Nuevo partido</button>
          </div>
        </div>

        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <div className="field">
            <label>Rival</label>
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
          <div className="grid grid-2">
            <div className="field">
              <label>Seleccionar partido</label>
              <select className="select" value={selectedMatch?.id ?? ''} onChange={(event) => setSelectedMatchId(event.target.value)}>
                {matchSummaries.map((match) => <option key={match.id} value={match.id}>{match.date} · {match.venue ?? 'Local'} vs {match.opponent} · {formatMatchScore(match)}</option>)}
              </select>
            </div>
            <div className="btn-row" style={{ alignSelf: 'end' }}>
              {selectedMatch ? <button type="button" className="btn secondary" onClick={() => startEditFullMatch(selectedMatch.id)}>Editar partido</button> : null}
              {selectedMatch ? <button type="button" className="btn danger" onClick={() => removeMatch(selectedMatch.id)}>Eliminar</button> : null}
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
            <div className="btn-row">
              <button type="button" className="btn secondary" onClick={resetPlayerDraft}>Limpiar jugador</button>
            </div>
          </div>

          <div className="grid grid-2">
            <div className="field"><label>Jugador</label><select className="select" value={playerDraft.playerId} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, playerId: event.target.value }))}>{playersBySource.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.position}</option>)}</select></div>
            <div className="field"><label>Minutos jugados</label><input className="input" min="0" type="number" value={playerDraft.minutesPlayed} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, minutesPlayed: event.target.value }))} /></div>
            <div className="field"><label>Titular / suplente</label><select className="select" value={playerDraft.startingRole} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, startingRole: event.target.value as CompetitionPlayerRole }))}>{starterOptions.map((option) => <option key={option}>{option}</option>)}</select></div>
          </div>

          {goalkeeper ? (
            <div className="grid grid-2" style={{ marginTop: 12 }}>
              <div className="field"><label>Goles encajados</label><input className="input" min="0" type="number" value={playerDraft.goalsConceded} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, goalsConceded: event.target.value }))} /></div>
              <div className="field"><label>Penaltis atajados</label><input className="input" min="0" type="number" value={playerDraft.penaltiesSaved} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, penaltiesSaved: event.target.value }))} /></div>
            </div>
          ) : (
            <div className="grid grid-2" style={{ marginTop: 12 }}>
              <div className="field"><label>Goles</label><input className="input" min="0" type="number" value={playerDraft.goals} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, goals: event.target.value }))} /></div>
              <div className="field"><label>Asistencias</label><input className="input" min="0" type="number" value={playerDraft.assists} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, assists: event.target.value }))} /></div>
            </div>
          )}

          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div className="field"><label>Tarjetas amarillas</label><input className="input" min="0" type="number" value={playerDraft.yellowCards} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, yellowCards: event.target.value }))} /></div>
            <div className="field"><label>Tarjeta roja</label><input className="input" min="0" max="1" type="number" value={playerDraft.redCards} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, redCards: event.target.value }))} /></div>
          </div>

          {playerDraft.medicalStatus === 'Lesionado' ? (
            <div className="field" style={{ marginTop: 12 }}>
              <label>Observación médica</label>
              <textarea className="input" value={playerDraft.medicalObservation} onChange={(event) => setPlayerDraft((prev) => ({ ...prev, medicalObservation: event.target.value }))} placeholder="Describe la lesión o la novedad médica" />
            </div>
          ) : null}

          <button type="button" className="btn" disabled={isSavingPlayer} onClick={savePlayerRecord}>{isSavingPlayer ? 'Guardando...' : editingRecordId ? 'Actualizar jugador' : 'Agregar jugador al partido'}</button>
        </div>
      ) : null}

      {selectedMatch ? (
        <div className="card no-print">
          <SectionHeader eyebrow="Alineación" title="Configurar alineación visual" subtitle="Selecciona el jugador, activa su puesto y haz clic en la cancha para ubicarlo manualmente." />
          <div className="competition-lineup-editor">
            <div className="grid grid-3">
              <div className="field"><label>Formación</label><select className="select" value={selectedFormation} onChange={(event) => changeLineupFormation(event.target.value as FormationKey)}>{formationOptions.map((formation) => <option key={formation} value={formation}>{formation}</option>)}</select></div>
              <div className="field"><label>Escudo rival</label><input className="input" type="file" accept="image/*" onChange={(event) => uploadOpponentLogo(event.target.files?.[0])} /></div>
              <div className="lineup-logo-preview">
                {selectedMatch.opponentLogo ? <img src={selectedMatch.opponentLogo} alt={selectedMatch.opponent} /> : <span>{selectedMatch.opponent.slice(0, 2).toUpperCase()}</span>}
                {selectedMatch.opponentLogo ? <button type="button" className="btn secondary" onClick={removeOpponentLogo}>Quitar escudo</button> : null}
              </div>
            </div>
            <div className="lineup-manual-grid">
              <div>
                <div className="lineup-manual-pitch" onClick={moveActiveLineupSlot}>
                  <div className="fd-pitch-title">{selectedFormation}</div>
                  <div className="orso-pitch-lines"><i /><i /><i /><i /></div>
                  {selectedLineupSlots.map((slot) => {
                    const playerName = lineupPlayerOptions.find(({ record }) => record.playerId === slot.playerId)?.player?.name ?? '';
                    return (
                      <button
                        type="button"
                        key={slot.id}
                        className={`lineup-manual-chip ${activeLineupSlotId === slot.id ? 'active' : ''} ${playerName ? '' : 'empty'}`}
                        style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                        onClick={(event) => { event.stopPropagation(); setActiveLineupSlotId(slot.id); }}
                      >
                        <strong>{playerName || 'Vacío'}</strong><span>{slot.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="lineup-nudge-row">
                  <button type="button" className="btn secondary" onClick={() => nudgeActiveLineupSlot(0, -3)}>Arriba</button>
                  <button type="button" className="btn secondary" onClick={() => nudgeActiveLineupSlot(-3, 0)}>Izquierda</button>
                  <button type="button" className="btn secondary" onClick={() => nudgeActiveLineupSlot(3, 0)}>Derecha</button>
                  <button type="button" className="btn secondary" onClick={() => nudgeActiveLineupSlot(0, 3)}>Abajo</button>
                </div>
              </div>
              <div className="lineup-slot-grid compact-lineup-slots">
                {selectedLineupSlots.map((slot) => (
                  <div className={`lineup-slot-field ${activeLineupSlotId === slot.id ? 'active' : ''}`} key={slot.id} onClick={() => setActiveLineupSlotId(slot.id)}>
                    <label>{slot.label} · {slot.line}</label>
                    <select className="select" value={slot.playerId ?? ''} onChange={(event) => assignLineupPlayer(slot.id, event.target.value)}>
                      <option value="">Seleccionar jugador</option>
                      {lineupPlayerOptions.map(({ record, player }) => <option key={`${slot.id}-${record.id}`} value={record.playerId}>{player?.name ?? 'Jugador'} · {player?.position ?? '-'}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
              {supportsGps(activeCategory) ? <button type="button" className="btn secondary" onClick={() => setShowGpsCsv(true)}>Importar CSV GPS</button> : null}
              <button type="button" className="btn secondary" onClick={() => setShowGroupReport((value) => !value)}>{showGroupReport ? 'Ocultar vista previa' : 'Ver informe completo'}</button>
              <select className="select" value={reportStyle} onChange={(e) => setReportStyle(e.target.value as 'classic' | 'premium')}>
                <option value="classic">Reporte Clásico</option>
                <option value="premium">Reporte Premium</option>
              </select>
              <button type="button" className="btn" onClick={exportCleanPdf}>Generar PDF limpio</button>
            </div>
          </div>
          {showGroupReport && competitionReport ? (
            <div style={{ marginTop: 16 }}>
              {reportStyle === 'classic' ? (
                <CompetitionReportTemplate report={competitionReport} category={activeCategory} eyeballStats={eyeballStats} eyeballFirstHalfStats={eyeballFirstHalfStats} eyeballSecondHalfStats={eyeballSecondHalfStats} />
              ) : (
                <PremiumCompetitionReport report={competitionReport} />
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── EYEBALL — integrado al informe de competencia ─────────── */}
      {selectedMatch ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <span className="section-eyebrow">Eyeball</span>
              <h3 style={{ margin: '4px 0 0' }}>CSV Eyeball del partido</h3>
              <div className="muted-line" style={{ marginTop: 4 }}>Puedes importar partido completo, primer tiempo y segundo tiempo. El informe usará cada archivo para tablas y gráficas por periodo.</div>
            </div>
            <button type="button" className="btn secondary" onClick={() => { setEyeballStats(null); setEyeballFirstHalfStats(null); setEyeballSecondHalfStats(null); setEyeballFile(''); setEyeballFirstHalfFile(''); setEyeballSecondHalfFile(''); setEyeballError(''); if (selectedMatch) upsertCompetitionMatchSummary({ ...selectedMatch, eyeballStats: undefined, eyeballFirstHalfStats: undefined, eyeballSecondHalfStats: undefined }); }}>
              <XIcon size={13} /> Limpiar Eyeball
            </button>
          </div>

          <div className="grid grid-3">
            <label className="file-upload-card">
              <UploadIcon size={22} />
              <strong>Partido completo</strong>
              <span>{eyeballFile || 'CSV general Eyeball'}</span>
              <input type="file" accept=".csv,.txt" onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processEyeballFile(f, 'full'); }} />
            </label>
            <label className="file-upload-card">
              <UploadIcon size={22} />
              <strong>Primer tiempo</strong>
              <span>{eyeballFirstHalfFile || 'CSV 1T Eyeball'}</span>
              <input type="file" accept=".csv,.txt" onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processEyeballFile(f, 'first'); }} />
            </label>
            <label className="file-upload-card">
              <UploadIcon size={22} />
              <strong>Segundo tiempo</strong>
              <span>{eyeballSecondHalfFile || 'CSV 2T Eyeball'}</span>
              <input type="file" accept=".csv,.txt" onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processEyeballFile(f, 'second'); }} />
            </label>
          </div>
          {eyeballError && <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13, fontWeight: 700 }}>⚠ {eyeballError}</div>}
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
              <tr><th>Jugador</th><th>Posición</th><th>Rol</th><th>MIN</th><th>G/A o Portero</th><th>Tarjetas</th><th>GPS</th><th>Estado médico</th><th>Observación</th><th>Acciones</th></tr>
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
                    <td>{editingMatchPlayers ? (recordGoalkeeper ? <div className="btn-row" style={{ flexWrap: 'wrap' }}><input className="input compact-input" type="number" min="0" placeholder="GE" value={draft.goalsConceded} onChange={(event) => updateMatchPlayerDraft(record.id, { goalsConceded: event.target.value })} /><input className="input compact-input" type="number" min="0" placeholder="EV" value={draft.goalsPrevented} onChange={(event) => updateMatchPlayerDraft(record.id, { goalsPrevented: event.target.value })} /><input className="input compact-input" type="number" min="0" placeholder="PEN" value={draft.penaltiesSaved} onChange={(event) => updateMatchPlayerDraft(record.id, { penaltiesSaved: event.target.value })} /><input className="input compact-input" type="number" min="0" placeholder="CEN" value={draft.crossesDefended} onChange={(event) => updateMatchPlayerDraft(record.id, { crossesDefended: event.target.value })} /><input className="input compact-input" type="number" min="0" placeholder="PIE" value={draft.footworkActions} onChange={(event) => updateMatchPlayerDraft(record.id, { footworkActions: event.target.value })} /></div> : <div className="btn-row"><input className="input compact-input" type="number" min="0" placeholder="G" value={draft.goals} onChange={(event) => updateMatchPlayerDraft(record.id, { goals: event.target.value })} /><input className="input compact-input" type="number" min="0" placeholder="A" value={draft.assists} onChange={(event) => updateMatchPlayerDraft(record.id, { assists: event.target.value })} /></div>) : recordGoalkeeper ? `GE ${record.goalsConceded ?? 0} · EV ${record.goalsPrevented ?? 0} · PEN ${record.penaltiesSaved ?? 0} · CEN ${record.crossesDefended ?? 0} · PIE ${record.footworkActions ?? 0}` : `G ${record.goals ?? 0} · A ${record.assists ?? 0}`}</td>
                    <td>{editingMatchPlayers ? <div className="btn-row"><input className="input compact-input" type="number" min="0" value={draft.yellowCards} onChange={(event) => updateMatchPlayerDraft(record.id, { yellowCards: event.target.value })} /><input className="input compact-input" type="number" min="0" max="1" value={draft.redCards} onChange={(event) => updateMatchPlayerDraft(record.id, { redCards: event.target.value })} /></div> : <>TA {record.yellowCards ?? 0} · TR {record.redCards ?? 0}</>}</td>
                    <td>{recordGoalkeeper ? '—' : `${Math.round(record.totalDistance ?? 0)} m · PL ${Math.round(record.playerLoad ?? 0)}`}</td>
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

      {showGpsCsv && selectedMatch ? (
        <CsvImporter
          players={gpsPlayersForImport}
          sessionId={selectedMatch.id}
          date={selectedMatch.date}
          microcycleId=""
          sessionNumber={1}
          category={activeCategory}
          actingCategory={activeCategory}
          movementModule="competencia"
          title="Importar CSV GPS de competencia"
          description="Carga el CTR Report de Catapult o un CSV GPS compatible del partido. El importador crea o actualiza jugadores de campo dentro de la planilla del partido seleccionado."
          importLabel="registros GPS de competencia"
          onImport={handleCompetitionGpsImport}
          onClose={() => setShowGpsCsv(false)}
        />
      ) : null}

      {competitionReport ? <CompetitionReportTemplate report={competitionReport} category={activeCategory} className="print-only" eyeballStats={eyeballStats} eyeballFirstHalfStats={eyeballFirstHalfStats} eyeballSecondHalfStats={eyeballSecondHalfStats} /> : null}
    </div>
  );
}
