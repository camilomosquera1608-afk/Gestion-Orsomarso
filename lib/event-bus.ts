type EventCallback<T = any> = (data: T) => void;

type EventType = 
  | 'player:added'
  | 'player:updated'
  | 'player:deleted'
  | 'wellness:added'
  | 'wellness:updated'
  | 'load:added'
  | 'load:updated'
  | 'competition:added'
  | 'competition:updated'
  | 'scout:status_changed'
  | 'report:generated'
  | 'alert:triggered'
  | 'data:synced'
  | 'filter:changed'
  | 'theme:changed';

interface EventListener<T = any> {
  eventType: EventType;
  callback: EventCallback<T>;
  once: boolean;
}

class EventBus {
  private listeners: Map<EventType, EventListener[]> = new Map();

  /**
   * Subscribe to an event
   */
  on<T = any>(eventType: EventType, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    const listener: EventListener<T> = {
      eventType,
      callback,
      once: false,
    };

    this.listeners.get(eventType)!.push(listener);

    // Return unsubscribe function
    return () => this.off(eventType, callback);
  }

  /**
   * Subscribe to an event once
   */
  once<T = any>(eventType: EventType, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    const listener: EventListener<T> = {
      eventType,
      callback,
      once: true,
    };

    this.listeners.get(eventType)!.push(listener);

    // Return unsubscribe function
    return () => this.off(eventType, callback);
  }

  /**
   * Unsubscribe from an event
   */
  off<T = any>(eventType: EventType, callback: EventCallback<T>): void {
    const listeners = this.listeners.get(eventType);
    if (!listeners) return;

    const index = listeners.findIndex(l => l.callback === callback);
    if (index !== -1) {
      listeners.splice(index, 1);
    }

    if (listeners.length === 0) {
      this.listeners.delete(eventType);
    }
  }

  /**
   * Emit an event
   */
  emit<T = any>(eventType: EventType, data?: T): void {
    const listeners = this.listeners.get(eventType);
    if (!listeners || listeners.length === 0) return;

    // Create a copy to avoid issues if listeners are added/removed during emission
    const listenersCopy = [...listeners];

    listenersCopy.forEach(listener => {
      try {
        listener.callback(data);
        
        // Remove one-time listeners after execution
        if (listener.once) {
          this.off(listener.eventType, listener.callback);
        }
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    });
  }

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners(eventType?: EventType): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount(eventType: EventType): number {
    return this.listeners.get(eventType)?.length || 0;
  }

  /**
   * Get all event types with listeners
   */
  eventNames(): EventType[] {
    return Array.from(this.listeners.keys());
  }
}

// Global event bus instance
export const eventBus = new EventBus();

// Convenience functions for common events
export const emitPlayerAdded = (playerId: string) => 
  eventBus.emit('player:added', { playerId });

export const emitPlayerUpdated = (playerId: string) => 
  eventBus.emit('player:updated', { playerId });

export const emitPlayerDeleted = (playerId: string) => 
  eventBus.emit('player:deleted', { playerId });

export const emitWellnessAdded = (playerId: string, date: string) => 
  eventBus.emit('wellness:added', { playerId, date });

export const emitWellnessUpdated = (playerId: string, date: string) => 
  eventBus.emit('wellness:updated', { playerId, date });

export const emitLoadAdded = (playerId: string, date: string) => 
  eventBus.emit('load:added', { playerId, date });

export const emitLoadUpdated = (playerId: string, date: string) => 
  eventBus.emit('load:updated', { playerId, date });

export const emitCompetitionAdded = (playerId: string, date: string) => 
  eventBus.emit('competition:added', { playerId, date });

export const emitCompetitionUpdated = (playerId: string, date: string) => 
  eventBus.emit('competition:updated', { playerId, date });

export const emitScoutStatusChanged = (playerId: string, status: string) => 
  eventBus.emit('scout:status_changed', { playerId, status });

export const emitReportGenerated = (reportId: string, type: string) => 
  eventBus.emit('report:generated', { reportId, type });

export const emitAlertTriggered = (alertId: string, severity: string, message: string) => 
  eventBus.emit('alert:triggered', { alertId, severity, message });

export const emitDataSynced = (source: 'local' | 'supabase', timestamp: string) => 
  eventBus.emit('data:synced', { source, timestamp });

export const emitFilterChanged = (filterType: string, value: any) => 
  eventBus.emit('filter:changed', { filterType, value });

export const emitThemeChanged = (theme: 'light' | 'dark') => 
  eventBus.emit('theme:changed', { theme });
