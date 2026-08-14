"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  BarChart3,
  Bell,
  Briefcase,
  Database,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  FileText,
  Gauge,
  HeartPulse,
  Home,
  LogOut,
  Medal,
  Menu,
  Settings,
  ShieldCheck as AdminShield,
  ShieldCheck,
  TimerReset,
  Trophy,
  Utensils,
  TrendingUp,
  UserRoundPlus,
  Users,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { categoryLabel } from "@/lib/labels";
import { hasAdministrationAccess } from "@/lib/access-control";
import { getStaffSession, logoutStaff } from "@/lib/auth";
import { signOutSupabase, tableSchemaSyncEnabled } from "@/lib/supabase";
import { ORSOMARSO_BRAND } from "@/lib/design-system";
import { useApp } from "@/context/app-context";
import { ThemeToggle } from "@/components/theme-toggle";

const staffGroups = [
  {
    title: "Principal",
    items: [
      { href: "/", label: "Inicio", icon: Home },
      { href: "/diario", label: "Diario operativo", icon: Gauge },
    ],
  },
  {
    title: "Planificación",
    items: [
      { href: "/plan-diario", label: "Plan diario", icon: CalendarDays },
      { href: "/microciclo", label: "Microciclo", icon: Activity },
      { href: "/sesion-entrenamiento", label: "Sesión", icon: TimerReset },
      { href: "/competencia", label: "Competencia", icon: Trophy },
    ],
  },
  {
    title: "Control de carga",
    items: [
      { href: "/carga", label: "Resumen carga/riesgo", icon: Gauge },
      { href: "/riesgo", label: "Riesgo detallado", icon: TrendingUp },
      { href: "/wellness", label: "Wellness", icon: ShieldCheck },
      { href: "/disponibilidad", label: "Disponibilidad", icon: HeartPulse },
      { href: "/adherencia", label: "Calidad del dato", icon: Database },
    ],
  },
  {
    title: "Jugadores",
    items: [
      { href: "/jugadores", label: "Plantilla", icon: Users },
      { href: "/registro", label: "Nuevo registro", icon: UserRoundPlus },
      { href: "/valoraciones", label: "Valoraciones", icon: BarChart3 },
    ],
  },
  {
    title: "Informes",
    items: [
      { href: "/informes", label: "Centro informes", icon: Briefcase },
      { href: "/informes/jugador-periodo", label: "Informe individual", icon: FileText },
      { href: "/informes/grupo", label: "Informe grupo", icon: Briefcase },
      { href: "/informes/semanal", label: "Informe semanal", icon: CalendarDays },
    ],
  },
  {
    title: "Sistema",
    items: [{ href: "/configuracion", label: "Configuración", icon: Settings }],
  },
];

const canManageAdministration = (session: ReturnType<typeof getStaffSession>) =>
  hasAdministrationAccess(session);

const getNavigationGroups = (session: ReturnType<typeof getStaffSession>) => {
  return canManageAdministration(session)
    ? staffGroups.map((group) =>
        group.title === "Sistema"
          ? {
              ...group,
              items: [
                {
                  href: "/administracion",
                  label: "Administración",
                  icon: AdminShield,
                },
                ...group.items,
              ],
            }
          : group,
      )
    : staffGroups;
};

// ─── Sidebar de escritorio — rediseñado ─────────────────────────────────────
export const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const session = getStaffSession();
  const { syncStatus } = useApp();
  const groups = getNavigationGroups(session);
  const displayCategory =
    session.category === "all" ? "Todas" : categoryLabel(session.category);
  const displayName =
    session.displayName || session.email?.split("@")[0] || "Staff";

  // Grupos colapsables — guardamos cuál está abierto
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (title: string) =>
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));

  const syncDot =
    syncStatus === "syncing"
      ? "sidebar-dot-syncing"
      : syncStatus === "error"
        ? "sidebar-dot-error"
        : "sidebar-dot-ready";

  return (
    <aside className="sidebar sidebar-v2">
      {/* ── Marca ── */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-logo">
          <Image
            src="/orsomarso-crest.jpg"
            alt="Orsomarso SC"
            width={40}
            height={40}
            priority
          />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-club">{ORSOMARSO_BRAND.club}</span>
          <strong className="sidebar-brand-product">
            {ORSOMARSO_BRAND.product}
          </strong>
        </div>
      </div>

      {/* ── Usuario activo ── */}
      <div className="sidebar-user">
        <div className="sidebar-user-avatar">
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="sidebar-user-info">
          <span className="sidebar-user-name">{displayName}</span>
          <span className="sidebar-user-role">{displayCategory}</span>
        </div>
        <span className={`sidebar-sync-dot ${syncDot}`} title={syncStatus} />
      </div>

      {/* ── Navegación ── */}
      <nav className="sidebar-nav" aria-label="Navegación principal">
        {groups.map((group) => {
          const isOpen = !collapsed[group.title];
          const hasActive = group.items.some(
            (item) =>
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href)),
          );
          return (
            <div className="sidebar-group" key={group.title}>
              <button
                type="button"
                className={`sidebar-group-toggle ${hasActive ? "has-active" : ""}`}
                onClick={() => toggleGroup(group.title)}
                aria-expanded={isOpen}
              >
                <span>{group.title}</span>
                {isOpen ? (
                  <ChevronDown size={13} />
                ) : (
                  <ChevronRight size={13} />
                )}
              </button>
              {isOpen && (
                <div className="sidebar-group-items">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active =
                      pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`sidebar-item ${active ? "active" : ""}`}
                      >
                        <span className="sidebar-item-icon">
                          <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                        </span>
                        <span className="sidebar-item-label">{item.label}</span>
                        {active && <span className="sidebar-item-pip" />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Pie ── */}
      <div className="sidebar-footer">
        <div
          className={`sidebar-conn ${tableSchemaSyncEnabled ? "sidebar-conn-live" : "sidebar-conn-local"}`}
        >
          <span className="sidebar-conn-dot" />
          <span>
            {tableSchemaSyncEnabled ? "Supabase activo" : "Modo local"}
          </span>
        </div>
        <div className="sidebar-actions">
          <ThemeToggle />
          <button
            type="button"
            className="sidebar-logout"
            onClick={async () => {
              try {
                await signOutSupabase();
              } catch {}
              logoutStaff();
              window.location.assign("/login");
            }}
          >
            <LogOut size={15} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

// ─── Navegación móvil/tablet — SIN CAMBIOS ──────────────────────────────────
export const MobileNavigation = () => {
  const pathname = usePathname();
  const router = useRouter();
  const session = getStaffSession();
  const groups = getNavigationGroups(session);
  const [open, setOpen] = useState(false);
  const primaryItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/jugadores", label: "Jugadores", icon: Users },
    { href: "/carga", label: "Carga", icon: Gauge },
    { href: "/plan-diario", label: "Plan", icon: CalendarDays },
    { href: "/competencia", label: "Partido", icon: Trophy },
  ];

  return (
    <>
      {open && (
        <div
          className="mobile-menu-backdrop no-print"
          onClick={() => setOpen(false)}
        />
      )}
      <div
        className={`mobile-menu-panel no-print ${open ? "open" : ""}`}
        aria-hidden={!open}
      >
        <div className="mobile-menu-header">
          <div>
            <span>Menú Orsomarso</span>
            <strong>
              {session.category === "all"
                ? "Todas las categorías"
                : categoryLabel(session.category)}
            </strong>
          </div>
          <button
            type="button"
            className="mobile-menu-close"
            onClick={() => setOpen(false)}
          >
            Cerrar
          </button>
        </div>
        <div className="mobile-menu-groups">
          {groups.map((group) => (
            <section key={group.title} className="mobile-menu-group">
              <h3>{group.title}</h3>
              <div className="mobile-menu-grid">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`mobile-menu-link ${active ? "active" : ""}`}
                      onClick={() => setOpen(false)}
                    >
                      <Icon size={17} strokeWidth={2.25} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <button
          type="button"
          className="mobile-menu-logout"
          onClick={async () => {
            try {
              await signOutSupabase();
            } catch {}
            logoutStaff();
            setOpen(false);
            window.location.assign("/login");
          }}
        >
          <LogOut size={17} />
          Cerrar sesión
        </button>
      </div>
      <nav
        className="mobile-bottom-nav no-print"
        aria-label="Navegación móvil principal"
      >
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-bottom-link ${active ? "active" : ""}`}
            >
              <Icon size={18} strokeWidth={2.35} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={`mobile-bottom-link mobile-more-trigger ${open ? "active" : ""}`}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <Menu size={18} strokeWidth={2.35} />
          <span>Más</span>
        </button>
      </nav>
    </>
  );
};
