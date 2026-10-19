// Bounded, account-client-local metadata cache. Never persisted to disk.
export class MetadataCache {
  private entries = new Map<
    string,
    { value: unknown; expires: number; bytes: number }
  >();
  private bytes = 0;
  hits = 0;
  misses = 0;
  revision = 0;
  constructor(
    private maxEntries = 64,
    private maxBytes = 4 * 1024 * 1024,
  ) {}
  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry || entry.expires <= Date.now()) {
      if (entry) this.remove(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value as T;
  }
  set(key: string, value: unknown, ttl: number) {
    const bytes = JSON.stringify(value)?.length * 2 || 0;
    this.remove(key);
    if (!bytes || bytes > this.maxBytes) return;
    this.entries.set(key, { value, bytes, expires: Date.now() + ttl });
    this.bytes += bytes;
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes)
      this.remove(this.entries.keys().next().value!);
  }
  remove(key: string) {
    this.bytes -= this.entries.get(key)?.bytes || 0;
    this.entries.delete(key);
  }
  clear() {
    this.entries.clear();
    this.bytes = 0;
    this.revision++;
  }
  stats() {
    return {
      entries: this.entries.size,
      bytes: this.bytes,
      hits: this.hits,
      misses: this.misses,
    };
  }
}
