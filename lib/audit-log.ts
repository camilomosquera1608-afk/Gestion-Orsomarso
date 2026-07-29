// Audit log system for tracking changes

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'export' | 'view';
  entityType: 'player' | 'wellness' | 'competition' | 'training' | 'configuration';
  entityId: string;
  entityName: string;
  changes: Record<string, { from: any; to: any }>;
  metadata?: Record<string, any>;
}

class AuditLog {
  private logs: AuditLogEntry[] = [];
  private maxLogs: number = 1000;

  add(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const logEntry: AuditLogEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.logs.unshift(logEntry);

    // Enforce max logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    this.persist();
    return logEntry;
  }

  private generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getLogs(filters?: {
    userId?: string;
    entityType?: string;
    action?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
  }): AuditLogEntry[] {
    let filtered = this.logs;

    if (filters?.userId) {
      filtered = filtered.filter(log => log.userId === filters.userId);
    }
    if (filters?.entityType) {
      filtered = filtered.filter(log => log.entityType === filters.entityType);
    }
    if (filters?.action) {
      filtered = filtered.filter(log => log.action === filters.action);
    }
    if (filters?.entityId) {
      filtered = filtered.filter(log => log.entityId === filters.entityId);
    }
    if (filters?.startDate) {
      filtered = filtered.filter(log => log.timestamp >= filters.startDate!.getTime());
    }
    if (filters?.endDate) {
      filtered = filtered.filter(log => log.timestamp <= filters.endDate!.getTime());
    }

    return filtered;
  }

  getEntityHistory(entityId: string): AuditLogEntry[] {
    return this.getLogs({ entityId });
  }

  getUserActivity(userId: string, limit: number = 50): AuditLogEntry[] {
    return this.getLogs({ userId }).slice(0, limit);
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('audit-log', JSON.stringify(this.logs));
    } catch (error) {
      console.warn('Failed to persist audit log:', error);
    }
  }

  public load(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem('audit-log');
      if (saved) {
        this.logs = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load audit log:', error);
    }
  }

  clear(): void {
    this.logs = [];
    this.persist();
  }

  export(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  getStats(): {
    total: number;
    byAction: Record<string, number>;
    byEntityType: Record<string, number>;
    byUser: Record<string, number>;
  } {
    const byAction: Record<string, number> = {};
    const byEntityType: Record<string, number> = {};
    const byUser: Record<string, number> = {};

    this.logs.forEach(log => {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byEntityType[log.entityType] = (byEntityType[log.entityType] || 0) + 1;
      byUser[log.userName] = (byUser[log.userName] || 0) + 1;
    });

    return {
      total: this.logs.length,
      byAction,
      byEntityType,
      byUser,
    };
  }
}

// Singleton instance
export const auditLog = new AuditLog();

// Initialize on load
if (typeof window !== 'undefined') {
  auditLog.load();
}

// Helper functions for common audit operations
export function logPlayerChange(
  userId: string,
  userName: string,
  playerId: string,
  playerName: string,
  changes: Record<string, { from: any; to: any }>
) {
  return auditLog.add({
    userId,
    userName,
    action: 'update',
    entityType: 'player',
    entityId: playerId,
    entityName: playerName,
    changes,
  });
}

export function logWellnessEntry(
  userId: string,
  userName: string,
  playerId: string,
  playerName: string,
  changes: Record<string, { from: any; to: any }>
) {
  return auditLog.add({
    userId,
    userName,
    action: 'create',
    entityType: 'wellness',
    entityId: playerId,
    entityName: playerName,
    changes,
  });
}

export function logCompetitionEntry(
  userId: string,
  userName: string,
  matchId: string,
  matchName: string,
  changes: Record<string, { from: any; to: any }>
) {
  return auditLog.add({
    userId,
    userName,
    action: 'create',
    entityType: 'competition',
    entityId: matchId,
    entityName: matchName,
    changes,
  });
}
