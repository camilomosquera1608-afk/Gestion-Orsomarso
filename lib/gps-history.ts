// GPS History System - Change Tracking and Audit Trail
// Professional change tracking for GPS data editing with full audit capabilities

import type {
  GPSEditHistoryEntry,
  GPSEditRow,
  GPSEditableData
} from './gps-editor-types';

/**
 * GPS History Manager - Manages change history for GPS data
 */
export class GPSHistoryManager {
  private history: GPSEditHistoryEntry[] = [];
  private maxHistoryEntries: number = 1000;
  
  constructor(maxHistoryEntries: number = 1000) {
    this.maxHistoryEntries = maxHistoryEntries;
  }
  
  /**
   * Record a change to GPS data
   */
  recordChange(
    userId: string,
    userName: string,
    matchId: string,
    row: GPSEditRow,
    field: keyof GPSEditableData,
    oldValue: any,
    newValue: any,
    reason?: string
  ): GPSEditHistoryEntry {
    const entry: GPSEditHistoryEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      userId,
      userName,
      matchId,
      playerId: row.currentData.playerId,
      playerName: row.currentData.playerName,
      field,
      oldValue,
      newValue,
      reason,
    };
    
    this.history.unshift(entry);
    
    // Enforce max history entries
    if (this.history.length > this.maxHistoryEntries) {
      this.history = this.history.slice(0, this.maxHistoryEntries);
    }
    
    return entry;
  }
  
  /**
   * Record multiple changes at once (batch operation)
   */
  recordBatchChange(
    userId: string,
    userName: string,
    matchId: string,
    changes: {
      row: GPSEditRow;
      field: keyof GPSEditableData;
      oldValue: any;
      newValue: any;
    }[],
    reason?: string
  ): GPSEditHistoryEntry[] {
    const entries: GPSEditHistoryEntry[] = [];
    
    for (const change of changes) {
      const entry = this.recordChange(
        userId,
        userName,
        matchId,
        change.row,
        change.field,
        change.oldValue,
        change.newValue,
        reason
      );
      entries.push(entry);
    }
    
    return entries;
  }
  
  /**
   * Get history for a specific match
   */
  getMatchHistory(matchId: string): GPSEditHistoryEntry[] {
    return this.history.filter(entry => entry.matchId === matchId);
  }
  
  /**
   * Get history for a specific player
   */
  getPlayerHistory(playerId: string): GPSEditHistoryEntry[] {
    return this.history.filter(entry => entry.playerId === playerId);
  }
  
  /**
   * Get history for a specific user
   */
  getUserHistory(userId: string): GPSEditHistoryEntry[] {
    return this.history.filter(entry => entry.userId === userId);
  }
  
  /**
   * Get history for a specific field
   */
  getFieldHistory(field: string): GPSEditHistoryEntry[] {
    return this.history.filter(entry => entry.field === field);
  }
  
  /**
   * Get history with filters
   */
  getFilteredHistory(filters: {
    matchId?: string;
    playerId?: string;
    userId?: string;
    field?: string;
    startDate?: Date;
    endDate?: Date;
  }): GPSEditHistoryEntry[] {
    let filtered = this.history;
    
    if (filters.matchId) {
      filtered = filtered.filter(entry => entry.matchId === filters.matchId);
    }
    
    if (filters.playerId) {
      filtered = filtered.filter(entry => entry.playerId === filters.playerId);
    }
    
    if (filters.userId) {
      filtered = filtered.filter(entry => entry.userId === filters.userId);
    }
    
    if (filters.field) {
      filtered = filtered.filter(entry => entry.field === filters.field);
    }
    
    if (filters.startDate) {
      filtered = filtered.filter(entry => entry.timestamp >= filters.startDate!.getTime());
    }
    
    if (filters.endDate) {
      filtered = filtered.filter(entry => entry.timestamp <= filters.endDate!.getTime());
    }
    
    return filtered;
  }
  
  /**
   * Get recent history (last N entries)
   */
  getRecentHistory(limit: number = 50): GPSEditHistoryEntry[] {
    return this.history.slice(0, limit);
  }
  
  /**
   * Get change statistics
   */
  getStatistics(matchId?: string): {
    totalChanges: number;
    changesByUser: Map<string, number>;
    changesByField: Map<string, number>;
    changesByPlayer: Map<string, number>;
    changesByDate: Map<string, number>;
  } {
    const relevantHistory = matchId 
      ? this.getMatchHistory(matchId)
      : this.history;
    
    const changesByUser = new Map<string, number>();
    const changesByField = new Map<string, number>();
    const changesByPlayer = new Map<string, number>();
    const changesByDate = new Map<string, number>();
    
    for (const entry of relevantHistory) {
      // Count by user
      changesByUser.set(
        entry.userName,
        (changesByUser.get(entry.userName) || 0) + 1
      );
      
      // Count by field
      changesByField.set(
        entry.field,
        (changesByField.get(entry.field) || 0) + 1
      );
      
      // Count by player
      changesByPlayer.set(
        entry.playerName,
        (changesByPlayer.get(entry.playerName) || 0) + 1
      );
      
      // Count by date
      const date = new Date(entry.timestamp).toLocaleDateString();
      changesByDate.set(
        date,
        (changesByDate.get(date) || 0) + 1
      );
    }
    
    return {
      totalChanges: relevantHistory.length,
      changesByUser,
      changesByField,
      changesByPlayer,
      changesByDate,
    };
  }
  
  /**
   * Clear history for a specific match
   */
  clearMatchHistory(matchId: string): void {
    this.history = this.history.filter(entry => entry.matchId !== matchId);
  }
  
  /**
   * Clear all history
   */
  clearAllHistory(): void {
    this.history = [];
  }
  
  /**
   * Export history as JSON
   */
  exportHistory(matchId?: string): string {
    const relevantHistory = matchId 
      ? this.getMatchHistory(matchId)
      : this.history;
    
    return JSON.stringify(relevantHistory, null, 2);
  }
  
  /**
   * Import history from JSON
   */
  importHistory(json: string): void {
    try {
      const imported = JSON.parse(json) as GPSEditHistoryEntry[];
      
      // Validate imported entries
      for (const entry of imported) {
        if (!this.validateHistoryEntry(entry)) {
          console.warn('Invalid history entry skipped:', entry);
          continue;
        }
        
        this.history.push(entry);
      }
      
      // Sort by timestamp (newest first)
      this.history.sort((a, b) => b.timestamp - a.timestamp);
      
      // Enforce max entries
      if (this.history.length > this.maxHistoryEntries) {
        this.history = this.history.slice(0, this.maxHistoryEntries);
      }
    } catch (error) {
      console.error('Failed to import history:', error);
      throw new Error('Invalid history data format');
    }
  }
  
  /**
   * Validate a history entry
   */
  private validateHistoryEntry(entry: GPSEditHistoryEntry): boolean {
    return !!(
      entry.id &&
      entry.timestamp &&
      entry.userId &&
      entry.userName &&
      entry.matchId &&
      entry.playerId &&
      entry.playerName &&
      entry.field
    );
  }
  
  /**
   * Generate a unique ID for history entries
   */
  private generateId(): string {
    return `gps-hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get current history size
   */
  getHistorySize(): number {
    return this.history.length;
  }
}

/**
 * Global GPS History Manager instance
 */
export const gpsHistoryManager = new GPSHistoryManager();

/**
 * Helper function to format history entry for display
 */
export function formatHistoryEntry(entry: GPSEditHistoryEntry): string {
  const date = new Date(entry.timestamp).toLocaleString('es-ES');
  const fieldLabel = getFieldLabel(entry.field);
  
  return `${date} - ${entry.userName} modificó ${fieldLabel} de ${entry.playerName}: ${entry.oldValue} → ${entry.newValue}`;
}

/**
 * Get human-readable label for a field
 */
function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    minutes: 'Minutos',
    totalDistance: 'Distancia Total',
    metersPerMinute: 'm/min',
    highSpeedDistance: 'Distancia Alta Velocidad',
    sprintDistance: 'Distancia Sprint',
    hsr: 'HSR',
    sprints: 'Sprints',
    maxVelocity: 'Velocidad Máxima',
    acc: 'Aceleraciones',
    dcc: 'Desaceleraciones',
    rhie: 'RHIE',
    playerLoad: 'Player Load',
    playerLoadPerMin: 'Player Load/min',
    playerId: 'Jugador',
    playerName: 'Nombre',
    ima: 'IMA',
  };
  
  return labels[field] || field;
}

/**
 * Create a history entry from a row change
 */
export function createHistoryEntryFromRowChange(
  userId: string,
  userName: string,
  matchId: string,
  row: GPSEditRow,
  field: keyof GPSEditableData,
  oldValue: any,
  newValue: any,
  reason?: string
): GPSEditHistoryEntry {
  return {
    id: `gps-hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    userId,
    userName,
    matchId,
    playerId: row.currentData.playerId,
    playerName: row.currentData.playerName,
    field,
    oldValue,
    newValue,
    reason,
  };
}
