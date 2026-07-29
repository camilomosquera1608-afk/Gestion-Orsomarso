// GPS Editable Table - Professional Excel-like GPS Data Editor
// Comprehensive editable table with keyboard navigation, validation, and real-time updates

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Edit2, Trash2, Plus, Save, X, AlertCircle, CheckCircle, Undo } from 'lucide-react';
import type {
  GPSEditRow,
  GPSEditableData,
  GPSColumnDefinition,
  GPSValidationResult
} from '@/lib/gps-editor-types';
import {
  validateGPSRow,
  parseAndValidateGPSNumber,
  DEFAULT_GPS_CONFIG
} from '@/lib/gps-validation';
import {
  recalculateRowMetrics,
  formatGPSMetric
} from '@/lib/gps-calculations';
import type { Player } from '@/lib/types';

interface GPSEditableTableProps {
  rows: GPSEditRow[];
  players: Player[];
  onChange: (rows: GPSEditRow[]) => void;
  onAddPlayer: () => void;
  onDeleteRow: (rowId: string) => void;
  onChangePlayer: (rowId: string, playerId: string) => void;
  disabled?: boolean;
}

/**
 * Column definitions for GPS editable table
 */
const GPS_COLUMNS: GPSColumnDefinition[] = [
  { key: 'playerName', label: 'Jugador', type: 'player', width: 200, editable: true, required: true },
  { key: 'minutes', label: 'Min', type: 'number', width: 80, editable: true, required: true },
  { key: 'totalDistance', label: 'Distancia Total (m)', type: 'number', width: 120, editable: true, required: true },
  { key: 'metersPerMinute', label: 'm/min', type: 'number', width: 100, editable: true },
  { key: 'highSpeedDistance', label: 'HSR (m)', type: 'number', width: 100, editable: true },
  { key: 'sprintDistance', label: 'Sprint (m)', type: 'number', width: 100, editable: true },
  { key: 'hsr', label: 'HSR (%)', type: 'number', width: 80, editable: true },
  { key: 'sprints', label: 'Sprints', type: 'number', width: 80, editable: true },
  { key: 'maxVelocity', label: 'Vel Max (m/s)', type: 'number', width: 100, editable: true },
  { key: 'acc', label: 'ACC', type: 'number', width: 80, editable: true },
  { key: 'dcc', label: 'DCC', type: 'number', width: 80, editable: true },
  { key: 'rhie', label: 'RHIE', type: 'number', width: 80, editable: true },
  { key: 'playerLoad', label: 'Player Load', type: 'number', width: 100, editable: true },
  { key: 'playerLoadPerMin', label: 'PL/min', type: 'number', width: 80, editable: true },
];

export function GPSEditableTable({
  rows,
  players,
  onChange,
  onAddPlayer,
  onDeleteRow,
  onChangePlayer,
  disabled = false
}: GPSEditableTableProps) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof GPSEditableData } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [validationResults, setValidationResults] = useState<Map<string, GPSValidationResult>>(new Map());
  const tableRef = useRef<HTMLDivElement>(null);

  // Validate all rows on mount and when rows change
  useEffect(() => {
    const results = new Map<string, GPSValidationResult>();
    for (const row of rows) {
      results.set(row.id, validateGPSRow(row, DEFAULT_GPS_CONFIG));
    }
    setValidationResults(results);
  }, [rows]);

  // Handle cell edit start
  const handleCellEdit = useCallback((rowId: string, field: keyof GPSEditableData) => {
    if (disabled) return;
    
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    
    const value = row.currentData[field];
    setEditValue(value !== undefined ? String(value) : '');
    setEditingCell({ rowId, field });
  }, [rows, disabled]);

  // Handle cell edit save
  const handleCellSave = useCallback(() => {
    if (!editingCell) return;
    
    const { rowId, field } = editingCell;
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    
    let newValue: any = editValue;
    
    // Parse numeric values
    if (field !== 'playerName' && field !== 'playerId') {
      const parsed = parseAndValidateGPSNumber(editValue, field, DEFAULT_GPS_CONFIG);
      if (!parsed.isValid) {
        // Show validation error
        const currentValidation = validationResults.get(rowId) || { isValid: true, errors: {}, warnings: {} };
        setValidationResults(new Map(validationResults).set(rowId, {
          ...currentValidation,
          errors: { ...currentValidation.errors, [field]: parsed.error || 'Valor inválido' }
        }));
        setEditingCell(null);
        return;
      }
      newValue = parsed.value;
    }
    
    // Update row data
    const updatedRows = rows.map(r => {
      if (r.id === rowId) {
        const updatedData = { ...r.currentData, [field]: newValue };
        const updatedRow = recalculateRowMetrics({
          ...r,
          currentData: updatedData,
          isModified: true,
        });
        
        // Validate updated row
        const validation = validateGPSRow(updatedRow, DEFAULT_GPS_CONFIG);
        setValidationResults(new Map(validationResults).set(rowId, validation));
        
        return updatedRow;
      }
      return r;
    });
    
    onChange(updatedRows);
    setEditingCell(null);
  }, [editingCell, editValue, rows, onChange, validationResults]);

  // Handle cell edit cancel
  const handleCellCancel = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, rowId: string, field: keyof GPSEditableData) => {
    if (editingCell) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCellSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCellCancel();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handleCellSave();
        
        // Navigate to next cell
        const fieldIndex = GPS_COLUMNS.findIndex(col => col.key === field);
        const nextFieldIndex = e.shiftKey ? fieldIndex - 1 : fieldIndex + 1;
        
        if (nextFieldIndex >= 0 && nextFieldIndex < GPS_COLUMNS.length) {
          const nextField = GPS_COLUMNS[nextFieldIndex].key;
          setEditingCell({ rowId, field: nextField });
          const nextRow = rows.find(r => r.id === rowId);
          if (nextRow) {
            setEditValue(String(nextRow.currentData[nextField]));
          }
        }
      }
    } else {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCellEdit(rowId, field);
      }
    }
  }, [editingCell, handleCellSave, handleCellCancel, handleCellEdit, rows]);

  // Handle row delete
  const handleDeleteRow = useCallback((rowId: string) => {
    if (confirm('¿Estás seguro de eliminar este jugador? Esta acción no se puede deshacer.')) {
      onDeleteRow(rowId);
    }
  }, [onDeleteRow]);

  // Handle player change
  const handlePlayerChange = useCallback((rowId: string, playerId: string) => {
    onChangePlayer(rowId, playerId);
  }, [onChangePlayer]);

  // Format cell value for display
  const formatCellValue = (value: any, field: keyof GPSEditableData): string => {
    if (value === undefined || value === null) return '';
    
    if (field === 'playerName') return value;
    
    return formatGPSMetric(value as number, field);
  };

  // Get validation error for a cell
  const getCellError = (rowId: string, field: keyof GPSEditableData): string | undefined => {
    const validation = validationResults.get(rowId);
    return validation?.errors[field];
  };

  // Get validation warning for a cell
  const getCellWarning = (rowId: string, field: keyof GPSEditableData): string | undefined => {
    const validation = validationResults.get(rowId);
    return validation?.warnings[field];
  };

  return (
    <div className="gps-editable-table" ref={tableRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn secondary"
            onClick={onAddPlayer}
            disabled={disabled}
          >
            <Plus size={16} />
            Agregar Jugador
          </button>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-200 rounded"></div>
            <span className="text-gray-600">Modificado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-200 rounded"></div>
            <span className="text-gray-600">Nuevo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-200 rounded"></div>
            <span className="text-gray-600">Eliminado</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {GPS_COLUMNS.map((column) => (
                  <th
                    key={String(column.key)}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    style={{ width: column.width }}
                  >
                    {column.label}
                    {column.required && <span className="text-red-500 ml-1">*</span>}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: 80 }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`
                    ${row.isModified ? 'bg-yellow-50' : ''}
                    ${row.isNew ? 'bg-green-50' : ''}
                    ${row.isDeleted ? 'bg-red-50 opacity-50 line-through' : ''}
                    hover:bg-gray-50
                  `}
                >
                  {GPS_COLUMNS.map((column) => {
                    const isEditing = editingCell?.rowId === row.id && editingCell?.field === column.key;
                    const error = getCellError(row.id, column.key);
                    const warning = getCellWarning(row.id, column.key);
                    
                    return (
                      <td
                        key={String(column.key)}
                        className={`
                          px-4 py-2 whitespace-nowrap
                          ${column.editable && !disabled ? 'cursor-pointer' : ''}
                          ${error ? 'bg-red-50' : ''}
                        `}
                        onClick={() => column.editable && !disabled && handleCellEdit(row.id, column.key)}
                        onKeyDown={(e) => handleKeyDown(e, row.id, column.key)}
                        tabIndex={column.editable && !disabled ? 0 : -1}
                      >
                        {column.key === 'playerName' ? (
                          <select
                            value={row.currentData.playerId}
                            onChange={(e) => handlePlayerChange(row.id, e.target.value)}
                            className="w-full bg-transparent border-0 focus:ring-0 text-sm"
                            disabled={disabled || row.isDeleted}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="">Seleccionar jugador</option>
                            {players.map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.name}
                              </option>
                            ))}
                          </select>
                        ) : isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type={column.type === 'number' ? 'number' : 'text'}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => handleKeyDown(e, row.id, column.key)}
                              onBlur={handleCellSave}
                            />
                            <button
                              type="button"
                              className="text-gray-400 hover:text-gray-600"
                              onClick={handleCellCancel}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <span className="text-sm text-gray-900">
                              {formatCellValue(row.currentData[column.key], column.key)}
                            </span>
                            {error && (
                              <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded whitespace-nowrap z-10">
                                {error}
                              </div>
                            )}
                            {warning && !error && (
                              <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded whitespace-nowrap z-10">
                                {warning}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {!row.isDeleted && (
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                          onClick={() => handleDeleteRow(row.id)}
                          disabled={disabled}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      {row.isDeleted && (
                        <button
                          type="button"
                          className="text-green-500 hover:text-green-700 disabled:opacity-50"
                          onClick={() => onDeleteRow(row.id)}
                          disabled={disabled}
                        >
                          <Undo size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              
              {rows.length === 0 && (
                <tr>
                  <td colSpan={GPS_COLUMNS.length + 1} className="px-4 py-8 text-center text-gray-500">
                    No hay datos GPS cargados. Agrega jugadores para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Validation Summary */}
      <div className="mt-4 flex items-center gap-4 text-sm">
        {Array.from(validationResults.values()).some(v => Object.keys(v.errors).length > 0) && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle size={16} />
            <span>Hay errores de validación que deben corregirse antes de guardar.</span>
          </div>
        )}
        {Array.from(validationResults.values()).some(v => Object.keys(v.warnings).length > 0) && (
          <div className="flex items-center gap-2 text-yellow-600">
            <AlertCircle size={16} />
            <span>Hay advertencias de validación. Revisa los datos antes de guardar.</span>
          </div>
        )}
        {!Array.from(validationResults.values()).some(v => Object.keys(v.errors).length > 0) && rows.length > 0 && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle size={16} />
            <span>Todos los datos son válidos.</span>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <p className="font-medium mb-2">Instrucciones:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Doble clic o Enter en una celda para editar</li>
          <li>Usa Tab para navegar entre celdas</li>
          <li>Enter para guardar cambios, Escape para cancelar</li>
          <li>Los campos con * son obligatorios</li>
          <li>Los cambios se marcan en amarillo</li>
        </ul>
      </div>
    </div>
  );
}
