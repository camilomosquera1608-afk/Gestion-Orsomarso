'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Database, ShieldCheck, Trophy } from 'lucide-react';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { findMicrocycleByDate } from '@/lib/utils';
import { ORSOMARSO_BRAND } from '@/lib/design-system';

const formatDate = (value: string) => {
  if (!value) return 'Sin fecha activa';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

// FIX #3: heroClass permite que cada módulo tenga su propio color de acento.
// Cada página pasa su clase: hero-wellness, hero-carga, hero-competencia, etc.
export const AppHero = ({
  title,
  subtitle,
  heroClass = '',
}: {
  title: string;
  subtitle?: string;
  heroClass?: string;
  badgeTitle?: string;
  badgeText?: string;
}) => {
  const { data, filters, backendMode } = useApp();
  const [contextLabel, setContextLabel] = useState(ORSOMARSO_BRAND.tagline);

  useEffect(() => {
    const session = getStaffSession();
    const suffix = session.role === 'master' ? 'Maestro' : session.category !== 'all' ? categoryLabel(session.category) : '';
    setContextLabel(`${ORSOMARSO_BRAND.product}${suffix ? ` · ${suffix}` : ''}`);
  }, []);

  const activeMicrocycle = useMemo(() => {
    const activeCategory = isMasterRole(getStaffSession()) ? filters.category : getStaffSession().category;
    if (filters.date) return findMicrocycleByDate(data.microcycles, filters.date, filters.microcycleId, activeCategory);
    return data.microcycles.find((item) => item.id === filters.microcycleId && (activeCategory === 'all' || (item.category ?? 'Sub20') === activeCategory));
  }, [data.microcycles, filters.category, filters.date, filters.microcycleId]);

  const microcycleText = activeMicrocycle
    ? activeMicrocycle.startDate && activeMicrocycle.endDate
      ? `${activeMicrocycle.name} · ${formatDate(activeMicrocycle.startDate)} - ${formatDate(activeMicrocycle.endDate)}`
      : `${activeMicrocycle.name} · sin rango`
    : 'Sin microciclo asignado';

  return (
    <section className={`hero premium-hero ${heroClass}`}>
      <div className="hero-main">
        <div className="hero-eyebrow"><Trophy size={15} />{contextLabel}</div>
        <h2>{title}</h2>
        {subtitle ? <p className="hero-subtitle-app">{subtitle}</p> : null}
      </div>
      <div className="hero-context-card" aria-label="Contexto activo">
        <span className="hero-context-pill"><CalendarDays size={15} />{formatDate(filters.date)}</span>
        <span className="hero-context-pill"><ShieldCheck size={15} />{microcycleText}</span>
        <span className="hero-context-pill"><Database size={15} />{backendMode === 'supabase' ? 'Supabase' : 'Local seguro'}</span>
      </div>
    </section>
  );
};
