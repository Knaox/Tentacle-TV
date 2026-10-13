/**
 * Une mémoire BORNÉE où chaque entrée a son échéance : relue, une entrée
 * repasse en tête ; pleine, la mémoire oublie la moins récemment servie.
 * Une `Map` suffit — elle garde l'ordre d'insertion.
 */
export class TtlLru<V> {
  private readonly entries = new Map<string, { value: V; until: number }>();

  constructor(private readonly max: number) {}

  get(key: string, now = Date.now()): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.until <= now) return undefined;
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V, ttlMs: number, now = Date.now()): void {
    this.entries.delete(key);
    if (ttlMs <= 0) return;
    this.entries.set(key, { value, until: now + ttlMs });
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
