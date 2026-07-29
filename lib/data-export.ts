// Data export utilities for multiple formats

export type ExportFormat = 'csv' | 'json' | 'excel';

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeHeaders?: boolean;
}

export function exportToCSV(data: any[], filename: string = 'export.csv') {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle nested objects, arrays, and special characters
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma or quote
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  downloadFile(csvContent, filename, 'text/csv');
}

export function exportToJSON(data: any[], filename: string = 'export.json') {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, 'application/json');
}

export function exportToExcel(data: any[], filename: string = 'export.xlsx') {
  // For Excel, we'll export as CSV with .xlsx extension
  // In a real implementation, you'd use a library like xlsx
  exportToCSV(data, filename);
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatDateForExport(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export function formatNumberForExport(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}
