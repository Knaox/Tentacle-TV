/* ------------------------------------------------------------------ */
/*  La mémoire PARTAGÉE du catalogue — une requête aux API pour tous    */
/*                                                                     */
/*  Ce qu'une source a répondu pour un titre (les vidéos TMDB d'une    */
/*  saison, les noms et dates d'une série…) s'écrit dans la mémoire    */
/*  globale du serveur (`globalCacheStore`) avec sa validité. Tous les */
/*  comptes la lisent ; deux demandes simultanées partagent un appel ; */
/*  une valeur échue sert encore pendant qu'elle se refait en fond. Un */
/*  échec (`null`) ne s'écrit jamais : la demande suivante réessaie.   */
/*  Rien que des listes de quelques Ko — jamais une vidéo.             */
/* ------------------------------------------------------------------ */

import { readGlobalCache, writeGlobalCache } from "../../globalCacheStore";

export type CatalogPriority = "interactive" | "background";

interface Stored<T> {
  value: T;
  validUntil: number;
}

const DAY_MS = 86_400_000;
/** La ligne reste au-delà de sa validité : échue, elle sert encore. */
const KEEP_ROW_MS = 30 * DAY_MS;

const inflight = new Map<string, Promise<unknown>>();

function isStored(value: unknown): value is Stored<unknown> {
  return !!value && typeof value === "object" && "value" in value && typeof (value as Stored<unknown>).validUntil === "number";
}

function load<T>(key: string, fetcher: (priority: CatalogPriority) => Promise<T | null>, ttlMs: (value: T) => number, priority: CatalogPriority): Promise<T | null> {
  const pending = inflight.get(key) as Promise<T | null> | undefined;
  if (pending) return pending;
  const task = fetcher(priority)
    .then(async (value) => {
      if (value !== null) {
        const stored: Stored<T> = { value, validUntil: Date.now() + ttlMs(value) };
        await writeGlobalCache(key, stored, KEEP_ROW_MS).catch(() => undefined);
      }
      return value;
    })
    .catch(() => null)
    .finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

/**
 * La valeur de `key` : la mémoire si elle vaut ; échue, tout de suite, et
 * refaite en fond ; absente, demandée à `fetcher`. `null` : la source n'a pas
 * répondu (ce n'est pas « rien »).
 */
export async function remembered<T>(
  key: string,
  fetcher: (priority: CatalogPriority) => Promise<T | null>,
  ttlMs: (value: T) => number,
  priority: CatalogPriority = "interactive",
): Promise<T | null> {
  const cached = await readGlobalCache<unknown>(key).catch(() => null);
  if (cached && isStored(cached.payload)) {
    const stored = cached.payload as Stored<T>;
    if (stored.validUntil <= Date.now()) void load(key, fetcher, ttlMs, "background");
    return stored.value;
  }
  return load(key, fetcher, ttlMs, priority);
}

export const days = (n: number) => n * DAY_MS;

/** Pour les tests. */
export function resetCatalogMemory(): void {
  inflight.clear();
}
