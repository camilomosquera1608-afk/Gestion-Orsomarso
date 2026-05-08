'use client';
// Importador CSV de Eyeball (estadisticas de equipo)
// Formato real observado:
// Categoria;Estadistica;"RIVAL";"ORSOMARSO SC"
// Ejemplo: Resumen;Goles;1;2
// Tambien soporta columnas adicionales por tiempo si Eyeball las permite exportar.

export interface EyeballRow {
  stat: string;
  rival: string | number;
  orso: string | number;
  unit?: '%' | '';
  rawStat?: string;
  index?: number;
}

export interface EyeballMatchStats {
  rival: string;
  orsomarso: string;
  sections: Record<string, EyeballRow[]>;
  goalsFor: number;
  goalsAgainst: number;
  possession: number;
  passPrecision: number;
  conversionRate: number;
  rivalName: string;
  sourceFormat: 'eyeball-team-stats';
  teamColumns: { rival: string; orsomarso: string };
}

const stripBom = (value: string) => value.replace(/^\uFEFF/, '');
const stripQuotes = (value: string) => value.replace(/^"|"$/g, '').replace(/""/g, '"').trim();

const parseCsvLine = (line: string, sep: string): string[] => {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { current += '"'; i += 1; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (ch === sep && !inQuotes) { out.push(stripQuotes(current)); current = ''; continue; }
    current += ch;
  }
  out.push(stripQuotes(current));
  return out;
};

const detectSeparator = (line: string) => {
  const semis = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  return semis >= commas ? ';' : ',';
};

const normalizeHeader = (value: string) => stripBom(stripQuotes(value)).trim();
const normalizeStatName = (value: string) => stripQuotes(value).replace(/\s+/g, ' ').trim();
const normalizeSectionName = (value: string) => {
  const clean = stripBom(stripQuotes(value)).replace(/\s+/g, ' ').trim();
  if (!clean) return 'General';
  const low = clean.toLowerCase();
  if (low.includes('resumen')) return 'Resumen';
  if (low.includes('ofens')) return 'Ofensivo';
  if (low.includes('defens')) return 'Defensivo';
  if (low.includes('distrib')) return 'Distribución';
  return clean;
};

const normalizeDisplayStat = (section: string, stat: string, occurrence: number) => {
  const clean = normalizeStatName(stat);
  const lower = clean.toLowerCase();
  // Eyeball exporta dos filas llamadas "Tiros a puerta" en Ofensivo.
  // La segunda corresponde a tiros bloqueados por coherencia con total/a puerta/fuera.
  if (section === 'Ofensivo' && lower === 'tiros a puerta' && occurrence > 1) return 'Tiros bloqueados';
  if (lower === 'all sideways passes') return 'Todos los pases laterales';
  if (lower === 'posesiones') return 'Posesión';
  return clean;
};

const toNumber = (value: string | number | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const raw = String(value).replace('%', '').trim();
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(raw)
      ? raw.replace(/\./g, '')
      : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const parseVal = (v: string): { value: string | number; unit?: '%' | '' } => {
  const clean = stripQuotes(v).trim();
  if (!clean || clean === '-') return { value: '-' };
  if (clean.endsWith('%')) {
    const n = toNumber(clean);
    return { value: `${Number.isInteger(n) ? n : Number(n.toFixed(1))}%`, unit: '%' };
  }
  const n = toNumber(clean);
  return Number.isFinite(n) && /^-?\d+([.,]\d+)?$/.test(clean) ? { value: n } : { value: clean };
};

const isOrsomarsoHeader = (header: string) => /orsomarso/i.test(header);
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const parseEyeballCsv = (raw: string): EyeballMatchStats | null => {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return null;

  const sep = detectSeparator(lines[0]);
  const parseRow = (line: string) => parseCsvLine(line, sep).map(normalizeHeader);
  const header = parseRow(lines[0]);
  if (header.length < 4) return null;

  const categoryIdx = header.findIndex((h) => /categoria|categoría|category/i.test(h));
  const statIdx = header.findIndex((h) => /estadistica|estadística|stat/i.test(h));
  const orsoCol = header.findIndex((h, i) => i >= 2 && isOrsomarsoHeader(h));
  const rivalCol = header.findIndex((h, i) => i >= 2 && i !== orsoCol && h.trim());
  const finalOrsoCol = orsoCol >= 0 ? orsoCol : 3;
  const finalRivalCol = rivalCol >= 0 ? rivalCol : 2;
  const rivalName = header[finalRivalCol] || 'Rival';
  const orsoName = header[finalOrsoCol] || 'Orsomarso SC';

  const sections: Record<string, EyeballRow[]> = {};
  const occurrences: Record<string, number> = {};
  let goalsFor = 0;
  let goalsAgainst = 0;
  let possession = 0;
  let passPrecision = 0;
  let conversionRate = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], sep).map(stripQuotes);
    if (cells.length < 4) continue;
    const section = normalizeSectionName(cells[categoryIdx >= 0 ? categoryIdx : 0]);
    const rawStat = normalizeStatName(cells[statIdx >= 0 ? statIdx : 1]);
    if (!section || !rawStat) continue;

    const occurrenceKey = `${section}::${rawStat.toLowerCase()}`;
    occurrences[occurrenceKey] = (occurrences[occurrenceKey] || 0) + 1;
    const stat = normalizeDisplayStat(section, rawStat, occurrences[occurrenceKey]);
    const rivalParsed = parseVal(cells[finalRivalCol] ?? '');
    const orsoParsed = parseVal(cells[finalOrsoCol] ?? '');
    const row: EyeballRow = { stat, rawStat, rival: rivalParsed.value, orso: orsoParsed.value, unit: orsoParsed.unit || rivalParsed.unit || '', index: i };

    if (!sections[section]) sections[section] = [];
    sections[section].push(row);

    const statKey = stat.toLowerCase();
    if (statKey === 'goles') { goalsFor = toNumber(row.orso); goalsAgainst = toNumber(row.rival); }
    if (statKey === 'posesión' || statKey === 'posesion') possession = toNumber(row.orso);
    if (statKey === 'precisión de pases' || statKey === 'precision de pases') passPrecision = toNumber(row.orso);
    if (statKey === 'tasa de conversión de tiros' || statKey === 'tasa de conversion de tiros') conversionRate = toNumber(row.orso);

    // Soporte futuro para columnas por bloques de tiempo.
    for (let c = 4; c + 1 < cells.length; c += 2) {
      if (c === finalRivalCol || c === finalOrsoCol || c + 1 === finalRivalCol || c + 1 === finalOrsoCol) continue;
      const rivalBlock = cells[c]?.trim();
      const orsoBlock = cells[c + 1]?.trim();
      if (!rivalBlock && !orsoBlock) continue;
      const rawLabel = `${header[c] ?? ''} ${header[c + 1] ?? ''}`
        .replace(new RegExp(escapeRegex(rivalName), 'ig'), '')
        .replace(/orsomarso\s*sc|orsomarso/ig, '')
        .replace(/[;,_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!rawLabel) continue;
      const blockSection = `${section} · ${rawLabel}`;
      if (!sections[blockSection]) sections[blockSection] = [];
      const rb = parseVal(rivalBlock || '0');
      const ob = parseVal(orsoBlock || '0');
      sections[blockSection].push({ stat, rawStat, rival: rb.value, orso: ob.value, unit: ob.unit || rb.unit || row.unit, index: i });
    }
  }

  if (!Object.keys(sections).length) return null;
  return { rival: rivalName, orsomarso: orsoName, sections, goalsFor, goalsAgainst, possession, passPrecision, conversionRate, rivalName, sourceFormat: 'eyeball-team-stats', teamColumns: { rival: rivalName, orsomarso: orsoName } };
};
