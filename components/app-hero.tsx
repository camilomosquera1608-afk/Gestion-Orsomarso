'use client';

import { useEffect, useState } from 'react';
import { getStaffSession } from '@/lib/auth';

export const AppHero = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  badgeTitle?: string;
  badgeText?: string;
}) => {
  const [contextLabel, setContextLabel] = useState('Orsomarso SC Performance');

  useEffect(() => {
    const session = getStaffSession();
    const suffix = session.role === 'master' ? 'Maestro' : session.category !== 'all' ? session.category : '';
    setContextLabel(`Orsomarso SC Performance${suffix ? ` · ${suffix}` : ''}`);
  }, []);

  return (
    <section className="hero hero-compact">
      <div>
        <div className="hero-eyebrow">{contextLabel}</div>
        <h2>{title}</h2>
        {subtitle ? <p className="hero-subtitle-app">{subtitle}</p> : null}
      </div>
    </section>
  );
};
