import { categoryLabel } from '@/lib/labels';
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, BarChart3, FileText, Gauge, Home, LogOut, Medal, Settings, TimerReset, Trophy, UserRoundPlus, Users } from 'lucide-react';
import { getStaffSession, logoutStaff } from '@/lib/auth';

const staffItems = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/diario', label: 'Diario', icon: Gauge },
  { href: '/microciclo', label: 'Microciclo', icon: Activity },
  { href: '/sesion-entrenamiento', label: 'Sesión', icon: TimerReset },
  { href: '/valoraciones', label: 'Valoraciones', icon: BarChart3 },
  { href: '/competencia', label: 'Competencia', icon: Trophy },
  { href: '/informes', label: 'Informes', icon: FileText },
  { href: '/ranking', label: 'Ranking', icon: Medal },
  { href: '/jugadores', label: 'Jugadores', icon: Users },
  { href: '/registro', label: 'Registro', icon: UserRoundPlus },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

const masterItems = [
  { href: '/informes', label: 'Informes', icon: FileText },
  { href: '/ranking', label: 'Ranking', icon: Medal },
  { href: '/jugadores', label: 'Jugadores', icon: Users },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const session = getStaffSession();
  const items = session.role === 'master' ? masterItems : staffItems;

  return (
    <aside className="sidebar">
      <div className="brand">
        <Image src="/orsomarso-crest.jpg" alt="Escudo Orsomarso SC" width={58} height={58} />
        <div>
          <small>Orsomarso SC</small>
          <h1>{session.role === 'master' ? 'Performance Maestro' : `Performance ${categoryLabel(session.category)}`}</h1>
        </div>
      </div>

      <nav className="nav">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`nav-link ${active ? 'active' : ''}`}>
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        className="nav-link nav-logout"
        onClick={() => {
          logoutStaff();
          router.push('/login');
        }}
      >
        <LogOut size={20} />
        <span>Cerrar sesión</span>
      </button>
    </aside>
  );
};
