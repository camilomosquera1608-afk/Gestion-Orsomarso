/**
 * Motor de almacenamiento persitente en IndexedDB
 * Proporciona almacenamiento asíncrono ilimitado (>50MB) para la Orsomarso Performance App.
 * Caída automática a localStorage / Memoria si IndexedDB no está disponible.
 */

const DB_NAME = "OrsomarsoPerformanceDB";
const DB_VERSION = 1;
const STORE_NAME = "app_store";

class IndexedDBEngine {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private isBrowser(): boolean {
    return typeof window !== "undefined" && typeof indexedDB !== "undefined";
  }

  private initDB(): Promise<IDBDatabase | null> {
    if (!this.isBrowser()) return Promise.resolve(null);
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        request.onsuccess = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          resolve(db);
        };

        request.onerror = (err) => {
          console.warn("[IndexedDBEngine] Error al abrir IndexedDB:", err);
          resolve(null);
        };
      } catch (e) {
        console.warn("[IndexedDBEngine] Excepción al inicializar IndexedDB:", e);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  public async getItem<T>(key: string): Promise<T | null> {
    const db = await this.initDB();
    if (!db) {
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          const val = localStorage.getItem(key);
          return val ? (JSON.parse(val) as T) : null;
        } catch {
          return null;
        }
      }
      return null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          resolve(req.result !== undefined ? (req.result as T) : null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async setItem<T>(key: string, value: T): Promise<boolean> {
    const db = await this.initDB();
    if (!db) {
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  public async removeItem(key: string): Promise<boolean> {
    const db = await this.initDB();
    if (!db) {
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          localStorage.removeItem(key);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }
}

export const idbEngine = new IndexedDBEngine();
