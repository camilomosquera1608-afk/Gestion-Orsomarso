"use client";

import { idbEngine } from "./indexed-db-engine";
import { supabase, hasSupabaseConfig } from "./supabase";

export interface PendingSyncItem {
  id: string;
  table: string;
  action: "upsert" | "delete";
  payload: any;
  timestamp: number;
  retryCount: number;
}

const QUEUE_STORAGE_KEY = "orsomarso_offline_sync_queue_v1";

class OfflineSyncQueueManager {
  private queue: PendingSyncItem[] = [];
  private isProcessing = false;

  constructor() {
    this.loadQueue();
  }

  private async loadQueue() {
    try {
      const stored = await idbEngine.getItem<PendingSyncItem[]>(QUEUE_STORAGE_KEY);
      this.queue = Array.isArray(stored) ? stored : [];
    } catch {
      this.queue = [];
    }
  }

  private async saveQueue() {
    try {
      await idbEngine.setItem(QUEUE_STORAGE_KEY, this.queue);
    } catch (e) {
      console.warn("[OfflineQueue] Error guardando cola en IndexedDB:", e);
    }
  }

  public async enqueue(table: string, action: "upsert" | "delete", payload: any) {
    const item: PendingSyncItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      table,
      action,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(item);
    await this.saveQueue();
    console.log(`[OfflineQueue] Operación encolada para '${table}' (${action}):`, item.id);

    // Intentar vaciar la cola de inmediato si hay conexión
    if (typeof window !== "undefined" && navigator.onLine) {
      this.flushQueue();
    }
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getQueueItems(): PendingSyncItem[] {
    return [...this.queue];
  }

  public async flushQueue(): Promise<{ processed: number; remaining: number }> {
    if (this.isProcessing || !this.queue.length || !supabase || !hasSupabaseConfig) {
      return { processed: 0, remaining: this.queue.length };
    }

    this.isProcessing = true;
    let processed = 0;
    const remainingQueue: PendingSyncItem[] = [];

    for (const item of this.queue) {
      try {
        let success = false;

        if (item.action === "upsert") {
          const { error } = await supabase
            .from(item.table)
            .upsert(item.payload, { onConflict: "legacy_id" });
          if (!error) success = true;
        } else if (item.action === "delete") {
          const { error } = await supabase
            .from(item.table)
            .delete()
            .eq("legacy_id", item.payload.legacy_id || item.payload.id);
          if (!error) success = true;
        }

        if (success) {
          processed++;
        } else {
          item.retryCount++;
          if (item.retryCount < 10) {
            remainingQueue.push(item);
          } else {
            console.error(`[OfflineQueue] Descartando elemento tras 10 reintentos fallidos:`, item);
          }
        }
      } catch (err) {
        item.retryCount++;
        remainingQueue.push(item);
      }
    }

    this.queue = remainingQueue;
    await this.saveQueue();
    this.isProcessing = false;

    return { processed, remaining: this.queue.length };
  }
}

export const offlineSyncQueue = new OfflineSyncQueueManager();
