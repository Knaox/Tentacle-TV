/**
 * Cache in-memory ultra-léger pour les réponses Jellyfin (proxy).
 *
 * Pourquoi : aujourd'hui chaque appel `/api/jellyfin/Users/.../Items/Latest`
 * (etc.) traverse le réseau jusqu'à Jellyfin. Avec ce cache, plusieurs apps
 * qui demandent la même ressource en quelques secondes obtiennent la réponse
 * directement depuis Tentacle (~1-5 ms vs 200-500 ms).
 *
 * Couverture : seules les routes "lecture seule, lourdes, fréquentes" sont
 * cachées (Latest, Resume, NextUp, Views). Tout le reste passe en direct.
 *
 * Invalidation : automatique à expiration TTL, ET poussée par le WebSocket
 * Jellyfin (LibraryChanged → on vide les entrées Latest, etc.).
 *
 * Storage : LRU borné en mémoire (Map JS, taille max). Pas de Redis pour
 * garder zéro dépendance externe — un seul process backend par déploiement.
 */

interface CacheEntry {
  body: Buffer;
  contentType: string;
  status: number;
  expiresAt: number;
}

const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, CacheEntry>();

/** Carousel → liste de regex de paths à invalider. Doit rester synchronisé
 *  avec `wsManager.ts` côté broadcast. */
const CAROUSEL_INVALIDATION: Record<string, RegExp[]> = {
  recently_added: [/^Users\/[^/]+\/Items\/Latest/i, /^Users\/[^/]+\/Items(\?|$)/i],
  continue_watching: [/^Users\/[^/]+\/Items\/Resume/i],
  next_up: [/^Shows\/NextUp/i],
  watched: [/^Users\/[^/]+\/Items(\?|$)/i],
  watchlist: [/^Users\/[^/]+\/Items(\?|$)/i],
  featured: [/^Users\/[^/]+\/Items(\?|$)/i],
  notifications: [],
};

/** TTL par pattern de path (ms). Court : on veut de la fraîcheur, juste
 *  dédupliquer les requêtes simultanées. */
const TTL_PATTERNS: Array<{ pattern: RegExp; ttlMs: number }> = [
  { pattern: /^Users\/[^/]+\/Items\/Latest/i, ttlMs: 30_000 },
  { pattern: /^Users\/[^/]+\/Items\/Resume/i, ttlMs: 15_000 },
  { pattern: /^Shows\/NextUp/i, ttlMs: 30_000 },
  { pattern: /^Users\/[^/]+\/Views/i, ttlMs: 5 * 60_000 },
];

/** Retourne le TTL applicable (ms) ou null si la route n'est pas cachable. */
export function getCacheTtl(path: string): number | null {
  for (const { pattern, ttlMs } of TTL_PATTERNS) {
    if (pattern.test(path)) return ttlMs;
  }
  return null;
}

function buildCacheKey(path: string, queryString: string, userToken: string | undefined): string {
  // Le token fait partie de la clé : deux users ne doivent jamais partager une réponse
  // (Jellyfin filtre par utilisateur sur Latest/Resume/NextUp).
  const userKey = userToken ? userToken.slice(0, 16) : "anon";
  return `${userKey}|${path}${queryString}`;
}

export function getCached(
  path: string,
  queryString: string,
  userToken: string | undefined,
): CacheEntry | null {
  const key = buildCacheKey(path, queryString, userToken);
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  // LRU touch : déplacer en fin de Map = "le plus récent"
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

export function setCached(
  path: string,
  queryString: string,
  userToken: string | undefined,
  body: Buffer,
  contentType: string,
  status: number,
  ttlMs: number,
): void {
  const key = buildCacheKey(path, queryString, userToken);
  // Ne pas cacher les erreurs ou les réponses énormes (>2 Mo)
  if (status >= 400 || body.byteLength > 2 * 1024 * 1024) return;
  cache.set(key, {
    body,
    contentType,
    status,
    expiresAt: Date.now() + ttlMs,
  });
  // Eviction LRU : on supprime la plus ancienne entrée
  if (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
}

/** Invalide toutes les entrées dont le path matche un des regex liés au carousel. */
export function invalidateByCarousel(carousel: string): void {
  const patterns = CAROUSEL_INVALIDATION[carousel];
  if (!patterns || patterns.length === 0) return;
  let cleared = 0;
  for (const key of Array.from(cache.keys())) {
    // La clé est `userKey|path?qs` — on extrait le path après le séparateur
    const pipeIdx = key.indexOf("|");
    if (pipeIdx < 0) continue;
    const fullPath = key.slice(pipeIdx + 1);
    const path = fullPath.split("?")[0];
    if (patterns.some((p) => p.test(path))) {
      cache.delete(key);
      cleared++;
    }
  }
  if (cleared > 0) {
    // eslint-disable-next-line no-console
    console.debug(`[jellyfinCache] invalidated ${cleared} entries for ${carousel}`);
  }
}

/** Vide tout le cache (utilisé en tests / au reload de config Jellyfin). */
export function clearAll(): void {
  cache.clear();
}

/** Statistiques pour debugging/monitoring. */
export function getStats(): { size: number; maxSize: number } {
  return { size: cache.size, maxSize: CACHE_MAX_ENTRIES };
}
