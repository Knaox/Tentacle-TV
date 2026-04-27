/**
 * Persister maison pour TanStack Query — compatible v4 (TV) et v5 (web/mobile).
 *
 * Pourquoi un persister custom plutôt que `@tanstack/react-query-persist-client` :
 *  - Pas de dépendance externe à installer (les node_modules ne sont pas
 *    toujours synchronisés sur ce monorepo selon les machines).
 *  - Compatible v4 et v5 sans bump de version (la TV est encore en v4).
 *  - Petite surface API : on ne persiste qu'une whitelist de query keys
 *    (les hubs de la home), pas tout le cache. Évite de stocker des images,
 *    des sessions de lecture en cours, des tokens, etc.
 *
 * Stratégie :
 *  1. `hydrateQueryClient` : à appeler AU MONTAGE, restaure les données
 *     persistées dans le cache via `qc.setQueryData(key, value)`.
 *  2. `attachQueryPersister` : sauvegarde régulièrement (intervalle) ET sur
 *     `beforeunload`/`AppState=background`, en sérialisant les queries dont
 *     la queryKey commence par un préfixe whitelisté.
 *
 * Format storage : un seul JSON avec un mapping queryKeyJSON → { data, dataUpdatedAt }.
 * `dataUpdatedAt` permet à TanStack de connaître la fraîcheur — combiné au
 * `staleTime` du hook, on évite de re-render avec des données ancienne.
 */

/**
 * Interface QueryClient minimale — duck typing pour rester compatible TanStack
 * Query v4 (TV) et v5 (web/mobile). Évite l'import direct du type QueryClient
 * qui change entre versions et crée des conflits de modules dans le monorepo.
 */
interface QueryCacheLike {
  findAll(): Array<{ queryKey: unknown; state: { status: string; data: unknown; dataUpdatedAt: number } }>;
}
interface QueryClientLike {
  setQueryData(queryKey: unknown, data: unknown, options?: { updatedAt?: number }): unknown;
  getQueryCache(): QueryCacheLike;
}

/** Adapter storage minimal — compatible localStorage (sync) et AsyncStorage (async). */
export interface PersistStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface PersisterOptions {
  /** Préfixes de query keys à persister (ex: ["resume-items", "latest-items"]). */
  whitelist: readonly string[];
  /** Clé de stockage. */
  storageKey?: string;
  /** Intervalle de sauvegarde en ms. Défaut 10s. */
  saveInterval?: number;
  /** TTL des entrées au boot — si dataUpdatedAt < now - maxAge, on ignore. */
  maxAge?: number;
  /** Limite de taille du JSON sérialisé (sécurité). Défaut 2 Mo. */
  maxBytes?: number;
}

interface PersistedEntry {
  data: unknown;
  dataUpdatedAt: number;
}

const DEFAULT_KEY = "tentacle_query_cache_v1";
const DEFAULT_INTERVAL = 10_000;
const DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000; // 24 h
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 Mo

/** Hydrate le cache depuis le storage. À appeler avant de monter le provider. */
export async function hydrateQueryClient(
  qc: QueryClientLike,
  storage: PersistStorage,
  opts: PersisterOptions,
): Promise<void> {
  const key = opts.storageKey ?? DEFAULT_KEY;
  const maxAge = opts.maxAge ?? DEFAULT_MAX_AGE;
  try {
    const raw = await Promise.resolve(storage.getItem(key));
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, PersistedEntry>;
    const now = Date.now();
    for (const [keyJson, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== "object") continue;
      if (now - (entry.dataUpdatedAt ?? 0) > maxAge) continue;
      try {
        const queryKey = JSON.parse(keyJson) as unknown[];
        if (!Array.isArray(queryKey) || queryKey.length === 0) continue;
        const prefix = queryKey[0];
        if (typeof prefix !== "string" || !opts.whitelist.includes(prefix)) continue;
        qc.setQueryData(queryKey, entry.data, { updatedAt: entry.dataUpdatedAt });
      } catch {
        // Une entrée corrompue ne doit pas bloquer le reste
      }
    }
  } catch {
    // Storage corrompu : on ignore, le cache repartira de zéro
    try { await Promise.resolve(storage.removeItem(key)); } catch { /* ignore */ }
  }
}

/** Attache la persistance au QueryClient. Retourne une fonction de désinscription. */
export function attachQueryPersister(
  qc: QueryClientLike,
  storage: PersistStorage,
  opts: PersisterOptions,
): () => void {
  const key = opts.storageKey ?? DEFAULT_KEY;
  const interval = opts.saveInterval ?? DEFAULT_INTERVAL;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  const save = async (): Promise<void> => {
    try {
      const all = qc.getQueryCache().findAll();
      const out: Record<string, PersistedEntry> = {};
      for (const q of all) {
        const queryKey = q.queryKey;
        if (!Array.isArray(queryKey) || queryKey.length === 0) continue;
        const prefix = queryKey[0];
        if (typeof prefix !== "string" || !opts.whitelist.includes(prefix)) continue;
        const state = q.state;
        if (state.status !== "success" || state.data === undefined) continue;
        out[JSON.stringify(queryKey)] = {
          data: state.data,
          dataUpdatedAt: state.dataUpdatedAt,
        };
      }
      const serialized = JSON.stringify(out);
      if (serialized.length > maxBytes) return; // Skip — trop gros, on attend la prochaine sauvegarde
      await Promise.resolve(storage.setItem(key, serialized));
    } catch {
      // Sauvegarde best-effort — silencieux en cas d'erreur
    }
  };

  const timer = setInterval(() => { void save(); }, interval);

  // Sauvegarde aussi sur unload (web) ou app background (RN — l'appelant peut écouter AppState et appeler la fonction)
  const onBeforeUnload = () => { void save(); };
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onBeforeUnload);
  }

  return () => {
    clearInterval(timer);
    if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onBeforeUnload);
    }
    void save();
  };
}

/** Whitelist par défaut : les caches de la page d'accueil. */
export const HOME_PERSIST_WHITELIST = [
  "resume-items",
  "latest-items",
  "next-up",
  "watched-items",
  "featured",
  "watchlist",
  "libraries",
  "library-items",
] as const;
