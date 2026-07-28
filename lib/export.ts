export const downloadCsv = (filename: string, rows: Array<Record<string, string | number>>) => {
  if (!rows.length || typeof window === 'undefined') return;
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(',')),
  ].join('\n');
  downloadText(filename.endsWith('.csv') ? filename : `${filename}.csv`, csv, 'text/csv;charset=utf-8;');
};

export const downloadText = (filename: string, content: string, mime = 'text/plain;charset=utf-8;') => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const shareReport = async (title: string, text: string) => {
  if (typeof window === 'undefined') return false;
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch {
      return false;
    }
  }
  const url = `https://wa.me/?text=${encodeURIComponent(`${title}\n\n${text}`)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
};

export const buildDailyPlanExportRows = (
  rows: Array<{
    player: { name: string; position: string; status: string };
    decision: string;
    reason: string;
    quality: string;
    dataConfidence: { label: string; adherencePct: number };
    predictiveRisk: { score: number; tone: string };
  }>,
) =>
  rows.map((row) => ({
    jugador: row.player.name,
    posicion: row.player.position,
    estado: row.player.status,
    decision: row.decision,
    motivo: row.reason,
    calidad: row.quality,
    confianza: row.dataConfidence.label,
    adherencia_pct: row.dataConfidence.adherencePct,
    riesgo_score: row.predictiveRisk.score,
    riesgo_semaforo: row.predictiveRisk.tone,
  }));

export const buildWeeklyReportText = (report: {
  periodo: string;
  categoria: string;
  disponibilidadPct: number;
  wellnessPromedio: number;
  cargaTotal: number;
  rpePromedio: number;
  sesiones: number;
  partidos: number;
  victorias: number;
  empates: number;
  derrotas: number;
  golesFavor: number;
  golesContra: number;
}) => [
  `Informe semanal · ${report.categoria}`,
  `Periodo: ${report.periodo}`,
  '',
  `Disponibilidad: ${report.disponibilidadPct}%`,
  `Wellness promedio: ${report.wellnessPromedio.toFixed(1)}`,
  `Carga total: ${Math.round(report.cargaTotal).toLocaleString('es-CO')} UA`,
  `RPE promedio: ${report.rpePromedio.toFixed(1)}`,
  `Sesiones: ${report.sesiones}`,
  `Partidos: ${report.partidos} (${report.victorias}V ${report.empates}E ${report.derrotas}D)`,
  `Goles: ${report.golesFavor}-${report.golesContra}`,
].join('\n');
