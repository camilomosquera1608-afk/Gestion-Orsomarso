// Smart caching system with automatic invalidation

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  version: number;
}

interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  enablePersistence: boolean;
}

class SmartCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;
  private version: number = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxSize: 100,
      enablePersistence: true,
      ...config,
    };

    if (this.config.enablePersistence && typeof window !== 'undefined') {
      this.loadFromStorage();
    }
  }

  private generateKey(prefix: string, params: Record<string, any>): string {
    const paramString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join('&');
    return `${prefix}:${paramString}`;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      version: this.version,
    };

    // Enforce max size by removing oldest entries
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, entry);

    if (this.config.enablePersistence) {
      this.saveToStorage();
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      if (this.config.enablePersistence) {
        this.saveToStorage();
      }
      return null;
    }

    // Check if entry is from an old version
    if (entry.version < this.version) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(pattern: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    if (this.config.enablePersistence) {
      this.saveToStorage();
    }
  }

  invalidateAll(): void {
    this.cache.clear();
    this.version++;
    
    if (this.config.enablePersistence) {
      this.saveToStorage();
    }
  }

  getStats(): { size: number; keys: string[]; hitRate: number } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      hitRate: 0, // Would need to track hits/misses
    };
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const serialized = Array.from(this.cache.entries());
      localStorage.setItem('smart-cache', JSON.stringify({
        entries: serialized,
        version: this.version,
      }));
    } catch (error) {
      console.warn('Failed to save cache to storage:', error);
    }
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem('smart-cache');
      if (saved) {
        const { entries, version } = JSON.parse(saved);
        this.cache = new Map(entries);
        this.version = version || 0;
      }
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
    }
  }

  // Helper method for data fetching with cache
  async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttl);
    
    return data;
  }
}

// Singleton instance
export const smartCache = new SmartCache();

// Cache key generators for common queries
export const cacheKeys = {
  players: (params?: { category?: string; status?: string }) => 
    smartCache.generateKey('players', params || {}),
  wellness: (params?: { playerId?: string; date?: string }) => 
    smartCache.generateKey('wellness', params || {}),
  competition: (params?: { matchId?: string; category?: string }) => 
    smartCache.generateKey('competition', params || {}),
  training: (params?: { sessionId?: string; date?: string }) => 
    smartCache.generateKey('training', params || {}),
};

// Add generateKey method to the class
SmartCache.prototype.generateKey = function(prefix: string, params: Record<string, any>): string {
  const paramString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join('&');
  return `${prefix}:${paramString}`;
};
