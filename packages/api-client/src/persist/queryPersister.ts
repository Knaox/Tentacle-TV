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
  /** v4 comme v5 : un évènement à chaque ajout, retrait ou mise à jour d'une
   *  requête. Absent (client factice des tests) : on sauve à chaque tic. */
  subscribe?(listener: (event: QueryCacheEventLike | undefined) => void): () => void;
}
/** Ce que la persistance lit d'un évènement du cache — v4 comme v5. */
interface QueryCacheEventLike {
  type: string;
  action?: { type?: string };
  /** La requête concernée. Absente (client factice des tests) : prise en compte. */
  query?: { queryKey: unknown };
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
  /**
   * À QUI appartiennent ces données. Le cache n'est rendu qu'au compte qui l'a
   * produit ; une sauvegarde étiquetée autrement est ignorée.
   *
   * # Pourquoi une étiquette, et pas un simple effacement
   *
   * Ce persister sauvegarde aussi sur `beforeunload` et `pagehide`. Un code qui
   * change de compte efface donc le stockage puis navigue — et la navigation
   * déclenche aussitôt une sauvegarde du cache EN MÉMOIRE, qui appartient encore
   * au compte qu'on quitte. C'est ce qui faisait qu'un admin sorti du mode
   * impersonation retrouvait les reprises de lecture de l'autre.
   *
   * L'étiquette est lue AU MOMENT DE L'ATTACHE, pas à la sauvegarde : elle
   * désigne le compte dont les données sont en mémoire, et celles-ci ne
   * changent jamais d'identité sans un rechargement complet de la page.
   *
   * Laisser à `undefined` désactive la vérification (comportement d'origine,
   * conservé pour les clients à compte unique).
   */
  owner?: string | null;
  /** Clé de stockage. */
  storageKey?: string;
  /** Intervalle de sauvegarde en ms. Défaut 10s. */
  saveInterval?: number;
  /** TTL des entrées au boot — si dataUpdatedAt < now - maxAge, on ignore. */
  maxAge?: number;
  /** Limite de taille du JSON sérialisé (sécurité). Défaut 2 Mo. */
  maxBytes?: number;
  /**
   * Second filtre, APRÈS la whitelist, entrée par entrée — à l'hydratation
   * comme à la sauvegarde. Sert à borner un préfixe ouvert : « reco-page »
   * ne garde que la page « all » et celle du filtre sauvegardé, pas chaque
   * combinaison essayée.
   */
  shouldPersist?: (queryKey: readonly unknown[]) => boolean;
}

interface PersistedEntry {
  data: unknown;
  dataUpdatedAt: number;
}

/** Contenu du stockage : les données, et le compte à qui elles appartiennent. */
interface PersistedPayload {
  owner: string | null;
  entries: Record<string, PersistedEntry>;
}

/**
 * Lit le stockage, format hérité compris.
 *
 * L'ancien format était la carte d'entrées NUE. Ses clés sont toujours des
 * tableaux JSON (`["resume-items"]`), donc aucune ne peut se confondre avec
 * `entries` : la détection est sûre. Une sauvegarde héritée n'a pas de
 * propriétaire connu — elle sera donc écartée dès qu'on en exige un, au prix
 * d'un seul démarrage à froid.
 */
function readPayload(raw: string): PersistedPayload | null {
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== "object") return null;
  const candidate = parsed as { owner?: unknown; entries?: unknown };
  if (candidate.entries !== null && typeof candidate.entries === "object") {
    return {
      owner: typeof candidate.owner === "string" ? candidate.owner : null,
      entries: candidate.entries as Record<string, PersistedEntry>,
    };
  }
  return { owner: null, entries: parsed as Record<string, PersistedEntry> };
}

/**
 * L'entrée décrit-elle une absence ? Un élément sans la moindre image en est le
 * cas typique.
 *
 * Une affiche qui manque n'est pas un fait acquis : elle arrive souvent plus
 * tard, quand le serveur a fini de récupérer ses métadonnées. Or ce cache rend
 * la réponse telle qu'elle était, avec ses trous, et la donne pour aussi fraîche
 * qu'au moment où elle a été reçue — jusqu'à vingt-quatre heures. Sur les hubs
 * dont la fraîcheur se compte en dizaines de minutes, un démarrage à froid
 * réaffichait donc les mêmes cases vides sans rien redemander.
 *
 * On ne jette pas ces données — l'écran resterait vide pour rien. On les rend
 * simplement PÉRIMÉES, ce qui déclenche un rafraîchissement dès l'affichage.
 *
 * La description n'entre volontairement pas dans le test : plusieurs hubs ne la
 * demandent pas dans leurs champs, tous seraient donc éternellement périmés.
 */
function hasMissingArtwork(data: unknown): boolean {
  const items = Array.isArray(data)
    ? data
    : (data as { Items?: unknown[] } | null)?.Items;
  if (!Array.isArray(items) || items.length === 0) return false;

  return items.some((raw) => {
    if (!raw || typeof raw !== "object") return false;
    const item = raw as { ImageTags?: Record<string, unknown>; BackdropImageTags?: unknown[] };
    const noPoster = !item.ImageTags || Object.keys(item.ImageTags).length === 0;
    const noBackdrop = !Array.isArray(item.BackdropImageTags) || item.BackdropImageTags.length === 0;
    return noPoster && noBackdrop;
  });
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
    const payload = readPayload(raw);
    if (payload === null) return;
    // Le cache d'un autre compte n'est pas une donnée périmée à rafraîchir :
    // c'est le contenu de quelqu'un d'autre. On le jette, sans discuter.
    if (opts.owner !== undefined && payload.owner !== opts.owner) {
      try { await Promise.resolve(storage.removeItem(key)); } catch { /* ignore */ }
      return;
    }
    const now = Date.now();
    for (const [keyJson, entry] of Object.entries(payload.entries)) {
      if (!entry || typeof entry !== "object") continue;
      if (now - (entry.dataUpdatedAt ?? 0) > maxAge) continue;
      try {
        const queryKey = JSON.parse(keyJson) as unknown[];
        if (!Array.isArray(queryKey) || queryKey.length === 0) continue;
        const prefix = queryKey[0];
        if (typeof prefix !== "string" || !opts.whitelist.includes(prefix)) continue;
        if (opts.shouldPersist && !opts.shouldPersist(queryKey)) continue;
        // Périmée d'office si elle décrit des absences : affichée tout de suite,
        // mais redemandée dans la foulée plutôt que tenue pour acquise.
        const updatedAt = hasMissingArtwork(entry.data) ? 0 : entry.dataUpdatedAt;
        qc.setQueryData(queryKey, entry.data, { updatedAt });
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
  // Figé ici, et pas relu à chaque sauvegarde : il désigne le compte dont les
  // données sont EN MÉMOIRE. Le relire à la sauvegarde donnerait la réponse
  // exactement fausse — au `pagehide` d'une sortie d'impersonation, le compte
  // courant est déjà redevenu l'admin alors que le cache est celui de l'autre.
  const owner = opts.owner ?? null;

  // Ce qui entre dans la sauvegarde : un préfixe de la liste, et l'accord du
  // filtre s'il y en a un. Partagé par la sauvegarde et par le guet du cache.
  const persisted = (queryKey: unknown): boolean => {
    if (!Array.isArray(queryKey) || queryKey.length === 0) return false;
    const prefix = queryKey[0];
    if (typeof prefix !== "string" || !opts.whitelist.includes(prefix)) return false;
    return !opts.shouldPersist || opts.shouldPersist(queryKey);
  };

  const save = async (): Promise<void> => {
    try {
      const all = qc.getQueryCache().findAll();

      // Candidats sérialisés un par un : une query au `data` non sérialisable
      // (cycle, BigInt…) ne doit pas faire tomber la persistance des autres —
      // même isolation qu'à l'hydratation. La sérialisation individuelle sert
      // aussi à connaître le coût de chaque entrée AVANT d'arbitrer.
      const candidates: Array<{ keyJson: string; entry: PersistedEntry; json: string }> = [];
      for (const q of all) {
        const queryKey = q.queryKey;
        if (!persisted(queryKey)) continue;
        const state = q.state;
        if (state.status !== "success" || state.data === undefined) continue;
        try {
          const keyJson = JSON.stringify(queryKey);
          const entry: PersistedEntry = { data: state.data, dataUpdatedAt: state.dataUpdatedAt };
          // La paire telle qu'elle sera ÉCRITE : `keyJson` re-échappé en clé
          // d'objet. Sérialisée une seule fois — elle sert au budget puis,
          // telle quelle, à la charge (plus de seconde sérialisation du tout).
          candidates.push({ keyJson, entry, json: `${JSON.stringify(keyJson)}:${JSON.stringify(entry)}` });
        } catch {
          // Entrée non sérialisable — ignorée, le reste est conservé
        }
      }

      // Éviction par fraîcheur plutôt qu'abandon global : au-delà du budget on
      // GARDE les données les plus récentes au lieu de tout jeter. L'ancien
      // `return` sur dépassement laissait le cache vide en permanence dès que
      // les hubs volumineux (next-up) saturaient les 2 Mo — donc plus aucun
      // cold start instantané, silencieusement.
      candidates.sort((a, b) => b.entry.dataUpdatedAt - a.entry.dataUpdatedAt);
      const kept: string[] = [];
      // L'enveloppe compte dans le budget : sur tvOS il vaut le plafond de
      // NSUserDefaults, pas une marge de confort.
      const head = `{"owner":${JSON.stringify(owner)},"entries":{`;
      let total = head.length + 2;
      for (const c of candidates) {
        const cost = c.json.length + 1; // la `,` de séparation
        if (total + cost > maxBytes) continue; // trop gros : on tente les suivants, plus petits
        kept.push(c.json);
        total += cost;
      }

      // Même JSON que `JSON.stringify({ owner, entries })`, assemblé depuis
      // les paires déjà sérialisées.
      await Promise.resolve(storage.setItem(key, `${head}${kept.join(",")}}}`));
    } catch {
      // Sauvegarde best-effort — silencieux en cas d'erreur
    }
  };

  // Une sauvegarde ne part que si le cache a BOUGÉ depuis la précédente. Avant,
  // chaque tic resérialisait tout le cache persisté — des centaines de ko sur
  // le fil JS d'un boîtier Android, toutes les dix secondes, défilement ou non.
  // Seuls comptent une donnée reçue (ou posée) et un retrait : un changement
  // d'état de fetch ne change rien à ce qu'on écrirait.
  //
  // Et seulement pour une requête qui ENTRE dans la sauvegarde. Toute requête
  // réussie marquait le cache à sauver : une page de bibliothèque qui défile en
  // monte des centaines — état de visionnage de chaque carte, pages suivantes —
  // dont aucune n'est persistée, et chacune relançait au tic suivant la
  // sérialisation complète et l'écriture synchrone du stockage. Mesuré sur un
  // téléviseur : 230 ms de fil principal bloqué en plein défilement, pour
  // réécrire à l'identique ce qui était déjà sur le disque.
  let dirty = true;
  const unsubscribe = qc.getQueryCache().subscribe?.((event) => {
    if (!event) return;
    const changed = event.type === "removed" || (event.type === "updated" && event.action?.type === "success");
    if (!changed) return;
    if (event.query && !persisted(event.query.queryKey)) return;
    dirty = true;
  });
  const timer = setInterval(() => {
    if (!dirty) return;
    dirty = false;
    void save();
  }, interval);

  // Sauvegarde aussi sur unload (web) ou app background (RN — l'appelant peut écouter AppState et appeler la fonction)
  const onBeforeUnload = () => { void save(); };
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onBeforeUnload);
  }

  return () => {
    clearInterval(timer);
    unsubscribe?.();
    if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onBeforeUnload);
    }
    void save();
  };
}

// La whitelist vit dans persistWhitelist.ts ; ré-exportée pour les importeurs
// historiques (web, mobile, TV passent par l'index).
export { HOME_PERSIST_WHITELIST } from "./persistWhitelist";
