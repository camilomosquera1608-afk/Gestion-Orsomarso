'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Bell,
  Briefcase,
  Dumbbell,
  FileText,
  Gauge,
  HeartPulse,
  Home,
  LogOut,
  Medal,
  Settings,
  ShieldCheck as AdminShield,
  ShieldCheck,
  TimerReset,
  Trophy,
  UserRoundPlus,
  Users,
} from 'lucide-react';
import { categoryLabel } from '@/lib/labels';
import { getStaffSession, logoutStaff } from '@/lib/auth';
import { signOutSupabase, tableSchemaSyncEnabled } from '@/lib/supabase';
import { ORSOMARSO_BRAND } from '@/lib/design-system';

const staffGroups = [
  {
    title: 'Ejecutivo',
    items: [
      { href: '/', label: 'Inicio', icon: Home },
      { href: '/ejecutivo', label: 'Panel ejecutivo', icon: Briefcase },
      { href: '/diario', label: 'Diario', icon: Gauge },
      { href: '/microciclo', label: 'Microciclo', icon: Activity },
      { href: '/sesion-entrenamiento', label: 'Sesión', icon: TimerReset },
    ],
  },
  {
    title: 'Rendimiento',
    items: [
      { href: '/disponibilidad', label: 'Disponibilidad', icon: HeartPulse },
      { href: '/carga', label: 'Carga', icon: Dumbbell },
      { href: '/wellness', label: 'Wellness', icon: ShieldCheck },
      { href: '/alertas', label: 'Alertas', icon: Bell },
    ],
  },
  {
    title: 'Operativo',
    items: [
      { href: '/jugadores', label: 'Jugadores', icon: Users },
      { href: '/registro', label: 'Registro', icon: UserRoundPlus },
      { href: '/valoraciones', label: 'Valoraciones', icon: BarChart3 },
      { href: '/competencia', label: 'Competencia', icon: Trophy },
    ],
  },
  {
    title: 'Reportes',
    items: [
      { href: '/informes', label: 'Informes', icon: FileText },
      { href: '/ranking', label: 'Ranking', icon: Medal },
    ],
  },
  {
    title: 'Sistema',
    items: [{ href: '/configuracion', label: 'Configuración', icon: Settings }],
  },
];

const masterGroups = [
  {
    title: 'Dirección',
    items: [
      { href: '/ejecutivo', label: 'Panel ejecutivo', icon: Briefcase },
      { href: '/disponibilidad', label: 'Disponibilidad', icon: HeartPulse },
      { href: '/carga', label: 'Carga', icon: Dumbbell },
      { href: '/wellness', label: 'Wellness', icon: ShieldCheck },
      { href: '/alertas', label: 'Alertas', icon: Bell },
      { href: '/informes', label: 'Informes', icon: FileText },
      { href: '/ranking', label: 'Ranking', icon: Medal },
      { href: '/jugadores', label: 'Jugadores', icon: Users },
    ],
  },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const session = getStaffSession();
  const groups = session.platformRole === 'admin'
    ? staffGroups.map((group) => group.title === 'Sistema'
        ? { ...group, items: [{ href: '/administracion', label: 'Administración', icon: AdminShield }, ...group.items] }
        : group)
    : staffGroups;
  const displayCategory = session.category === 'all' ? 'Todas' : categoryLabel(session.category);

  return (
    <aside className="sidebar premium-sidebar">
      <div className="brand premium-brand">
        <div className="brand-mark">
          <Image src="/orsomarso-crest.jpg" alt="Escudo Orsomarso SC" width={54} height={54} priority />
        </div>
        <div className="brand-copy">
          <small>{ORSOMARSO_BRAND.club}</small>
          <h1>{ORSOMARSO_BRAND.product}</h1>
          <span>{displayCategory}</span>
        </div>
      </div>

      <div className="sidebar-status">
        <ShieldCheck size={16} />
        <div>
          <strong>{session.authProvider === 'supabase' ? 'Supabase' : 'Demo local'}</strong>
          <span>{tableSchemaSyncEnabled ? 'Conexión remota' : 'Modo local'}</span>
        </div>
      </div>

      <nav className="nav" aria-label="Navegación principal">
        {groups.map((group) => (
          <div className="nav-group" key={group.title}>
            <div className="nav-group-title">{group.title}</div>
            <div className="nav-group-items">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} className={`nav-link ${active ? 'active' : ''}`}>
                    <Icon size={18} strokeWidth={2.2} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <button
        type="button"
        className="nav-link nav-logout"
        onClick={async () => {
          await signOutSupabase();
          logoutStaff();
          router.push('/login');
        }}
      >
        <LogOut size={18} />
        <span>Cerrar sesión</span>
      </button>
    </aside>
  );
};
