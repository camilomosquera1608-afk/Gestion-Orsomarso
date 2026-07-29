// GPS Editor - Professional GPS Data Editing System
// Main component for editing GPS competition data with full functionality

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, X, Undo, History, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { GPSEditableTable } from './gps-editable-table';
import type {
  GPSEditRow,
  GPSEditableData,
  GPSEditState,
  GPSEditorProps
} from '@/lib/gps-editor-types';
import type { DailyExternalLoadRecord, Player, MovementType } from '@/lib/types';
import {
  validateGPSRows,
  DEFAULT_GPS_CONFIG
} from '@/lib/gps-validation';
import {
  recalculateAllMetrics,
  calculateComprehensiveMetrics
} from '@/lib/gps-calculations';
import { gpsHistoryManager, createHistoryEntryFromRowChange } from '@/lib/gps-history';

export function GPSEditor({
  matchId,
  category,
  records,
  players,
  onSave,
  onCancel,
  onRestoreOriginal,
  config
}: GPSEditorProps) {
  const [editState, setEditState] = useState<GPSEditState>({
    matchId,
    originalRecords: records,
    currentRows: [],
    hasUnsavedChanges: false,
    history: [],
    isRestoring: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [validationSummary, setValidationSummary] = useState<{
    isValid: boolean;
    totalErrors: number;
    totalWarnings: number;
  }>({ isValid: true, totalErrors: 0, totalWarnings: 0 });

  // Convert records to editable rows on mount
  useEffect(() => {
    const rows = convertRecordsToEditRows(records);
    setEditState(prev => ({
      ...prev,
      currentRows: rows,
      originalRecords: records,
    }));
  }, [records]);

  // Validate rows whenever they change
  useEffect(() => {
    const validation = validateGPSRows(editState.currentRows, DEFAULT_GPS_CONFIG);
    setValidationSummary({
      isValid: validation.isValid,
      totalErrors: validation.totalErrors,
      totalWarnings: validation.totalWarnings,
    });
  }, [editState.currentRows]);

  // Convert DailyExternalLoadRecord to GPSEditRow
  const convertRecordsToEditRows = useCallback((records: DailyExternalLoadRecord[]): GPSEditRow[] => {
    return records.map((record, index) => {
      const playerIndex = players.findIndex(p => p.id === record.playerId);
      const player = playerIndex >= 0 ? players[playerIndex] : null;
      
      const editableData: GPSEditableData = {
        playerId: record.playerId,
        playerName: player?.name || 'Jugador desconocido',
        minutes: record.min,
        totalDistance: record.totalDistance || 0,
        metersPerMinute: record.distancePerMin || 0,
        highSpeedDistance: record.highSpeedDistance || 0,
        sprintDistance: record.sprintDistance || 0,
        hsr: record.hsr || 0,
        sprints: record.sprints || 0,
        maxVelocity: record.maxVelocity || 0,
        acc: record.acc,
        dcc: record.dcc,
        rhie: record.rhie,
        playerLoad: record.playerLoad || 0,
        playerLoadPerMin: record.playerLoadPerMin || 0,
        ima: record.ima,
      };

      return {
        id: record.id || `gps-row-${index}`,
        originalData: { ...editableData },
        currentData: { ...editableData },
        isModified: false,
        isNew: false,
        isDeleted: false,
        validationErrors: {},
      };
    });
  }, [players]);

  // Convert GPSEditRow back to DailyExternalLoadRecord
  const convertEditRowsToRecords = useCallback((rows: GPSEditRow[]): DailyExternalLoadRecord[] => {
    return rows
      .filter(row => !row.isDeleted)
      .map((row, index) => {
        const originalRecord = editState.originalRecords.find(r => r.id === row.id);
        
        return {
          ...(originalRecord || {
            id: row.id,
            sessionId: matchId,
            playerId: row.currentData.playerId,
            date: new Date().toISOString().split('T')[0],
            category,
            movementType: 'subio_a_competir' as MovementType,
            movementModule: 'competencia',
          }),
          playerId: row.currentData.playerId,
          min: row.currentData.minutes,
          acc: row.currentData.acc,
          dcc: row.currentData.dcc,
          sprints: row.currentData.sprints,
          rhie: row.currentData.rhie,
          totalDistance: row.currentData.totalDistance,
          maxVelocity: row.currentData.maxVelocity,
          playerLoad: row.currentData.playerLoad,
          highSpeedDistance: row.currentData.highSpeedDistance,
          sprintDistance: row.currentData.sprintDistance,
          hsr: row.currentData.hsr,
          distancePerMin: row.currentData.metersPerMinute,
          playerLoadPerMin: row.currentData.playerLoadPerMin,
          ima: row.currentData.ima,
        };
      });
  }, [editState.originalRecords, matchId, category]);

  // Handle row change
  const handleRowChange = useCallback((updatedRows: GPSEditRow[]) => {
    setEditState(prev => ({
      ...prev,
      currentRows: updatedRows,
      hasUnsavedChanges: true,
    }));
  }, []);

  // Handle add player
  const handleAddPlayer = useCallback(() => {
    const newRow: GPSEditRow = {
      id: `gps-new-${Date.now()}`,
      originalData: {
        playerId: '',
        playerName: '',
        minutes: 0,
        totalDistance: 0,
        metersPerMinute: 0,
        highSpeedDistance: 0,
        sprintDistance: 0,
        hsr: 0,
        sprints: 0,
        maxVelocity: 0,
        acc: 0,
        dcc: 0,
        rhie: 0,
        playerLoad: 0,
        playerLoadPerMin: 0,
      },
      currentData: {
        playerId: '',
        playerName: '',
        minutes: 0,
        totalDistance: 0,
        metersPerMinute: 0,
        highSpeedDistance: 0,
        sprintDistance: 0,
        hsr: 0,
        sprints: 0,
        maxVelocity: 0,
        acc: 0,
        dcc: 0,
        rhie: 0,
        playerLoad: 0,
        playerLoadPerMin: 0,
      },
      isModified: true,
      isNew: true,
      isDeleted: false,
      validationErrors: {},
    };

    setEditState(prev => ({
      ...prev,
      currentRows: [...prev.currentRows, newRow],
      hasUnsavedChanges: true,
    }));
  }, []);

  // Handle delete row
  const handleDeleteRow = useCallback((rowId: string) => {
    setEditState(prev => {
      const updatedRows = prev.currentRows.map(row => {
        if (row.id === rowId) {
          if (row.isNew) {
            // If it's a new row, remove it completely
            return null;
          } else {
            // If it's an existing row, mark as deleted
            return { ...row, isDeleted: !row.isDeleted, isModified: true };
          }
        }
        return row;
      }).filter((row): row is GPSEditRow => row !== null);

      return {
        ...prev,
        currentRows: updatedRows,
        hasUnsavedChanges: true,
      };
    });
  }, []);

  // Handle change player
  const handleChangePlayer = useCallback((rowId: string, playerId: string) => {
    setEditState(prev => {
      const updatedRows = prev.currentRows.map(row => {
        if (row.id === rowId) {
          const player = players.find(p => p.id === playerId);
          const updatedData = {
            ...row.currentData,
            playerId,
            playerName: player?.name || 'Jugador desconocido',
          };
          
          // Record history change (using placeholder user data)
          if (row.currentData.playerId !== playerId) {
            gpsHistoryManager.recordChange(
              'system-user',
              'Sistema',
              matchId,
              row,
              'playerId' as any,
              row.currentData.playerId,
              playerId,
              'Cambio de jugador'
            );
          }

          return {
            ...row,
            currentData: updatedData,
            isModified: true,
          };
        }
        return row;
      });

      return {
        ...prev,
        currentRows: updatedRows,
        hasUnsavedChanges: true,
        history: [...prev.history, ...gpsHistoryManager.getMatchHistory(matchId)],
      };
    });
  }, [players, matchId]);

  // Handle restore original
  const handleRestoreOriginal = useCallback(() => {
    if (confirm('¿Estás seguro de restaurar los datos originales? Se perderán todos los cambios manuales.')) {
      setEditState(prev => {
        const originalRows = convertRecordsToEditRows(prev.originalRecords);
        return {
          ...prev,
          currentRows: originalRows,
          hasUnsavedChanges: false,
          isRestoring: true,
        };
      });

      if (onRestoreOriginal) {
        onRestoreOriginal();
      }

      // Clear history for this match
      gpsHistoryManager.clearMatchHistory(matchId);
    }
  }, [convertRecordsToEditRows, onRestoreOriginal, matchId]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!validationSummary.isValid) {
      alert('Hay errores de validación que deben corregirse antes de guardar.');
      return;
    }

    setIsSaving(true);
    try {
      // Recalculate all metrics before saving
      const recalculatedRows = recalculateAllMetrics(editState.currentRows);
      
      // Convert to records
      const updatedRecords = convertEditRowsToRecords(recalculatedRows);
      
      // Save to database
      await onSave(updatedRecords);
      
      // Update state
      setEditState(prev => ({
        ...prev,
        currentRows: recalculatedRows.map(row => ({
          ...row,
          originalData: { ...row.currentData },
          isModified: false,
          isNew: false,
        })),
        originalRecords: updatedRecords,
        hasUnsavedChanges: false,
        isRestoring: false,
      }));

      // Show success message
      alert('Cambios guardados exitosamente.');
    } catch (error) {
      console.error('Error saving GPS data:', error);
      alert('Error al guardar los cambios. Por favor intenta nuevamente.');
    } finally {
      setIsSaving(false);
    }
  }, [editState.currentRows, validationSummary.isValid, onSave, convertEditRowsToRecords]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (editState.hasUnsavedChanges) {
      if (confirm('Hay cambios sin guardar. ¿Estás seguro de cancelar? Se perderán todos los cambios.')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  }, [editState.hasUnsavedChanges, onCancel]);

  // Calculate comprehensive metrics for display
  const metrics = calculateComprehensiveMetrics(editState.currentRows);

  return (
    <div className="gps-editor">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Editar Datos GPS</h2>
          <p className="text-sm text-gray-600 mt-1">
            Partido ID: {matchId} · Categoría: {category}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {editState.hasUnsavedChanges && (
            <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
              <AlertTriangle size={16} />
              <span>Cambios sin guardar</span>
            </div>
          )}
          
          <button
            type="button"
            className="btn secondary"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History size={16} />
            Historial
          </button>
          
          <button
            type="button"
            className="btn secondary"
            onClick={handleRestoreOriginal}
            disabled={!editState.hasUnsavedChanges}
          >
            <Undo size={16} />
            Restaurar Original
          </button>
          
          <button
            type="button"
            className="btn secondary"
            onClick={handleCancel}
          >
            <X size={16} />
            Cancelar
          </button>
          
          <button
            type="button"
            className="btn"
            onClick={handleSave}
            disabled={!validationSummary.isValid || isSaving || !editState.hasUnsavedChanges}
          >
            {isSaving ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={16} />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-sm text-gray-600 mb-1">Distancia Total Promedio</p>
          <p className="text-2xl font-bold text-gray-900">
            {(metrics.teamAverage.totalDistance / 1000).toFixed(1)} km
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600 mb-1">Player Load Promedio</p>
          <p className="text-2xl font-bold text-gray-900">
            {metrics.teamAverage.playerLoad.toFixed(0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600 mb-1">Sprints Promedio</p>
          <p className="text-2xl font-bold text-gray-900">
            {metrics.teamAverage.sprints.toFixed(0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600 mb-1">Jugadores Activos</p>
          <p className="text-2xl font-bold text-gray-900">
            {editState.currentRows.filter(r => !r.isDeleted).length}
          </p>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Historial de Cambios</h3>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600"
              onClick={() => setShowHistory(false)}
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {gpsHistoryManager.getMatchHistory(matchId).length === 0 ? (
              <p className="text-gray-500 text-center py-4">No hay cambios registrados</p>
            ) : (
              <ul className="space-y-2">
                {gpsHistoryManager.getMatchHistory(matchId).map((entry) => (
                  <li key={entry.id} className="text-sm p-2 bg-gray-50 rounded">
                    <span className="text-gray-600">
                      {new Date(entry.timestamp).toLocaleString('es-ES')} - 
                    </span>
                    <span className="font-medium">{entry.userName}</span>
                    <span className="text-gray-600">
                      {' '}modificó {entry.field} de {entry.playerName}:{' '}
                    </span>
                    <span className="text-red-600">{entry.oldValue}</span>
                    <span className="text-gray-600"> → </span>
                    <span className="text-green-600">{entry.newValue}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Editable Table */}
      <GPSEditableTable
        rows={editState.currentRows}
        players={players}
        onChange={handleRowChange}
        onAddPlayer={handleAddPlayer}
        onDeleteRow={handleDeleteRow}
        onChangePlayer={handleChangePlayer}
        disabled={isSaving}
      />

      {/* Validation Summary */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {validationSummary.totalErrors > 0 && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={16} />
              <span>{validationSummary.totalErrors} errores de validación</span>
            </div>
          )}
          {validationSummary.totalWarnings > 0 && (
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle size={16} />
              <span>{validationSummary.totalWarnings} advertencias</span>
            </div>
          )}
          {validationSummary.isValid && validationSummary.totalErrors === 0 && editState.currentRows.length > 0 && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle size={16} />
              <span>Todos los datos son válidos</span>
            </div>
          )}
        </div>
        
        <div className="text-sm text-gray-600">
          {editState.currentRows.filter(r => r.isModified).length} filas modificadas
        </div>
      </div>
    </div>
  );
}
