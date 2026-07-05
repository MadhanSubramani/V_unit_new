const DEFAULT_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = {
  data: T;
  expires: number;
};

export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private inflight = new Map<string, Promise<T>>();

  constructor(private ttlMs: number = DEFAULT_TTL_MS) {}

  async get(key: string, loader: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);
    if (hit && hit.expires > Date.now()) {
      return hit.data;
    }

    const pending = this.inflight.get(key);
    if (pending) {
      return pending;
    }

    const promise = loader()
      .then((data) => {
        this.store.set(key, { data, expires: Date.now() + this.ttlMs });
        this.inflight.delete(key);
        return data;
      })
      .catch((error) => {
        this.inflight.delete(key);
        throw error;
      });

    this.inflight.set(key, promise);
    return promise;
  }

  invalidate(key?: string) {
    if (key) {
      this.store.delete(key);
      this.inflight.delete(key);
      return;
    }
    this.store.clear();
    this.inflight.clear();
  }
}

export const lookupCache = new MemoryCache<unknown>(DEFAULT_TTL_MS);

export const cacheKeys = {
  kyc: "lookup:kyc",
  cfs: "lookup:cfs",
  sez: "lookup:sez",
  config: (category: string) => `lookup:config:${category}`,
} as const;
