export const downloadCsv = (filename: string, rows: Array<Record<string, string | number>>) => {
  if (!rows.length || typeof window === 'undefined') return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
