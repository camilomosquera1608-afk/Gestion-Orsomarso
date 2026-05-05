'use client';

import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { AppHero } from '@/components/app-hero';

export default function AnalisisTacticoPage() {
  return (
    <div className="grid">
      <AppHero title="Análisis táctico" subtitle="El análisis Eyeball ahora está integrado en el informe de partido" />
      <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <Trophy size={40} style={{ color: '#1557d6', marginBottom: 16 }} />
        <h3 style={{ margin: '0 0 8px' }}>Análisis integrado con el partido</h3>
        <p className="muted-line" style={{ marginBottom: 20, maxWidth: 480, margin: '0 auto 24px' }}>
          El análisis táctico de Eyeball ahora aparece junto al informe GPS de cada partido, 
          en el módulo de Competencia. Selecciona un partido para importar el CSV de Eyeball 
          y verlos juntos.
        </p>
        <Link href="/competencia" className="btn">
          Ir a Competencia →
        </Link>
      </div>
    </div>
  );
}
