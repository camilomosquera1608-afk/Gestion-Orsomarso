'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity, BarChart3, Bell, Briefcase, ChevronDown, Dumbbell,
  FileText, Gauge, HeartPulse, LogOut, Medal, Menu, Settings,
  ShieldCheck, TimerReset, TrendingUp, Trophy, UserRoundPlus,
  Users, X, Home, type LucideIcon } from 'lucide-react';
import { categoryLabel } from '@/lib/labels';
import { hasAdministrationAccess } from '@/lib/access-control';
import { getStaffSession, logoutStaff } from '@/lib/auth';
import { signOutSupabase, tableSchemaSyncEnabled } from '@/lib/supabase';
import { useApp } from '@/context/app-context';

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: 'Dashboard',
    items: [
      { href: '/', label: 'Inicio', icon: Home },
      { href: '/diario', label: 'Diario operativo', icon: Gauge },
    ] },
  {
    label: 'Planificación',
    items: [
      { href: '/microciclo', label: 'Microciclo', icon: Activity },
      { href: '/sesion-entrenamiento', label: 'Sesión', icon: TimerReset },
      { href: '/fuerza', label: 'Fuerza', icon: Dumbbell },
      { href: '/competencia', label: 'Competencia', icon: Trophy },
      { href: '/competencia/analisis-tactico', label: 'Análisis táctico', icon: TrendingUp },
    ] },
  {
    label: 'Rendimiento',
    items: [
      { href: '/carga', label: 'Centro de carga', icon: Dumbbell },
      { href: '/wellness', label: 'Wellness', icon: ShieldCheck },
      { href: '/disponibilidad', label: 'Disponibilidad', icon: HeartPulse },
    ] },
  {
    label: 'Plantilla',
    items: [
      { href: '/jugadores', label: 'Jugadores', icon: Users },
      { href: '/registro', label: 'Nuevo jugador', icon: UserRoundPlus },
      { href: '/valoraciones', label: 'Valoraciones', icon: BarChart3 },
    ] },
  {
    label: 'Análisis',
    items: [
      { href: '/informes', label: 'Centro informes', icon: Briefcase },
      { href: '/reporte-jugador', label: 'Reporte jugador', icon: FileText },
      { href: '/informes/grupo', label: 'Informes grupo', icon: Briefcase },
      { href: '/ranking', label: 'Ranking', icon: Medal },
    ] },
];

function DropdownMenu({ group, onClose }: { group: NavGroup; onClose: () => void }) {
  const pathname = usePathname();
  return (
    <div className="tn-dropdown">
      {group.items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`tn-dropdown-item ${active ? 'active' : ''}`}
            onClick={onClose}
          >
            <Icon size={15} strokeWidth={active ? 2.5 : 2} />
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
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const displayName = session.displayName || session.email?.split('@')[0] || 'Staff';
  const displayCategory = session.category === 'all' ? 'Todas' : categoryLabel(session.category);

  const allGroups = hasAdministrationAccess(session)
    ? [...groups, { label: 'Sistema', items: [{ href: '/administracion', label: 'Administración', icon: ShieldCheck }, { href: '/configuracion', label: 'Configuración', icon: Settings }] }]
    : [...groups, { label: 'Sistema', items: [{ href: '/configuracion', label: 'Configuración', icon: Settings }] }];

  useEffect(() => {
    const handler = (e: globalThis.MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setOpenGroup(null); setMobileOpen(false); }, [pathname]);

  const syncDot = syncStatus === 'syncing' ? '#f59e0b' : syncStatus === 'error' ? '#ef4444' : '#22c55e';

  return (
    <nav className="tn-bar" ref={navRef}>
      {/* Brand */}
      <div className="tn-brand">
        <div className="tn-logo">
          <Image src="/orsomarso-crest.jpg" alt="Orsomarso SC" width={32} height={32} priority />
        </div>
        <div className="tn-brand-text">
          <span className="tn-brand-club">Orsomarso SC</span>
          <span className="tn-brand-product">Performance</span>
        </div>
      </div>

      {/* Desktop groups */}
      <div className="tn-groups">
        {allGroups.map((group) => {
          const hasActive = group.items.some(
            (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          );
          const isOpen = openGroup === group.label;
          return (
            <div key={group.label} className="tn-group-wrap">
              <button
                type="button"
                className={`tn-group-btn ${hasActive ? 'has-active' : ''} ${isOpen ? 'open' : ''}`}
                onClick={() => setOpenGroup(isOpen ? null : group.label)}
              >
                {group.label}
                <ChevronDown size={13} />
              </button>
              {isOpen && <DropdownMenu group={group} onClose={() => setOpenGroup(null)} />}
            </div>
          );
        })}
      </div>

      {/* Right — user + sync */}
      <div className="tn-right">
        <div className="tn-sync" title={`Sync: ${syncStatus}`}>
          <span className="tn-sync-dot" style={{ background: syncDot }} />
          <span>{tableSchemaSyncEnabled ? 'Supabase' : 'Local'}</span>
        </div>
        <div className="tn-user">
          <div className="tn-user-avatar">{displayName.slice(0, 2).toUpperCase()}</div>
          <div className="tn-user-info">
            <span className="tn-user-name">{displayName}</span>
            <span className="tn-user-role">{displayCategory}</span>
          </div>
        </div>
        <button
          type="button"
          className="tn-logout"
          onClick={async () => {
            await signOutSupabase();
            logoutStaff();
            router.push('/login');
          }}
          title="Cerrar sesión"
        >
          <LogOut size={15} />
        </button>
        <button type="button" className="tn-mobile-menu-btn" onClick={() => setMobileOpen((v) => !v)}>
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="tn-mobile-panel">
          {allGroups.map((group) => (
            <div key={group.label} className="tn-mobile-group">
              <div className="tn-mobile-group-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} className={`tn-mobile-item ${active ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
          <button type="button" className="tn-mobile-logout" onClick={async () => { await signOutSupabase(); logoutStaff(); router.push('/login'); }}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      )}
    </nav>
  );
}
