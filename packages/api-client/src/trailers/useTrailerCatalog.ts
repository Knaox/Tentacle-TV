import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  readTrailerCatalog, trailerCatalogPath, type MediaItem, type TrailerCatalogResponse,
} from "@tentacle-tv/shared";
import { useServerCapability } from "../hooks/useServerCapabilities";
import { tentacleApiFetch } from "../hooks/usePreferences";

/** Ce qu'il faut d'un titre de la bibliothèque pour demander son catalogue. */
export type TrailerCatalogOwner = Pick<MediaItem, "Id" | "Type">;

/** Le catalogue change peu : une liste gardée une demi-heure. */
const TRAILER_CATALOG_STALE_MS = 30 * 60_000;
/** Une source n'avait pas fini (`complete: false`) : relue cinq secondes plus tard, deux fois au plus. */
export const TRAILER_CATALOG_RETRY_MS = 5_000;
export const TRAILER_CATALOG_MAX_REREADS = 2;

/** Film, série, saison ou épisode : ce que le catalogue sait décrire. */
const CATALOG_TYPES: ReadonlySet<string> = new Set(["Movie", "Series", "Season", "Episode"]);

export function trailerCatalogQueryKey(itemId: string | undefined, lang: string | undefined) {
  return ["trailer-catalog", itemId ?? null, lang ?? null] as const;
}

/** Le catalogue d'un titre ; `null` : réponse illisible (le comportement d'avant). */
export async function fetchTrailerCatalog(itemId: string, lang: string | undefined): Promise<TrailerCatalogResponse | null> {
  const path = trailerCatalogPath(lang ? { itemId, lang } : { itemId });
  if (!path) return null;
  return readTrailerCatalog(await tentacleApiFetch<unknown>(path));
}

export interface TrailerCatalogState {
  /** Le serveur déclare `trailers.catalog` : sans elle, rien n'est demandé. */
  capable: boolean;
  /** La réponse ; `undefined` tant qu'elle n'est pas venue, `null` si illisible. */
  catalog: TrailerCatalogResponse | null | undefined;
  /**
   * La liste est définitive : complète, relue assez, ou en échec — l'absence
   * de bande-annonce est alors un fait, pas une attente.
   */
  settled: boolean;
}

/**
 * Le CATALOGUE des bandes-annonces d'un titre de la bibliothèque
 * (`GET /api/trailers/catalog`, capacité `trailers.catalog`) : la liste que
 * le SERVEUR ordonne — la saison de l'épisode d'abord, la langue du serveur
 * d'abord. Clé `["trailer-catalog", id, langue]`, gardée trente minutes ;
 * une réponse incomplète (une source lente, calculée en fond par le serveur)
 * est relue cinq secondes plus tard, deux fois au plus.
 *
 * `enabled: false` : la plateforme ne s'en sert pas (encore) — aucune requête.
 */
export function useTrailerCatalog(
  owner: TrailerCatalogOwner | undefined,
  lang: string | undefined,
  options: { enabled?: boolean } = {},
): TrailerCatalogState {
  const capable = useServerCapability("trailers.catalog");
  const itemId = owner && CATALOG_TYPES.has(owner.Type ?? "") ? owner.Id : undefined;
  const enabled = capable && !!itemId && (options.enabled ?? true);
  const query = useQuery({
    queryKey: trailerCatalogQueryKey(itemId, lang),
    queryFn: () => fetchTrailerCatalog(itemId as string, lang),
    enabled,
    staleTime: TRAILER_CATALOG_STALE_MS,
    // Un refus passager (429) se retente une fois ; au-delà, la fiche fait sans.
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Les relectures d'une réponse incomplète, comptées pour CE titre.
  const key = `${itemId ?? ""}|${lang ?? ""}`;
  const [rereads, setRereads] = useState({ key, count: 0 });
  const count = rereads.key === key ? rereads.count : 0;
  const incomplete = !!query.data && !query.data.complete;
  const { refetch, isFetching } = query;
  useEffect(() => {
    if (!enabled || !incomplete || isFetching || count >= TRAILER_CATALOG_MAX_REREADS) return;
    const timer = setTimeout(() => {
      setRereads({ key, count: count + 1 });
      void refetch();
    }, TRAILER_CATALOG_RETRY_MS);
    return () => clearTimeout(timer);
  }, [enabled, incomplete, isFetching, count, key, refetch]);

  const answered = query.isError || (query.isSuccess && (!incomplete || count >= TRAILER_CATALOG_MAX_REREADS));
  return { capable, catalog: query.data, settled: !enabled || answered };
}
