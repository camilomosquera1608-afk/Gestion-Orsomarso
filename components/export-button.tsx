'use client';

import { Download, FileSpreadsheet, FileJson } from 'lucide-react';
import { exportToCSV, exportToJSON, exportToExcel } from '@/lib/data-export';

interface ExportButtonProps {
  data: any[];
  filename?: string;
  label?: string;
}

export function ExportButton({ data, filename, label = 'Exportar' }: ExportButtonProps) {
  const handleExport = (format: 'csv' | 'json' | 'excel') => {
    const baseFilename = filename || `orsomarso-export-${Date.now()}`;
    
    switch (format) {
      case 'csv':
        exportToCSV(data, `${baseFilename}.csv`);
        break;
      case 'json':
        exportToJSON(data, `${baseFilename}.json`);
        break;
      case 'excel':
        exportToExcel(data, `${baseFilename}.xlsx`);
        break;
    }
  };

  return (
    <div className="relative group">
      <button className="btn secondary">
        <Download size={16} />
        {label}
      </button>
      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
        <button
          onClick={() => handleExport('csv')}
          className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm"
        >
          <FileSpreadsheet size={16} />
          Exportar CSV
        </button>
        <button
          onClick={() => handleExport('json')}
          className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm"
        >
          <FileJson size={16} />
          Exportar JSON
        </button>
        <button
          onClick={() => handleExport('excel')}
          className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm"
        >
          <FileSpreadsheet size={16} />
          Exportar Excel
        </button>
      </div>
    </div>
  );
}
