import type { ReactNode } from 'react';
import Image from 'next/image';
import { AlertTriangle, CheckCircle2, FileText, LucideIcon } from 'lucide-react';
import { categoryLabel } from '@/lib/labels';

export type ReportTone = 'blue' | 'green' | 'amber' | 'red' | 'neutral' | 'dark';

export const reportToneClass = (tone: ReportTone = 'neutral') => `pdf-report-tone-${tone}`;

export function ReportLayout({ title, subtitle, category, generatedAt, children, className = '' }: { title: string; subtitle?: string; category?: string; generatedAt?: string; children: ReactNode; className?: string }) {
  return (
    <article className={`pdf-report-document premium-report-document ${className}`}>
      <ReportHeader title={title} subtitle={subtitle} category={category} generatedAt={generatedAt} />
      {children}
      <ReportFooter category={category} />
    </article>
  );
}

export function ReportHeader({ title, subtitle, category, generatedAt }: { title: string; subtitle?: string; category?: string; generatedAt?: string }) {
  const meta = [category ? categoryLabel(category) : undefined, generatedAt].filter(Boolean).join(' · ');
  return (
    <header className="pdf-report-header premium-report-header">
      <div className="pdf-report-brand">
        <Image src="/orsomarso-crest.jpg" alt="Orsomarso SC" width={52} height={52} />
        <div>
          <span>Orsomarso SC Performance</span>
          <h1>{title}</h1>
          {meta ? <p>{meta}</p> : null}
        </div>
      </div>
      {subtitle ? <div className="pdf-report-header-meta"><strong>{subtitle}</strong></div> : null}
    </header>
  );
}

export function ReportFooter({ category }: { category?: string }) {
  return (
    <footer className="pdf-report-footer premium-report-footer">
      <span>Orsomarso SC Performance</span>
      <span>{category ? categoryLabel(category) : 'Informe institucional'}</span>
    </footer>
  );
}

export function ReportSection({ icon: Icon = FileText, eyebrow, title, subtitle, children, className = '' }: { icon?: LucideIcon; eyebrow?: string; title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`pdf-report-section premium-report-section ${className}`}>
      <div className="pdf-report-section-heading">
        <span className="pdf-report-icon pdf-report-tone-blue"><Icon size={15} strokeWidth={2.4} /></span>
        <div>
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function ReportBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: ReportTone }) {
  return <span className={`pdf-report-badge ${reportToneClass(tone)}`}>{children}</span>;
}

export function ReportKpiCard({ icon: Icon = CheckCircle2, label, value, note, tone = 'blue' }: { icon?: LucideIcon; label: string; value: ReactNode; note?: string; tone?: ReportTone }) {
  return (
    <div className="pdf-report-kpi premium-report-kpi">
      <span className={`pdf-report-icon ${reportToneClass(tone)}`}><Icon size={15} strokeWidth={2.4} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {note ? <small>{note}</small> : null}
      </div>
    </div>
  );
}

export function ReportEmptyState({ text = 'Sin registros.', compact = false }: { text?: string; compact?: boolean }) {
  return <div className={`pdf-report-empty ${compact ? 'compact' : ''}`}><AlertTriangle size={14} /><span>{text}</span></div>;
}

export function ReportInsightBox({ children, tone = 'blue' }: { children: ReactNode; tone?: ReportTone }) {
  return <div className={`pdf-report-insight ${reportToneClass(tone)}`}>{children}</div>;
}
