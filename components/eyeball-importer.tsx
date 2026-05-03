'use client';
// ── Importador CSV de Eyeball (estadísticas de partido) ──────────────────────
// Formato: Categoría;Estadística;Equipo_Rival;ORSOMARSO SC
// Separa los datos en secciones: Resumen, Ofensivo, Defensivo, Distribución

export interface EyeballMatchStats {
  rival: string;
  orsomarso: string;
  sections: Record<string, Array<{ stat: string; rival: string | number; orso: string | number }>>;
  goalsFor: number;
  goalsAgainst: number;
  possession: number;
  passPrecision: number;
  conversionRate: number;
  rivalName: string;
}

const parseVal = (v: string): string | number => {
  const clean = v.trim();
  if (clean.endsWith('%')) {
    const n = parseFloat(clean);
    return Number.isFinite(n) ? n : clean;
  }
  const n = parseFloat(clean.replace(',', '.'));
  return Number.isFinite(n) ? n : clean;
};

export const parseEyeballCsv = (raw: string): EyeballMatchStats | null => {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 3) return null;

  // Detect separator
  const sep = lines[0].includes(';') ? ';' : ',';
  const parseRow = (line: string) => line.split(sep).map((c) => c.replace(/"/g, '').trim());

  const header = parseRow(lines[0]);
  // header: [Categoría, Estadística, "RIVAL NAME", "ORSOMARSO SC"]
  const rivalCol = 2;
  const orsoCol = 3;
  const rivalName = header[rivalCol] ?? 'Rival';

  const sections: Record<string, Array<{ stat: string; rival: string | number; orso: string | number }>> = {};
  let goalsFor = 0; let goalsAgainst = 0; let possession = 55;
  let passPrecision = 0; let conversionRate = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = parseRow(lines[i]);
    if (cells.length < 4) continue;
    const section = cells[0].trim();
    const stat = cells[1].trim();
    const rivalVal = parseVal(cells[rivalCol] ?? '0');
    const orsoVal = parseVal(cells[orsoCol] ?? '0');

    if (!sections[section]) sections[section] = [];
    sections[section].push({ stat, rival: rivalVal, orso: orsoVal });

    // Extract key metrics
    if (stat === 'Goles') { goalsFor = Number(orsoVal); goalsAgainst = Number(rivalVal); }
    if (stat === 'Posesiones') possession = typeof orsoVal === 'number' ? orsoVal : parseFloat(String(orsoVal));
    if (stat === 'Precisión de pases') passPrecision = typeof orsoVal === 'number' ? orsoVal : parseFloat(String(orsoVal));
    if (stat === 'Tasa de conversión de tiros') conversionRate = typeof orsoVal === 'number' ? orsoVal : parseFloat(String(orsoVal));
  }

  return { rival: rivalName, orsomarso: header[orsoCol] ?? 'Orsomarso SC', sections, goalsFor, goalsAgainst, possession, passPrecision, conversionRate, rivalName };
};
