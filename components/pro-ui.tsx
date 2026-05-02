import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, CircleDot, Database, Info, PlusCircle, ShieldCheck, X } from 'lucide-react';
import type { AlertLevel, DataQualityItem, OperationalAlert } from '@/lib/operational-helpers';
import { useEffect, useState, useCallback } from 'react';

export type UiTone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'dark';

const toneClass = (tone: UiTone = 'neutral') => `ui-tone-${tone}`;
const alertTone = (level: AlertLevel): UiTone => level === 'critical' ? 'red' : level === 'warning' ? 'amber' : 'blue';

export const PageShell = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`page-shell ${className}`}>{children}</div>
);

export const SectionHeader = ({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) => (
  <div className="section-header">
    <div>
      {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
      <h3>{title}</h3>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
    {action ? <div className="section-action">{action}</div> : null}
  </div>
);

export const StatusBadge = ({ text, tone = 'neutral' }: { text: string; tone?: UiTone }) => (
  <span className={`status-badge ${toneClass(tone)}`}>{text}</span>
);

// FIX #5: EmptyState con ícono contextual por módulo.
// Cada módulo puede pasar su propio ícono SVG simple en lugar del ícono genérico.
export const EmptyState = ({
  title,
  text,
  action,
  icon = 'info',
}: {
  title: string;
  text?: string;
  action?: ReactNode;
  icon?: 'info' | 'check' | 'alert' | 'shield' | ReactNode;
}) => {
  const isString = typeof icon === 'string';
  const Icon = isString
    ? (icon === 'check' ? CheckCircle2 : icon === 'alert' ? AlertTriangle : icon === 'shield' ? ShieldCheck : Info)
    : null;
  return (
    <div className="empty-state">
      <div className="empty-icon">
        {isString && Icon ? <Icon size={20} /> : !isString ? icon : <Info size={20} />}
      </div>
      <div>
        <strong>{title}</strong>
        {text ? <p>{text}</p> : null}
      </div>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
};

// FIX #6: Toast de confirmación global. Úsalo así:
//   import { useToast } from '@/components/pro-ui';
//   const { showToast } = useToast();
//   showToast('Sesión guardada correctamente');
// El ToastContainer debe estar en el layout principal (app-shell.tsx).

type ToastEntry = { id: number; message: string; tone: UiTone };
let toastListeners: Array<(entry: ToastEntry) => void> = [];
let toastId = 0;

export const showToast = (message: string, tone: UiTone = 'green') => {
  const entry: ToastEntry = { id: ++toastId, message, tone };
  toastListeners.forEach((fn) => fn(entry));
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => {
    const handler = (entry: ToastEntry) => {
      setToasts((prev) => [...prev, entry]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== entry.id));
      }, 2400);
    };
    toastListeners.push(handler);
    return () => { toastListeners = toastListeners.filter((fn) => fn !== handler); };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          {toast.tone === 'green' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          <span>{toast.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            aria-label="Cerrar"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
};

export const AlertPanel = ({
  title = 'Alertas operativas',
  items,
  tone = 'amber',
  emptyText = 'Sin alertas relevantes.',
}: {
  title?: string;
  items: string[];
  tone?: UiTone;
  emptyText?: string;
}) => (
  <div className={`alert-panel ${toneClass(tone)}`}>
    <div className="alert-panel-header">
      <AlertTriangle size={18} />
      <strong>{title}</strong>
      {items.length ? <span>{items.length}</span> : null}
    </div>
    {items.length ? (
      <div className="alert-panel-list">
        {items.map((item) => (
          <div key={item} className="alert-panel-item"><CircleDot size={12} />{item}</div>
        ))}
      </div>
    ) : (
      <EmptyState icon="check" title={emptyText} text="" />
    )}
  </div>
);

export const OperationalAlertPanel = ({
  title = 'Centro de alertas',
  alerts,
  emptyText = 'Sin alertas operativas',
}: {
  title?: string;
  alerts: OperationalAlert[];
  emptyText?: string;
}) => (
  <div className="card operational-alert-card">
    <SectionHeader eyebrow="Alertas" title={title} />
    {alerts.length ? (
      <div className="operational-alert-list">
        {alerts.map((alert) => (
          <div key={alert.id} className={`operational-alert ${toneClass(alertTone(alert.level))}`}>
            <div className="operational-alert-icon"><AlertTriangle size={17} /></div>
            <div>
              <strong>{alert.title}</strong>
              <p>{alert.description}</p>
              {alert.action ? <span>{alert.action}</span> : null}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <EmptyState icon="check" title={emptyText} text="" />
    )}
  </div>
);

export const DataQualityPanel = ({
  percent,
  items,
}: {
  percent: number;
  items: DataQualityItem[];
}) => (
  <div className="card data-quality-card">
    <SectionHeader eyebrow="Datos" title="Completitud" />
    <div className="data-quality-score">
      <div>
        <strong>{percent}%</strong>
        <span>completitud</span>
      </div>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} /></div>
    </div>
    <div className="data-quality-list">
      {items.map((item) => {
        const ratio = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;
        const tone: UiTone = item.status === 'ok' ? 'green' : item.status === 'partial' ? 'amber' : item.status === 'missing' ? 'red' : 'neutral';
        return (
          <div key={item.label} className="data-quality-row">
            <div>
              <strong>{item.label}</strong>
              <span>{item.note ?? (item.total > 0 ? `${item.done}/${item.total}` : 'No aplica')}</span>
            </div>
            <span className={`status-badge ${toneClass(tone)}`}>{item.status === 'na' ? 'N/A' : `${ratio}%`}</span>
          </div>
        );
      })}
    </div>
  </div>
);

export const TaskChecklist = ({ tasks }: { tasks: OperationalAlert[] }) => (
  <div className="card task-card">
    <SectionHeader eyebrow="Pendientes" title="Tareas" />
    {tasks.length ? (
      <div className="task-list">
        {tasks.map((task, index) => (
          <div key={task.id} className={`task-item ${toneClass(alertTone(task.level))}`}>
            <span className="task-index">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <strong>{task.title}</strong>
              <p>{task.description}</p>
              {task.action ? <span>{task.action}</span> : null}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <EmptyState icon="check" title="Sin pendientes" text="" />
    )}
  </div>
);

export const Toolbar = ({ children }: { children: ReactNode }) => <div className="toolbar">{children}</div>;

export const ContextTopBar = ({
  date,
  microcycle,
  category,
  mode,
  syncStatus,
}: {
  date: string;
  microcycle: string;
  category: string;
  mode: string;
  // FIX #4: syncStatus expuesto en el context bar para feedback visual claro
  syncStatus?: 'idle' | 'syncing' | 'ready' | 'error';
}) => (
  <div className="top-context-bar no-print">
    <div className="top-context-item"><span>Fecha activa</span><strong>{date}</strong></div>
    <div className="top-context-item"><span>Microciclo</span><strong>{microcycle}</strong></div>
    <div className="top-context-item"><span>Categoría</span><strong>{category}</strong></div>
    <div className="top-context-item top-context-safe"><ShieldCheck size={15} /><strong>{mode}</strong></div>
    {/* FIX #4: indicador de sync visible y con color semántico */}
    {syncStatus && syncStatus !== 'idle' ? (
      <div className={`top-context-item top-context-sync top-context-sync-${syncStatus}`}>
        <span>Sync</span>
        <strong>
          {syncStatus === 'syncing' ? 'Guardando…' : syncStatus === 'error' ? 'Error' : 'Guardado ✓'}
        </strong>
      </div>
    ) : null}
    <div className="top-context-actions">
      <Link className="btn secondary btn-compact" href="/ejecutivo">Panel ejecutivo</Link>
      <Link className="btn secondary btn-compact" href="/alertas">Alertas</Link>
      <Link className="btn secondary btn-compact" href="/registro"><PlusCircle size={15} />Nuevo registro</Link>
      <Link className="btn secondary btn-compact" href="/configuracion"><Database size={15} />Respaldo</Link>
    </div>
  </div>
);

export const PlayerStatusCard = ({
  name,
  meta,
  status,
  right,
  href,
}: {
  name: string;
  meta?: string;
  status?: ReactNode;
  right?: ReactNode;
  href?: string;
}) => {
  const body = (
    <>
      <div className="player-avatar" aria-hidden>{name.slice(0, 2).toUpperCase()}</div>
      <div className="player-status-main">
        <strong>{name}</strong>
        {meta ? <span>{meta}</span> : null}
      </div>
      {status ? <div className="player-status-badges">{status}</div> : null}
      {right ? <div className="player-status-right">{right}</div> : null}
    </>
  );
  if (href) return <Link href={href} className="player-status-card player-status-link">{body}</Link>;
  return <div className="player-status-card">{body}</div>;
};

export const MatchCard = ({
  home = 'Orsomarso',
  away,
  score,
  result,
  meta,
  action,
  stats,
}: {
  home?: string;
  away: string;
  score: string;
  result?: ReactNode;
  meta?: string;
  action?: ReactNode;
  stats?: Array<{ label: string; value: string | number }>;
}) => (
  <div className="match-card">
    <div className="match-card-top">
      <span>{meta}</span>
      {result}
    </div>
    <div className="match-scoreline">
      <strong>{home}</strong>
      <div className="match-score">{score}</div>
      <strong>{away}</strong>
    </div>
    {stats?.length ? (
      <div className="match-stats-grid">
        {stats.map((item) => (
          <div key={item.label} className="match-stat"><strong>{item.value}</strong><span>{item.label}</span></div>
        ))}
      </div>
    ) : null}
    {action ? <div className="match-card-action">{action}</div> : null}
  </div>
);

export const WeekCalendar = ({
  days,
  onDeleteSession,
}: {
  days: Array<{
    date: string;
    label: string;
    sessions: unknown[];
    matches: unknown[];
    registeredPlayers: number;
    playersCount: number;
    avgRpe: number;
    avgMin: number;
    status?: string;
    statusLabel?: string;
    actionLabel?: string;
    sessionNumber?: number;
    sessionId?: string;
    actionHref?: string;
    completeness?: number;
  }>;
  onDeleteSession?: (sessionId: string) => void;
}) => (
  <div className="week-planning-grid">
    {days.map((day) => {
      const hasSession = day.sessions.length > 0;
      const hasMatch = day.matches.length > 0;
      const title = hasSession
        ? `Sesión ${day.sessionNumber ?? day.sessions.length}`
        : hasMatch
          ? `${day.matches.length} partido(s)`
          : (day.statusLabel ?? 'Sin actividad');
      const tone = day.status === 'completa' ? 'green' : day.status === 'parcial' ? 'amber' : hasSession ? 'blue' : hasMatch ? 'dark' : 'neutral';
      const actionText = day.actionLabel ?? (hasSession ? 'Editar sesión' : 'Planificar');
      return (
        <div key={day.date} className={`week-planning-day ${hasSession ? 'has-session' : ''}`}>
          <div className="week-day-date">{day.label}</div>
          <strong>{title}</strong>
          <div className="week-day-meta">{day.registeredPlayers}/{day.playersCount} jugadores con datos</div>
          <div className="week-day-tags">
            <span className={`status-badge ui-tone-${tone}`}>{day.statusLabel ?? (hasSession ? 'Sesión' : hasMatch ? 'Partido' : 'Sin actividad')}</span>
            {day.actionHref ? (
              <Link className="status-badge ui-tone-neutral week-day-action-link" href={day.actionHref}>{actionText}</Link>
            ) : (
              <span className="status-badge ui-tone-neutral">{actionText}</span>
            )}
            {hasSession && day.sessionId && onDeleteSession ? (
              <button type="button" className="status-badge ui-tone-red week-day-delete-button" onClick={() => onDeleteSession(day.sessionId!)}>Eliminar sesión</button>
            ) : null}
          </div>
          <div className="week-day-metrics">
            <span>MIN {day.avgMin.toFixed(0)}</span>
            <span>RPE {day.avgRpe.toFixed(1)}</span>
            {typeof day.completeness === 'number' ? <span>{day.completeness}%</span> : null}
          </div>
        </div>
      );
    })}
  </div>
);

export const ActionCard = ({
  href,
  title,
  text,
  meta,
  tone = 'blue',
}: {
  href: string;
  title: string;
  text: string;
  meta?: string;
  tone?: UiTone;
}) => (
  <Link href={href} className={`action-card ${toneClass(tone)}`}>
    <div className="action-card-icon"><PlusCircle size={18} /></div>
    <div>
      <strong>{title}</strong>
      <p>{text}</p>
      {meta ? <span>{meta}</span> : null}
    </div>
  </Link>
);

export const FormSection = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) => (
  <section className="form-section">
    <div className="form-section-heading">
      <strong>{title}</strong>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
    <div className="form-section-body">{children}</div>
  </section>
);

export const ReportTypeCard = ({
  title,
  description,
  status = 'Listo',
  primaryLabel = 'Vista previa',
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  title: string;
  description: string;
  status?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}) => (
  <div className="report-type-card">
    <div>
      <span className="status-badge ui-tone-blue">{status}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
    <div className="btn-row">
      {onPrimary ? <button type="button" className="btn secondary" onClick={onPrimary}>{primaryLabel}</button> : <span className="btn secondary report-disabled-action">{primaryLabel}</span>}
      {secondaryLabel ? (
        onSecondary ? <button type="button" className="btn" onClick={onSecondary}>{secondaryLabel}</button> : <span className="btn report-disabled-action">{secondaryLabel}</span>
      ) : null}
    </div>
  </div>
);

export const CompactInfoList = ({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; tone?: UiTone }>;
}) => (
  <div className="compact-info-list">
    {items.map((item) => (
      <div key={item.label} className="compact-info-row">
        <span>{item.label}</span>
        <strong className={item.tone ? `status-badge ${toneClass(item.tone)}` : undefined}>{item.value}</strong>
      </div>
    ))}
  </div>
);
