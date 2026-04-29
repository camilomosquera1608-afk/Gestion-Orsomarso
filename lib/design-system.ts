export const ORSOMARSO_BRAND = {
  club: 'Orsomarso SC',
  product: 'Orsomarso Performance',
  report: 'ORSOMARSO PERFORMANCE REPORT',
  category: 'Sub20',
  tagline: 'Centro de control deportivo',
};

export const ORSOMARSO_COLORS = {
  navy: '#06152f',
  navy2: '#0b214a',
  blue: '#1557d6',
  blueDark: '#0d3d9c',
  blueSoft: '#eaf2ff',
  background: '#f3f6fb',
  card: '#ffffff',
  line: '#d8e1ee',
  text: '#0f172a',
  muted: '#64748b',
  muted2: '#94a3b8',
  green: '#059669',
  greenSoft: '#dcfce7',
  amber: '#d97706',
  amberSoft: '#fef3c7',
  red: '#dc2626',
  redSoft: '#fee2e2',
  neutralSoft: '#f1f5f9',
};

export const STATUS_TONES = {
  disponible: { label: 'Disponible', tone: 'green' },
  molestia: { label: 'Molestia', tone: 'amber' },
  readaptacion: { label: 'Readaptación', tone: 'blue' },
  lesionado: { label: 'Lesionado', tone: 'red' },
  sinRegistro: { label: 'Sin registro', tone: 'neutral' },
};

export const PDF_REPORT_STYLE = {
  brand: ORSOMARSO_BRAND.report,
  headerHeight: 74,
  coverTitleSize: 28,
  titleSize: 22,
  subtitleSize: 11,
  tableHeaderFill: ORSOMARSO_COLORS.blueSoft,
  tableBorder: ORSOMARSO_COLORS.line,
  kpiFill: '#f8fbff',
  accent: ORSOMARSO_COLORS.blue,
  footerText: 'Orsomarso SC · Departamento de Rendimiento',
};
