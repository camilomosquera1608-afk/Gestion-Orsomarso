'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { EmptyState, StatusBadge, type UiTone } from '@/components/pro-ui';
import { TECHNICAL_MODULE_LINKS } from '@/lib/technical-secretariat';
import { getStaffSession } from '@/lib/auth';
import { hasTechnicalSecretariatPermission, type TechnicalSecretariatPermission } from '@/lib/access-control';

export function TechnicalAccessGate({
  children,
  permission = 'secretaria_tecnica.view',
}: {
  children: React.ReactNode;
  permission?: TechnicalSecretariatPermission;
}) {
  const session = getStaffSession();
  const allowed = hasTechnicalSecretariatPermission(session, permission);
  if (!allowed) {
    return (
      <div className="grid">
        <div className="card">
          <EmptyState
            icon="shield"
            title="Acceso restringido"
            text="Este apartado pertenece a Secretaría Técnica y requiere permisos especiales."
          />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export function TechnicalModuleNav() {
  const pathname = usePathname();
  return (
    <div className="card" style={{ padding: 10 }}>
      <div className="btn-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {TECHNICAL_MODULE_LINKS.map((item) => {
          const active = pathname === item.href || (item.href !== '/secretaria-tecnica' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`btn ${active ? '' : 'secondary'} btn-compact`}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export const statusToneForScout = (status?: string): UiTone => {
  if (status === 'prioridad' || status === 'convocable' || status === 'promovible') return 'green';
  if (status === 'interesante' || status === 'en_seguimiento' || status === 'observado') return 'blue';
  if (status === 'descartado') return 'red';
  return 'neutral';
};

export const statusToneForSelection = (status?: string): UiTone => {
  if (status === 'convocado' || status === 'participo') return 'green';
  if (status === 'preconvocado' || status === 'pendiente') return 'amber';
  if (status === 'descartado' || status === 'no_asistio') return 'red';
  return 'neutral';
};

export function PermissionHint({ permission }: { permission: TechnicalSecretariatPermission }) {
  const session = getStaffSession();
  const allowed = hasTechnicalSecretariatPermission(session, permission);
  if (allowed) return null;
  return <StatusBadge text="Solo lectura" tone="neutral" />;
}
