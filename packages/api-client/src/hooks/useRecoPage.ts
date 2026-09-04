import { useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { getSocketStatus } from "../socket/tentacleSocket";
import type { RecoRowItem, RecoState } from "./recoTypes";
import { tentacleApiFetch } from "./usePreferences";

export interface RecoPageRow {
  key: string;
  seedTitle?: string;
  items: RecoRowItem[];
}

/** Le contrat de GET /api/reco/page — la page entière, en une réponse. */
export interface RecoPage {
  state: RecoState;
  signalCount: number;
  generating: boolean;
  refining: boolean;
  exploring: boolean;
  generatedAt: string | null;
  poolGeneratedAt: string | null;
  tmdbConfigured: boolean;
  personalized: boolean;
  /** Le filtre appliqué par le serveur (ids canonisés), null = tout. */
  filter: { providers: number[] } | null;
  /** Rangées AVEC leurs items, filtrées strictement, vides omises. */
  rows: RecoPageRow[];
}

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

export function getRecoPageKey(ids: readonly number[] | null | undefined): readonly [typeof RECO_PAGE_KEY, string] {
  return [RECO_PAGE_KEY, recoFilterKey(ids)] as const;
}

/** Le fetcher partagé entre le hook et le préchargement. */
export function buildRecoPageFetcher(ids: readonly number[]): () => Promise<RecoPage> {
  const normalized = normalizeProviderFilter(ids);
  const query = normalized.length > 0 ? `?providers=${normalized.join(",")}` : "";
  return () => tentacleApiFetch<RecoPage>(`/api/reco/page${query}`);
}

/** Constante de module (référence stable → TanStack mémoïse) : drapeaux en
 *  booléens stricts (un serveur qui les omet), rangées vides écartées. */
export const selectRecoPage = (page: RecoPage): RecoPage => ({
  ...page,
  generating: !!page.generating,
  refining: !!page.refining,
  exploring: !!page.exploring,
  filter: page.filter ?? null,
  rows: (page.rows ?? []).filter((row) => Array.isArray(row.items) && row.items.length > 0),
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
  return useQuery({
    queryKey: [RECO_PAGE_KEY, recoFilterKey(ids)],
    queryFn: buildRecoPageFetcher(ids),
    staleTime: RECO_PAGE_STALE_TIME,
    enabled: options.enabled ?? true,
    select: selectRecoPage,
    // Le socket (reco:update) fait foi ; on ne sonde qu'à défaut.
    refetchInterval: (...args: unknown[]) => recoPagePollInterval(getSocketStatus() === "open", ...args),
    ...({ keepPreviousData: true, placeholderData: (prev: RecoPage | undefined) => prev } as object),
  });
}

export function prefetchRecoPage(qc: QueryClient, filter: readonly number[] | null | undefined): Promise<void> {
  const ids = normalizeProviderFilter(filter);
  return qc.prefetchQuery({
    queryKey: [RECO_PAGE_KEY, recoFilterKey(ids)],
    queryFn: buildRecoPageFetcher(ids),
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
  return changed ? { ...page, rows } : page;
}

/** Retrait OPTIMISTE (note posée, « ne plus me proposer ») de toutes les pages en cache. */
export async function dropRecoItemEverywhere(qc: QueryClient, itemKey: string): Promise<void> {
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
