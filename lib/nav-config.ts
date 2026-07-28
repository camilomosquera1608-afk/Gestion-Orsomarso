import {
  Activity,
  BarChart3,
  Briefcase,
  CalendarDays,
  Database,
  FileText,
  Gauge,
  HeartPulse,
  Home,
  Settings,
  ShieldCheck,
  TimerReset,
  TrendingUp,
  Trophy,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { hasAdministrationAccess } from '@/lib/access-control';
import type { StaffSession } from '@/lib/auth';

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { title: string; items: NavItem[] };

const staffGroups: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { href: '/', label: 'Inicio', icon: Home },
      { href: '/diario', label: 'Diario operativo', icon: Gauge },
    ],
  },
  {
    title: 'Planificación',
    items: [
      { href: '/plan-diario', label: 'Plan diario', icon: CalendarDays },
      { href: '/microciclo', label: 'Microciclo', icon: Activity },
      { href: '/sesion-entrenamiento', label: 'Sesión', icon: TimerReset },
      { href: '/competencia', label: 'Competencia', icon: Trophy },
    ],
  },
  {
    title: 'Control de carga',
    items: [
      { href: '/carga', label: 'Resumen carga/riesgo', icon: Gauge },
      { href: '/riesgo', label: 'Riesgo detallado', icon: TrendingUp },
      { href: '/wellness', label: 'Wellness', icon: HeartPulse },
      { href: '/disponibilidad', label: 'Disponibilidad', icon: ShieldCheck },
      { href: '/adherencia', label: 'Calidad del dato', icon: Database },
    ],
  },
  {
    title: 'Jugadores',
    items: [
      { href: '/jugadores', label: 'Plantilla', icon: Users },
      { href: '/registro', label: 'Nuevo registro', icon: UserRoundPlus },
      { href: '/valoraciones', label: 'Valoraciones', icon: BarChart3 },
    ],
  },
  {
    title: 'Informes',
    items: [
      { href: '/informes', label: 'Centro informes', icon: Briefcase },
      { href: '/informes/jugador-periodo', label: 'Informe individual', icon: FileText },
      { href: '/informes/grupo', label: 'Informe grupo', icon: Briefcase },
      { href: '/informes/semanal', label: 'Informe semanal', icon: CalendarDays },
    ],
  },
  {
    title: 'Sistema',
    items: [{ href: '/configuracion', label: 'Configuración', icon: Settings }],
  },
];

export const getNavigationGroups = (session: StaffSession | ReturnType<typeof import('@/lib/auth').getStaffSession>): NavGroup[] => {
  if (!hasAdministrationAccess(session)) return staffGroups;
  return staffGroups.map((group) =>
    group.title === 'Sistema'
      ? {
          ...group,
          items: [
            { href: '/administracion', label: 'Administración', icon: ShieldCheck },
            ...group.items,
          ],
        }
      : group,
  );
};

export const topNavGroups = (session: StaffSession | ReturnType<typeof import('@/lib/auth').getStaffSession>) => {
  const groups = getNavigationGroups(session);
  return groups.map((group) => ({
    label: group.title,
    icon: group.items[0]?.icon ?? Home,
    items: group.items,
  }));
};

export const mobilePrimaryItems: NavItem[] = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/jugadores', label: 'Jugadores', icon: Users },
  { href: '/carga', label: 'Carga', icon: Gauge },
  { href: '/plan-diario', label: 'Plan', icon: CalendarDays },
  { href: '/competencia', label: 'Partido', icon: Trophy },
];
