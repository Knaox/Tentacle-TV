import { useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ExternalMusicSearchPage } from "@tentacle-tv/shared/music";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { musicRouteUrl, type MusicProvider } from "./musicProvider";
import { mergeExternalMusicPages, readMusicSearchPage, type MergedMusicResults } from "./musicSearchMerge";

/**
 * Point 1 — la recherche musique hors bibliothèque, PROGRESSIVE : la première
 * page arrive vite (« ce que l'extension a sous la main »), les suivantes
 * (`cursor`) sont demandées d'elles-mêmes tant qu'elle dit `complete: false`,
 * au plus `MAX_PAGES`. Lancée à côté de la recherche de la bibliothèque, jamais
 * devant ; un résultat que la bibliothèque a déjà (même MBID d'enregistrement)
 * est retiré. Sans fournisseur, rien : ni requête, ni section.
 *
 * Contrat v2 (`revise=1`) : l'extension peut rendre d'abord un classement
 * PROVISOIRE (sources rapides), puis la liste entière révisée à chaque page
 * (`replace`). Une extension d'avant ignore le paramètre : ajout seul.
 */

const MIN_QUERY = 2;
/**
 * v2 : un curseur rend la page courante toutes les 8 s tant que l'extension travaille (45 s au plus),
 * plus ses révisions — 16 pages couvrent une recherche entière.
 */
const MAX_PAGES = 16;

export interface MusicSearchOptions {
  limit?: number;
  /** Les MBID d'enregistrement de la bibliothèque pour cette recherche (la bibliothèque gagne). */
  libraryRecordings?: ReadonlySet<string>;
  libraryReleases?: ReadonlySet<string>;
  enabled?: boolean;
}

export interface MusicSearchState extends MergedMusicResults {
  /** La première page n'est pas encore là. */
  pending: boolean;
  /** Un fournisseur existe : sinon, aucune section à prévoir. */
  available: boolean;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

export function useMusicSearch(provider: MusicProvider | null, query: string, options: MusicSearchOptions = {}): MusicSearchState {
  const q = query.trim();
  const limit = options.limit ?? 20;
  const enabled = !!provider && (options.enabled ?? true) && q.length >= MIN_QUERY;

  const result = useInfiniteQuery({
    queryKey: ["music", "external-search", provider?.pluginId ?? null, provider?.music.search ?? null, q, limit],
    queryFn: async ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }): Promise<ExternalMusicSearchPage> => {
      if (!provider) throw new Error("no music provider");
      const raw = await tentacleApiFetch<unknown>(musicRouteUrl(provider, provider.music.search, { q, limit, cursor: pageParam, revise: 1 }), { signal });
      return readMusicSearchPage(raw, q) ?? { query: q, complete: true, cursor: null, tracks: [], albums: [], artists: [] };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last: ExternalMusicSearchPage, all: ExternalMusicSearchPage[]) =>
      !last.complete && last.cursor && all.length < MAX_PAGES ? last.cursor : undefined,
    enabled,
    staleTime: 60_000,
    retry: false,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = result;
  // La suite vient d'elle-même : l'écran n'a rien à demander. Plusieurs observateurs de la même recherche
  // la demandent ensemble : `cancelRefetch: false`, sinon chacun ANNULE le curseur en attente de l'autre.
  useEffect(() => {
    if (enabled && hasNextPage && !isFetchingNextPage) void fetchNextPage({ cancelRefetch: false });
  }, [enabled, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const recordings = options.libraryRecordings ?? EMPTY_SET;
  const releases = options.libraryReleases ?? EMPTY_SET;
  const pages = result.data?.pages;
  return useMemo(() => {
    const merged = enabled && pages ? mergeExternalMusicPages(pages, recordings, releases) : { tracks: [], albums: [], artists: [], complete: !enabled, provisional: false };
    return { ...merged, pending: enabled && result.isPending, available: !!provider };
  }, [enabled, pages, recordings, releases, result.isPending, provider]);
}
