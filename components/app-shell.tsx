'use client';

import { useEffect, useMemo, useState , type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/top-nav';
import { TopNav } from '@/components/top-nav';
import { ContextTopBar, ToastContainer } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getAllowedCategory, getStaffSession, isStaffAuthenticated, isMasterRole, logoutStaff } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { findMicrocycleByDate } from '@/lib/utils';
import { formatDateShort } from '@/lib/operational-helpers';
import { hasSupabaseConfig, supabase, tableSchemaSyncEnabled } from '@/lib/supabase';

export const AppShell = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { data, filters, backendMode, syncStatus, writeValidationMessage } = useApp();
  const [allowed, setAllowed] = useState(false);

  const normalizedPathname = pathname.toLowerCase().replace(/\/$/, '');
  const isCategoryWellness = ['/wellness/u20', '/wellness/u17', '/wellness/u15', '/wellness/sub20', '/wellness/sub17', '/wellness/sub15'].includes(normalizedPathname);
  const isPlayerWellness = pathname.startsWith('/wellness-jugadores') || isCategoryWellness;
  const isLogin = pathname.startsWith('/login');
  const isResetPassword = pathname.startsWith('/reset-password');

  useEffect(() => {
    let cancelled = false;

    const validateAccess = async () => {
      if (isPlayerWellness || isResetPassword) {
        if (!cancelled) setAllowed(true);
        return;
      }

      const authed = isStaffAuthenticated();
      const session = getStaffSession();

      if (isLogin) {
        if (authed) {
          router.replace(session.role === 'master' ? '/informes/jugador-periodo' : '/');
          return;
        }
        if (!cancelled) setAllowed(true);
        return;
      }

      if (!authed) {
        router.replace('/login');
        return;
      }

      if (hasSupabaseConfig && tableSchemaSyncEnabled && supabase && session.authProvider === 'supabase') {
        let supabaseSession = (await supabase.auth.getSession()).data.session;
        if (!supabaseSession) {
          await new Promise((resolve) => setTimeout(resolve, 350));
          supabaseSession = (await supabase.auth.getSession()).data.session;
        }
        if (!supabaseSession) {
          logoutStaff();
          router.replace('/login');
          return;
        }
      }

      if (!cancelled) setAllowed(true);
    };

    setAllowed(false);
    void validateAccess();

    return () => {
      cancelled = true;
    };
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
    <div className="app-shell-top">
      <TopNav />
      <MobileNavigation />
      <main className="main mobile-safe-page">
        <ContextTopBar {...topContext} syncStatus={syncStatus} validationMessage={writeValidationMessage} />
        {children}
        <ToastContainer />
      </main>
    </div>
  );
};
