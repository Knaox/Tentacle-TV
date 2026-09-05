import type { CrawlTarget } from "./poolProviders";

/** Une clé en échec (fiche sans bloc, erreur) repasse après six heures. */
export const CRAWL_FAIL_COOLDOWN_MS = 6 * 3600_000;

/** « movie:603 » — la clé canonique du pool et du cache de métadonnées. */
export function crawlKey(target: CrawlTarget): string {
  return `${target.mediaType}:${target.tmdbId}`;
}

/**
 * La file du crawler : dédoublonnée globalement par clé, organisée en SEAUX
 * (un par compte pour les pools, « served » pour les rangées globales) servis
 * en tour de rôle — un compte à 900 inconnus ne bloque pas les autres. Dans
 * un seau, l'ordre d'arrivée est l'ordre du pool : les mieux classés d'abord.
 * Pure, sans horloge propre : `now` est injecté pour les tests.
 */
export class CrawlQueue {
  private readonly buckets = new Map<string, CrawlTarget[]>();
  private readonly queued = new Set<string>();
  private readonly cooldownUntil = new Map<string, number>();
  private rotation: string[] = [];
  private cursor = 0;

  get size(): number {
    return this.queued.size;
  }

  /** Rend le nombre de cibles réellement ajoutées (doublons et clés en
   *  refroidissement écartés). */
  enqueue(bucket: string, targets: Iterable<CrawlTarget>, now = Date.now()): number {
    let added = 0;
    for (const target of targets) {
      const key = crawlKey(target);
      if (this.queued.has(key)) continue;
      const until = this.cooldownUntil.get(key);
      if (until !== undefined) {
        if (until > now) continue;
        this.cooldownUntil.delete(key);
      }
      let list = this.buckets.get(bucket);
      if (!list) {
        list = [];
        this.buckets.set(bucket, list);
        this.rotation.push(bucket);
      }
      list.push(target);
      this.queued.add(key);
      added++;
    }
    return added;
  }

  /** La prochaine cible, seaux en tour de rôle ; null si la file est vide. */
  next(): { bucket: string; target: CrawlTarget } | null {
    for (let i = 0; i < this.rotation.length; i++) {
      const idx = (this.cursor + i) % this.rotation.length;
      const bucket = this.rotation[idx];
      const list = this.buckets.get(bucket);
      if (!list || list.length === 0) continue;
      const target = list.shift() as CrawlTarget;
      this.queued.delete(crawlKey(target));
      if (list.length === 0) {
        this.buckets.delete(bucket);
        this.rotation.splice(idx, 1);
        this.cursor = this.rotation.length > 0 ? idx % this.rotation.length : 0;
      } else {
        this.cursor = (idx + 1) % this.rotation.length;
      }
      return { bucket, target };
    }
    return null;
  }

  markFailed(key: string, now = Date.now()): void {
    this.cooldownUntil.set(key, now + CRAWL_FAIL_COOLDOWN_MS);
  }

  /** Oublie les refroidissements échus — borne la mémoire. */
  sweep(now = Date.now()): void {
    for (const [key, until] of this.cooldownUntil) {
      if (until <= now) this.cooldownUntil.delete(key);
    }
  }
}
