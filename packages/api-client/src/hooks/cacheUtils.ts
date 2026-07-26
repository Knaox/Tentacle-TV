import type { QueryClient, InfiniteData } from "@tanstack/react-query";
import type { MediaItem, UserItemData } from "@tentacle-tv/shared";

/**
 * Préfixes de query keys contenant des listes de MediaItem avec UserData.
 * TanStack Query ne refetch que les queries avec observers actifs → pas d'impact perf.
 */
const LIST_QUERY_PREFIXES = [
  "favorites",
  "watchlist",
  "latest-items",
  "resume-items",
  "next-up",
  "watched-items",
  "featured",
  "continue-watching",
  "library",
  "episodes",
  "search",
  "similar",
  "seasons",
  "series-watch-state",
] as const;

/** Clé de la rangée « Reprendre la lecture » (cf. `useResumeItems`). */
const RESUME_KEY = ["resume-items"] as const;

interface InvalidateOptions {
  itemId?: string;
  seriesContext?: { seriesId: string; seasonId?: string };
  /** Force le refetch immédiat des listes liées à la série (utile pour batch saison). */
  refetchSeriesContext?: boolean;
}

/**
 * Invalide toutes les query keys qui affichent des MediaItem avec UserData.
 *
 * Stratégie en 2 niveaux pour éviter le délai ressenti après "mark watched" :
 * - "active": refetch immédiat — uniquement les caches qui pilotent l'UI visible
 *   du détail courant (["item", id]).
 * - "none":   marqué stale, refetch au prochain mount/focus — les 13 listes
 *   globales. L'optimistic update (updateItemUserDataInCache) a déjà patché
 *   les listes en cache, donc l'utilisateur voit la bonne valeur sans payer
 *   la cascade de refetchs.
 */
export function invalidateAllMediaQueries(
  qc: QueryClient,
  opts?: InvalidateOptions,
): void {
  // Refetch immédiat sur l'item courant (et la série parente si contexte épisode)
  if (opts?.itemId) {
    qc.invalidateQueries({ queryKey: ["item", opts.itemId], refetchType: "active" });
  }
  if (opts?.seriesContext) {
    qc.invalidateQueries({
      queryKey: ["item", opts.seriesContext.seriesId],
      refetchType: "active",
    });
  }

  // Listes globales : marquer stale uniquement (pas de cascade réseau)
  // sauf si l'appelant veut explicitement rafraîchir le contexte série
  // (ex. batch saison où on veut une source de vérité immédiate).
  const listRefetch: "none" | "active" = opts?.refetchSeriesContext ? "active" : "none";
  for (const prefix of LIST_QUERY_PREFIXES) {
    qc.invalidateQueries({ queryKey: [prefix], refetchType: listRefetch });
  }
}

type UserDataUpdater = (prev: UserItemData) => Partial<UserItemData>;

/**
 * Cible d'une mise à jour optimiste : soit un itemId unique (rétro-compat),
 * soit un sélecteur. `matchSeriesId` patche LA série (Id === matchSeriesId) ET
 * TOUS ses épisodes en cache (SeriesId === matchSeriesId) → propagation
 * « ajouter la série » vers tous les épisodes sans refresh.
 */
export type CacheTarget = string | { matchId?: string; matchSeriesId?: string };

function buildMatcher(target: CacheTarget): (item: MediaItem) => boolean {
  const { matchId, matchSeriesId } =
    typeof target === "string" ? { matchId: target, matchSeriesId: undefined } : target;
  return (item: MediaItem) =>
    (!!matchId && item.Id === matchId) ||
    (!!matchSeriesId && (item.Id === matchSeriesId || item.SeriesId === matchSeriesId));
}

/** Applique l'updater à un item (immuable) si il a un UserData. */
function patchItem(item: MediaItem, updater: UserDataUpdater): MediaItem {
  if (!item.UserData) return item;
  return { ...item, UserData: { ...item.UserData, ...updater(item.UserData) } };
}

/**
 * Propage une mise à jour optimiste de UserData dans toutes les queries en cache
 * (item détail + listes), pour TOUS les items correspondant à la cible.
 * Retourne un snapshot pour rollback.
 */
export function updateItemUserDataInCache(
  qc: QueryClient,
  target: CacheTarget,
  updater: UserDataUpdater,
): Map<string, unknown> {
  const snapshot = new Map<string, unknown>();
  const matches = buildMatcher(target);

  for (const query of qc.getQueryCache().findAll()) {
    const key = query.queryKey;
    const prefix = key[0];
    if (typeof prefix !== "string") continue;

    const data = query.state.data;
    if (!data) continue;
    const keyStr = JSON.stringify(key);

    // Détail d'un item : ["item", id] → MediaItem unique
    if (prefix === "item") {
      const item = data as MediaItem;
      if (item.Id && matches(item) && item.UserData) {
        snapshot.set(keyStr, data);
        qc.setQueryData<MediaItem>(key, patchItem(item, updater));
      }
      continue;
    }

    // Listes connues uniquement
    if (!LIST_QUERY_PREFIXES.includes(prefix as typeof LIST_QUERY_PREFIXES[number])) {
      continue;
    }

    // Listes flat (MediaItem[])
    if (Array.isArray(data)) {
      const list = data as MediaItem[];
      let changed = false;
      const updated = list.map((item) => {
        if (!matches(item) || !item.UserData) return item;
        changed = true;
        return patchItem(item, updater);
      });
      if (changed) {
        snapshot.set(keyStr, data);
        qc.setQueryData(key, updated);
      }
      continue;
    }

    // Queries infinies ({ pages: [{ Items: MediaItem[] }], pageParams })
    if (
      typeof data === "object" &&
      data !== null &&
      "pages" in data &&
      Array.isArray((data as InfiniteData<unknown>).pages)
    ) {
      const infiniteData = data as InfiniteData<{ Items?: MediaItem[] }>;
      let changed = false;

      const updatedPages = infiniteData.pages.map((page) => {
        if (!page.Items) return page;
        let pageChanged = false;
        const updatedItems = page.Items.map((item) => {
          if (!matches(item) || !item.UserData) return item;
          pageChanged = true;
          changed = true;
          return patchItem(item, updater);
        });
        return pageChanged ? { ...page, Items: updatedItems } : page;
      });

      if (changed) {
        snapshot.set(keyStr, data);
        qc.setQueryData(key, { ...infiniteData, pages: updatedPages });
      }
    }
  }

  return snapshot;
}

/**
 * Met à jour optimiste un Set d'IDs de séries en cache (string[] : liste des
 * SeriesId likées / favorites). No-op si la query n'est pas encore chargée
 * (le refetch onSettled resynchronisera). Enregistre l'état précédent dans le
 * snapshot fourni pour rollback.
 */
export function patchSeriesIdSet(
  qc: QueryClient,
  queryKey: readonly unknown[],
  seriesId: string | undefined,
  add: boolean,
  snapshot?: Map<string, unknown>,
): void {
  if (!seriesId) return;
  const data = qc.getQueryData<string[]>(queryKey);
  if (data === undefined) return;

  const has = data.includes(seriesId);
  if (add === has) return; // déjà dans l'état voulu

  const keyStr = JSON.stringify(queryKey);
  if (snapshot && !snapshot.has(keyStr)) snapshot.set(keyStr, data);

  qc.setQueryData<string[]>(
    queryKey,
    add ? [...data, seriesId] : data.filter((id) => id !== seriesId),
  );
}

/**
 * Insère un item en tête des listes flat fournies (Ma liste / Favoris) s'il est
 * absent. Mise à jour optimiste → le carrousel se met à jour instantanément.
 */
export function addItemToLists(
  qc: QueryClient,
  listKeys: readonly (readonly unknown[])[],
  item: MediaItem,
  snapshot?: Map<string, unknown>,
): void {
  for (const key of listKeys) {
    const data = qc.getQueryData<MediaItem[]>(key);
    if (!Array.isArray(data) || data.some((i) => i.Id === item.Id)) continue;
    const keyStr = JSON.stringify(key);
    if (snapshot && !snapshot.has(keyStr)) snapshot.set(keyStr, data);
    qc.setQueryData<MediaItem[]>(key, [item, ...data]);
  }
}

/** Retire un item (par id) des listes flat fournies. Mise à jour optimiste. */
export function removeItemFromLists(
  qc: QueryClient,
  listKeys: readonly (readonly unknown[])[],
  id: string | undefined,
  snapshot?: Map<string, unknown>,
): void {
  if (!id) return;
  for (const key of listKeys) {
    const data = qc.getQueryData<MediaItem[]>(key);
    if (!Array.isArray(data) || !data.some((i) => i.Id === id)) continue;
    const keyStr = JSON.stringify(key);
    if (snapshot && !snapshot.has(keyStr)) snapshot.set(keyStr, data);
    qc.setQueryData<MediaItem[]>(key, data.filter((i) => i.Id !== id));
  }
}

/**
 * Remonte en TÊTE de « Reprendre la lecture » l'item qu'on vient de quitter.
 *
 * Jellyfin trie cette liste par `DatePlayed` décroissant — le dernier média lu
 * en premier, ce qu'on veut. Mais sa vérité arrive EN RETARD : le refetch qui
 * suit l'arrêt part dès que `/Sessions/Playing/Stopped` a répondu, et cette
 * réponse peut encore porter l'ancien ordre. Le résultat est alors écrit dans le
 * cache et marqué frais pour 30 s (180 s en mode économie) : revenir sur
 * l'accueil dans cette fenêtre n'y change rien, et le film qu'on vient de
 * regarder reste en deuxième position. Un rechargement non plus, le cache étant
 * persisté (`queryPersister`) — d'où le « il faut vider le cache » observé.
 *
 * Or cet ordre-là, on le connaît sans demander à personne : l'utilisateur vient
 * de lire cet item, donc c'est le plus récent. On l'écrit, et le serveur
 * confirmera. Appelé AVANT le refetch — le carrousel est réordonné à l'instant,
 * sans réseau — et APRÈS, pour qu'une réponse en retard ne le défasse pas.
 *
 * Ne fabrique PAS d'entrée absente : un média jamais entré dans la liste (lu de
 * bout en bout la première fois) n'y a rien à faire, et un item qui vient d'être
 * terminé en SORT. C'est au serveur de trancher ces deux cas.
 */
export function hoistResumeItem(qc: QueryClient, itemId: string | undefined): void {
  if (!itemId) return;
  const data = qc.getQueryData<MediaItem[]>(RESUME_KEY);
  if (!Array.isArray(data)) return;
  const idx = data.findIndex((i) => i.Id === itemId);
  if (idx <= 0) return; // absent, ou déjà premier
  const next = [...data];
  const [item] = next.splice(idx, 1);
  qc.setQueryData<MediaItem[]>(RESUME_KEY, [item, ...next]);
}

/**
 * Restaure tous les caches depuis le snapshot (rollback onError).
 */
export function restoreFromSnapshot(
  qc: QueryClient,
  snapshot: Map<string, unknown>,
): void {
  const allQueries = qc.getQueryCache().findAll();

  for (const query of allQueries) {
    const keyStr = JSON.stringify(query.queryKey);
    if (snapshot.has(keyStr)) {
      qc.setQueryData(query.queryKey, snapshot.get(keyStr));
    }
  }
}
