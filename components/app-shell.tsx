'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { getAllowedCategory, getStaffSession, isStaffAuthenticated, isMasterRole } from '@/lib/auth';

const MASTER_ALLOWED = ['/informes', '/jugadores'];

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
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

  if (!allowed) return <main className="main main-public"><div className="empty">Cargando acceso…</div></main>;

  if (isPlayerWellness || isLogin) {
    return <main className="main main-public">{children}</main>;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  );
};
