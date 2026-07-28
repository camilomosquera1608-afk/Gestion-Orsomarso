'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Briefcase,
  CalendarDays,
  ChevronDown,
  Database,
  FileText,
  Gauge,
  HeartPulse,
  Home,
  LogOut,
  Settings,
  ShieldCheck,
  TimerReset,
  TrendingUp,
  Trophy,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { categoryLabel } from '@/lib/labels';
import { hasAdministrationAccess } from '@/lib/access-control';
import { getStaffSession, logoutStaff } from '@/lib/auth';
import { signOutSupabase, tableSchemaSyncEnabled } from '@/lib/supabase';
import { useApp } from '@/context/app-context';

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; icon: LucideIcon; items: NavItem[] };

const getGroups = (session: ReturnType<typeof getStaffSession>): NavGroup[] => {
  const isAdmin = hasAdministrationAccess(session);
  return [
    {
      label: 'Inicio',
      icon: Home,
      items: [
        { href: '/', label: 'Inicio', icon: Home },
        { href: '/diario', label: 'Diario operativo', icon: Gauge },
      ],
    },
    {
      label: 'Planificación',
      icon: TimerReset,
      items: [
        { href: '/plan-diario', label: 'Plan diario', icon: CalendarDays },
        { href: '/microciclo', label: 'Microciclo', icon: Activity },
        { href: '/sesion-entrenamiento', label: 'Sesión', icon: TimerReset },
        { href: '/competencia', label: 'Competencia', icon: Trophy },
      ],
    },
    {
      label: 'Control de carga',
      icon: TrendingUp,
      items: [
        { href: '/carga', label: 'Resumen carga/riesgo', icon: Gauge },
        { href: '/riesgo', label: 'Riesgo detallado', icon: TrendingUp },
        { href: '/wellness', label: 'Wellness', icon: ShieldCheck },
        { href: '/disponibilidad', label: 'Disponibilidad', icon: HeartPulse },
        { href: '/adherencia', label: 'Calidad del dato', icon: Database },
      ],
    },
    {
      label: 'Jugadores',
      icon: Users,
      items: [
        { href: '/jugadores', label: 'Plantilla', icon: Users },
        { href: '/registro', label: 'Nuevo registro', icon: UserRoundPlus },
        { href: '/valoraciones', label: 'Valoraciones', icon: BarChart3 },
      ],
    },
    {
      label: 'Informes',
      icon: FileText,
      items: [
        { href: '/informes', label: 'Centro informes', icon: Briefcase },
        { href: '/informes/jugador-periodo', label: 'Informe individual', icon: FileText },
        { href: '/informes/grupo', label: 'Informe grupo', icon: Briefcase },
        { href: '/informes/semanal', label: 'Informe semanal', icon: CalendarDays },
      ],
    },
    ...(isAdmin
      ? [
          {
            label: 'Sistema',
            icon: Settings,
            items: [
              { href: '/administracion', label: 'Administración', icon: ShieldCheck },
              { href: '/configuracion', label: 'Configuración', icon: Settings },
            ],
          },
        ]
      : [
          {
            label: 'Sistema',
            icon: Settings,
            items: [{ href: '/configuracion', label: 'Configuración', icon: Settings }],
          },
        ]),
  ];
};

function DropdownMenu({ group, onClose }: { group: NavGroup; onClose: () => void }) {
  const pathname = usePathname();
  return (
    <div className="tnav-dropdown">
      {group.items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`tnav-dropdown-item ${active ? 'active' : ''}`}
            onClick={onClose}
          >
            <span className="tnav-dd-icon"><Icon size={15} /></span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { syncStatus } = useApp();
  const session = getStaffSession();
  const groups = getGroups(session);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const displayName = session.displayName || session.email?.split('@')[0] || 'Staff';
  const catLabel = session.category === 'all' ? 'Todas' : categoryLabel(session.category);

  const syncDot = syncStatus === 'syncing' ? '#f59e0b' : syncStatus === 'error' ? '#ef4444' : '#22c55e';

  useEffect(() => {
    const handler = (event: globalThis.MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setOpenGroup(null); }, [pathname]);

  return (
    <nav className="tnav" ref={navRef}>
      <Link href="/" className="tnav-brand">
        <div className="tnav-crest">
          <Image src="/orsomarso-crest.jpg" alt="Orsomarso SC" width={28} height={28} priority />
        </div>
        <div className="tnav-brand-text">
          <span className="tnav-club">Orsomarso SC</span>
        </div>
      </Link>

      <div className="tnav-groups">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = openGroup === group.label;
          const hasActive = group.items.some(
            (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)),
          );
          return (
            <div key={group.label} className="tnav-group-wrap">
              <button
                type="button"
                className={`tnav-group-btn ${isOpen ? 'open' : ''} ${hasActive ? 'has-active' : ''}`}
                onClick={() => setOpenGroup(isOpen ? null : group.label)}
              >
                <GroupIcon size={15} />
                <span>{group.label}</span>
                <ChevronDown size={13} className={`tnav-chevron ${isOpen ? 'rotated' : ''}`} />
              </button>
              {isOpen && <DropdownMenu group={group} onClose={() => setOpenGroup(null)} />}
            </div>
          );
        })}
      </div>

      <div className="tnav-right">
        <div className="tnav-sync" title={syncStatus}>
          <span className="tnav-sync-dot" style={{ background: syncDot }} />
          <span>{tableSchemaSyncEnabled ? 'Supabase' : 'Local'}</span>
        </div>
        <div className="tnav-user">
          <div className="tnav-avatar">{displayName.slice(0, 2).toUpperCase()}</div>
          <div className="tnav-user-info">
            <span className="tnav-user-name">{displayName}</span>
            <span className="tnav-user-role">{catLabel}</span>
          </div>
        </div>
        <button
          type="button"
          className="tnav-logout"
          onClick={async () => {
            await signOutSupabase();
            logoutStaff();
            router.push('/login');
          }}
          title="Cerrar sesión"
        >
          <LogOut size={15} />
        </button>
      </div>
    </nav>
  );
}

export { MobileNavigation } from './sidebar';
