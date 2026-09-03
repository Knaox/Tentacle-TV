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
 * LA page de recommandations en une requête. Changement de filtre : les
 * anciennes rangées restent affichées jusqu'à l'arrivée des neuves (jamais de
 * blanc). Pas d'import de `keepPreviousData` — la TV embarque TanStack v4 au
 * runtime (cf. useLibraryCatalog) ; la fonction identique est écrite ici.
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
    placeholderData: (prev: RecoPage | undefined) => prev,
    select: selectRecoPage,
    // Le socket (reco:update) fait foi ; on ne sonde qu'à défaut.
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d || !(d.generating || d.refining)) return false;
      return getSocketStatus() === "open" ? false : RECO_PAGE_FALLBACK_POLL_MS;
    },
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
