'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MobileNavigation, Sidebar } from '@/components/sidebar';
import { ContextTopBar } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getAllowedCategory, getStaffSession, isStaffAuthenticated, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { findMicrocycleByDate } from '@/lib/utils';
import { formatDateShort } from '@/lib/operational-helpers';

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { data, filters, backendMode } = useApp();
  const [allowed, setAllowed] = useState(false);

  const normalizedPathname = pathname.toLowerCase().replace(/\/$/, '');
  const isCategoryWellness = ['/wellness/u20', '/wellness/u17', '/wellness/u15', '/wellness/sub20', '/wellness/sub17', '/wellness/sub15'].includes(normalizedPathname);
  const isPlayerWellness = pathname.startsWith('/wellness-jugadores') || isCategoryWellness;
  const isLogin = pathname.startsWith('/login');
  const isResetPassword = pathname.startsWith('/reset-password');

  useEffect(() => {
    if (isPlayerWellness || isResetPassword) {
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

    setAllowed(true);
  }, [pathname, router, isPlayerWellness, isLogin, isResetPassword]);

  const topContext = useMemo(() => {
    const session = getStaffSession();
    const category = getAllowedCategory(session);
    const activeCategory = isMasterRole(session) ? filters.category : category;
    const microcycle = filters.date
      ? findMicrocycleByDate(data.microcycles, filters.date, filters.microcycleId, activeCategory)
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

  if (isPlayerWellness || isLogin || isResetPassword) {
    const publicClassName = isPlayerWellness ? 'main main-public main-public-wellness' : 'main main-public';
    return <main className={publicClassName}>{children}</main>;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <MobileNavigation />
      <main className="main mobile-safe-page">
        <ContextTopBar {...topContext} />
        {children}
      </main>
    </div>
  );
};
