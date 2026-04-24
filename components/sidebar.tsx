'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, BarChart3, FileText, Gauge, HeartPulse, Home, LogOut, Settings, TimerReset, Trophy, UserRoundPlus, Users } from 'lucide-react';
import { logoutStaff } from '@/lib/auth';

const items = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/diario', label: 'Dashboard diario', icon: Gauge },
  { href: '/microciclo', label: 'Microciclo', icon: Activity },
  { href: '/sesion-entrenamiento', label: 'Sesión de entrenamiento', icon: TimerReset },
  { href: '/valoraciones', label: 'Valoraciones', icon: BarChart3 },
  { href: '/competencia', label: 'Competencia', icon: Trophy },
  { href: '/informes', label: 'Informes', icon: FileText },
  { href: '/wellness-jugadores', label: 'Wellness jugadores', icon: HeartPulse },
  { href: '/jugadores', label: 'Jugadores', icon: Users },
  { href: '/registro', label: 'Registrar jugador', icon: UserRoundPlus },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="sidebar">
      <div className="brand">
        <Image src="/orsomarso-crest.jpg" alt="Escudo Orsomarso SC" width={58} height={58} />
        <div>
          <small>Orsomarso SC</small>
          <h1>Performance Hub</h1>
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
