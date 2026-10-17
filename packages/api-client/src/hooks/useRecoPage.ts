import { useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { emitRecoDropped, hasRetiredReco, isRecoRetired } from "../reco/recoRetirementState";
import { getSocketStatus } from "../socket/tentacleSocket";
import { RECO_PAGE_THEMES_PARAM, RECO_PAGE_TRENDING_PARAM, type RecoPage, type RecoPageRow } from "@tentacle-tv/shared";
import { tentacleApiFetch } from "./usePreferences";
import { trendingHeadFromCache, useTrendingHeadRequest } from "../reco/trendingHeadRequest";

/** Le contrat de GET /api/reco/page — la page entière, en une réponse
 *  (shared, reco/recoPageTypes : `featured`, `why` des rangées, en optionnel). */
export type { RecoPage, RecoPageRow };

/** Préfixe DÉDIÉ : c'est lui que le persister met sur disque — les autres
 *  clés reco (personnes, démarrage à froid) restent en mémoire. */
export const RECO_PAGE_KEY = "reco-page" as const;
export const ALL_PROVIDERS_KEY = "all";
export const RECO_PAGE_STALE_TIME = 5 * 60_000;
/** Sondage de REPLI seulement, quand le socket n'est pas ouvert. */
export const RECO_PAGE_FALLBACK_POLL_MS = 10_000;

/** Entiers strictement positifs, dédoublonnés, triés croissant. */
export function normalizeProviderFilter(ids: readonly number[] | null | undefined): number[] {
  if (!ids || ids.length === 0) return [];
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
}

/** « all » ou « 283,415 » — la clé locale de la page (jamais comparée à celle du serveur). */
export function recoFilterKey(ids: readonly number[] | null | undefined): string {
  const normalized = normalizeProviderFilter(ids);
  return normalized.length > 0 ? normalized.join(",") : ALL_PROVIDERS_KEY;
}

/** La clé de la page : celle d'avant sans la tête des tendances, un 3ᵉ élément avec —
 *  la page avec tête et la page sans ne se servent jamais l'une pour l'autre
 *  (mémoire, disque), cf. reco/trendingHeadRequest. */
export function getRecoPageKey(ids: readonly number[] | null | undefined, trendingNow = false): readonly string[] {
  const key = [RECO_PAGE_KEY, recoFilterKey(ids)];
  return trendingNow ? [...key, RECO_PAGE_TRENDING_PARAM] : key;
}

/**
 * Ce client sait-il titrer une rangée à THÈME (`recoRowTitleText`, par son
 * `why`) ? Il le dit au serveur (`?themes=1`, RECO_PAGE_THEMES_PARAM) ; sans
 * lui, le serveur ne sert que les clés que `recoRowTitle` sait nommer — une
 * rangée à thème s'y appellerait « Pour vous ». Posé UNE fois, au démarrage
 * de l'application qui le sait (le web et le bureau, miroir compris), avant
 * toute requête : la clé de cache de la page ne change pas — dans une
 * application, toutes les pages en cache sont demandées de la même façon.
 */
let themedRows = false;
export function acceptRecoPageThemes(): void {
  themedRows = true;
}

/** La requête d'une page : le filtre de plateformes, les rangées à thème si le client les
 *  sait titrer, la tête des tendances si elle est demandée (reco/trendingHeadRequest). */
export function recoPageQuery(ids: readonly number[], trendingNow = false): string {
  const params: string[] = [];
  const normalized = normalizeProviderFilter(ids);
  if (normalized.length > 0) params.push(`providers=${normalized.join(",")}`);
  if (themedRows) params.push(`${RECO_PAGE_THEMES_PARAM}=1`);
  if (trendingNow) params.push(`${RECO_PAGE_TRENDING_PARAM}=1`);
  return params.length > 0 ? `?${params.join("&")}` : "";
}

/** Le fetcher partagé entre le hook et le préchargement. */
export function buildRecoPageFetcher(ids: readonly number[], trendingNow = false): () => Promise<RecoPage> {
  const query = recoPageQuery(ids, trendingNow);
  return () => tentacleApiFetch<RecoPage>(`/api/reco/page${query}`);
}

/** Les titres jugés puis lâchés (cf. reco/recoRetirement) : une page servie
 *  entre-temps, calculée avant le geste, ne les remontre pas. */
function withoutRetired(rows: RecoPageRow[]): RecoPageRow[] {
  if (!hasRetiredReco()) return rows;
  return rows.map((row) =>
    Array.isArray(row.items) && row.items.some((item) => isRecoRetired(item.key))
      ? { ...row, items: row.items.filter((item) => !isRecoRetired(item.key)) }
      : row
  );
}

/** Constante de module (référence stable → TanStack mémoïse) : drapeaux en
 *  booléens stricts (un serveur qui les omet), titres retirés et rangées
 *  vides écartés. */
export const selectRecoPage = (page: RecoPage): RecoPage => ({
  ...page,
  generating: !!page.generating,
  refining: !!page.refining,
  exploring: !!page.exploring,
  filter: page.filter ?? null,
  rows: withoutRetired(page.rows ?? []).filter((row) => Array.isArray(row.items) && row.items.length > 0),
  featured: page.featured?.item && !isRecoRetired(page.featured.item.key) ? page.featured : undefined,
});

/**
 * L'intervalle de sondage de repli. v5 appelle `refetchInterval(query)`, v4
 * (la TV, au runtime) appelle `refetchInterval(data, query)` : on reconnaît la
 * query à son `state` OBJET — `RecoPage.state` est une chaîne (« ready »…),
 * c'est le discriminant. Exportée pour être testée sous les deux formes.
 */
export function recoPagePollInterval(socketOpen: boolean, ...args: unknown[]): number | false {
  const first = args[0] as { state?: unknown } | undefined;
  const page =
    first && typeof first.state === "object" && first.state !== null
      ? (first.state as { data?: RecoPage }).data
      : (first as RecoPage | undefined);
  if (!page || !(page.generating || page.refining)) return false;
  return socketOpen ? false : RECO_PAGE_FALLBACK_POLL_MS;
}

/**
 * LA page de recommandations en une requête. Changement de filtre : les
 * anciennes rangées restent affichées jusqu'à l'arrivée des neuves (jamais de
 * blanc). Double-compat : api-client est typé v5 (web) mais la TV résout la
 * v4 au runtime — pas d'import de `keepPreviousData` (absent en v4) ; v4 lit
 * l'option `keepPreviousData`, v5 lit `placeholderData(prev)` (cf.
 * useLibraryCatalog).
 */
export function useRecoPage(
  filter: readonly number[] | null | undefined,
  options: { enabled?: boolean } = {}
) {
  const ids = normalizeProviderFilter(filter);
  // « Tendances actuelles » : décidée avant le premier envoi (capacité + préférence).
  const head = useTrendingHeadRequest();
  return useQuery({
    queryKey: getRecoPageKey(ids, head.trendingNow),
    queryFn: buildRecoPageFetcher(ids, head.trendingNow),
    staleTime: RECO_PAGE_STALE_TIME,
    enabled: (options.enabled ?? true) && head.ready,
    select: selectRecoPage,
    // Le socket (reco:update) fait foi ; on ne sonde qu'à défaut.
    refetchInterval: (...args: unknown[]) => recoPagePollInterval(getSocketStatus() === "open", ...args),
    ...({ keepPreviousData: true, placeholderData: (prev: RecoPage | undefined) => prev } as object),
  });
}

export function prefetchRecoPage(qc: QueryClient, filter: readonly number[] | null | undefined): Promise<void> {
  const ids = normalizeProviderFilter(filter);
  // Décision encore inconnue (configuration ou réglages pas lus) : rien à précharger,
  // la page partira d'elle-même sous la bonne clé.
  const head = trendingHeadFromCache(qc);
  if (!head.ready) return Promise.resolve();
  return qc.prefetchQuery({
    queryKey: getRecoPageKey(ids, head.trendingNow),
    queryFn: buildRecoPageFetcher(ids, head.trendingNow),
    staleTime: RECO_PAGE_STALE_TIME,
  });
}

/** Retrait d'un item de TOUTES les rangées ; une rangée vidée disparaît. */
export function removeRecoItem(page: RecoPage | undefined, itemKey: string): RecoPage | undefined {
  if (!page) return page;
  let changed = false;
  const rows: RecoPageRow[] = [];
  for (const row of page.rows) {
    const items = row.items.filter((item) => item.key !== itemKey);
    if (items.length !== row.items.length) changed = true;
    if (items.length > 0) rows.push(items.length === row.items.length ? row : { ...row, items });
  }
  const featuredGone = page.featured?.item.key === itemKey;
  if (!changed && !featuredGone) return page;
  const next = { ...page, rows };
  if (featuredGone) delete next.featured;
  return next;
}

/** Retrait OPTIMISTE (note posée, « ne plus me proposer ») de toutes les pages en cache.
 *  Dit AUSSI aux pages à l'écran (`emitRecoDropped`) : une page tenue le temps de
 *  la visite ne se relit plus dans le cache, mais ce titre-là doit la quitter. */
export async function dropRecoItemEverywhere(qc: QueryClient, itemKey: string): Promise<void> {
  emitRecoDropped(itemKey);
  await qc.cancelQueries({ queryKey: [RECO_PAGE_KEY] });
  qc.setQueriesData<RecoPage>({ queryKey: [RECO_PAGE_KEY] }, (old) => removeRecoItem(old, itemKey));
}

/** L'UNIQUE porte d'invalidation reco : les deux préfixes — ["reco"]
 *  (personnes, démarrage à froid, compat) ET ["reco-page"]. Un
 *  `invalidateQueries({ queryKey: ["reco"] })` seul rate la page. */
export function invalidateRecoQueries(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ["reco"] });
  void qc.invalidateQueries({ queryKey: [RECO_PAGE_KEY] });
}
