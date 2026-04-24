'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { isStaffAuthenticated } from '@/lib/auth';

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

    if (isLogin) {
      if (authed) {
        router.replace('/');
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
