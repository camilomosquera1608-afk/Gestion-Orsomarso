'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { ContextTopBar } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getAllowedCategory, getStaffSession, isStaffAuthenticated, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { findMicrocycleByDate } from '@/lib/utils';
import { formatDateShort } from '@/lib/operational-helpers';

const MASTER_ALLOWED = ['/ejecutivo', '/disponibilidad', '/carga', '/wellness', '/alertas', '/informes', '/jugadores', '/ranking'];

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { data, filters, backendMode } = useApp();
  const [allowed, setAllowed] = useState(false);

  const isPlayerWellness = pathname.startsWith('/wellness-jugadores');
  const isLogin = pathname.startsWith('/login');

  useEffect(() => {
    if (isPlayerWellness) {
      setAllowed(true);
      return;
    }

    const authed = isStaffAuthenticated();
    const session = getStaffSession();

    if (isLogin) {
      if (authed) {
        router.replace(session.role === 'master' ? '/informes' : '/');
        return;
      }
      setAllowed(true);
      return;
    }

    if (!authed) {
      router.replace('/login');
      return;
    }

    if (isMasterRole(session)) {
      const isAllowedRoute = MASTER_ALLOWED.some((route) => pathname === route || pathname.startsWith(`${route}/`));
      if (!isAllowedRoute) {
        router.replace('/informes');
        return;
      }
    }

    setAllowed(true);
  }, [pathname, router, isPlayerWellness, isLogin]);

  const topContext = useMemo(() => {
    const session = getStaffSession();
    const category = getAllowedCategory(session);
    const activeCategory = isMasterRole(session) ? filters.category : category;
    const microcycle = filters.date
      ? findMicrocycleByDate(data.microcycles, filters.date, filters.microcycleId)
      : data.microcycles.find((item) => item.id === filters.microcycleId);
    const microcycleLabel = microcycle
      ? microcycle.startDate && microcycle.endDate
        ? `${microcycle.name} · ${formatDateShort(microcycle.startDate)}-${formatDateShort(microcycle.endDate)}`
        : `${microcycle.name} · sin rango`
      : 'Sin microciclo';
    return {
      date: formatDateShort(filters.date),
      microcycle: microcycleLabel,
      category: activeCategory === 'all' ? 'Todas' : categoryLabel(activeCategory),
      mode: backendMode === 'supabase' ? 'Supabase remoto' : 'Local seguro',
    };
  }, [backendMode, data.microcycles, filters.category, filters.date, filters.microcycleId]);

  if (!allowed) return <main className="main main-public"><div className="empty">Cargando acceso…</div></main>;

  if (isPlayerWellness || isLogin) {
    return <main className="main main-public">{children}</main>;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <ContextTopBar {...topContext} />
        {children}
      </main>
    </div>
  );
};
