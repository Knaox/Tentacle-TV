/**
 * Ce que CE compte peut supprimer, titre par titre — `CanDelete`, que Jellyfin
 * calcule pour le compte du jeton (`BaseItem.CanDelete(user)` : son droit partout,
 * ou dans la bibliothèque du titre). Jamais déduit côté client.
 *
 * Deux relevés, champs minimaux (aucune image) :
 * - la bibliothèque ENTIÈRE, avec les filtres et le tri de la grille : c'est sur
 *   elle que « tout sélectionner » porte, pas sur la page chargée ;
 * - une liste d'identifiants (résultats de la recherche, fiche d'un titre).
 *
 * ⚠️ Le relevé d'une bibliothèque garde `EnableUserData=true`, comme la grille :
 * Jellyfin ne remplit `RecursiveItemCount` d'un dossier QUE dans le calcul des
 * données de visionnage (`Folder.FillUserDataDtoValues`). Sans elles, chaque
 * série paraissait vide, sortait du relevé, et une bibliothèque de séries disait
 * « Aucun de ces titres ne peut être supprimé » à un compte qui en avait le droit.
 */

import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "../hooks/useJellyfinClient";
import { useUserId } from "../hooks/useUserId";
import { catalogFilterParams, catalogItemTypes, getLibraryCatalogKey, type CatalogFilters } from "../hooks/useLibraryCatalog";

export interface DeletableEntry {
  id: string;
  name: string;
  /** `Movie`, `Series`, `Season`, `Episode`… — une série emporte ses saisons et épisodes. */
  type: string;
  canDelete: boolean;
}

export interface DeletableIndex {
  /** Les titres dans l'ordre de la grille. */
  order: string[];
  entries: ReadonlyMap<string, DeletableEntry>;
}

export const DELETABLE_INDEX_KEY = "library-deletable";

const INDEX_PAGE = 500;
/** Une bibliothèque de plus de 50 000 titres s'arrête là : rien n'est supposé au-delà. */
const INDEX_PAGES_MAX = 100;
const IDS_CHUNK = 100;

interface IndexFetchClient {
  fetch<T>(url: string): Promise<T>;
}

type RawItem = Pick<MediaItem, "Id" | "Name" | "Type" | "RecursiveItemCount"> & { CanDelete?: boolean };

function toEntry(item: RawItem): DeletableEntry {
  return { id: item.Id, name: item.Name ?? "", type: item.Type ?? "", canDelete: item.CanDelete === true };
}

/** Le relevé d'une bibliothèque filtrée, page après page. Exporté pour les tests. */
export async function fetchLibraryDeletableIndex(
  client: IndexFetchClient,
  userId: string,
  libraryId: string,
  filters: CatalogFilters,
): Promise<DeletableIndex> {
  const { sortBy = "DateCreated", sortOrder = "Descending" } = filters;
  const order: string[] = [];
  const entries = new Map<string, DeletableEntry>();
  for (let page = 0; page < INDEX_PAGES_MAX; page++) {
    const url =
      `/Users/${userId}/Items?ParentId=${libraryId}` +
      `&SortBy=${sortBy}&SortOrder=${sortOrder}` +
      `&IncludeItemTypes=${catalogItemTypes(filters)}&Recursive=true` +
      `&Fields=CanDelete,RecursiveItemCount` +
      `&ExcludeLocationTypes=Virtual&IsMissing=false&EnableImages=false` +
      `&Limit=${INDEX_PAGE}&StartIndex=${page * INDEX_PAGE}` +
      // `true` : sans lui, pas de `RecursiveItemCount`, donc plus aucune série (cf. en-tête).
      `&EnableTotalRecordCount=true&EnableUserData=true` +
      catalogFilterParams(filters);
    const res = await client.fetch<{ Items: RawItem[]; TotalRecordCount: number }>(url);
    for (const item of res.Items) {
      // Même règle que la grille : une série sans épisode n'y paraît pas.
      if (item.Type === "Series" && (item.RecursiveItemCount ?? 0) === 0) continue;
      if (entries.has(item.Id)) continue;
      order.push(item.Id);
      entries.set(item.Id, toEntry(item));
    }
    if (res.Items.length < INDEX_PAGE || (page + 1) * INDEX_PAGE >= res.TotalRecordCount) break;
  }
  return { order, entries };
}

/** Le relevé de titres nommés, par paquets. Exporté pour les tests. */
export async function fetchDeletableEntries(
  client: IndexFetchClient,
  userId: string,
  ids: readonly string[],
): Promise<DeletableIndex> {
  const entries = new Map<string, DeletableEntry>();
  for (let i = 0; i < ids.length; i += IDS_CHUNK) {
    const chunk = ids.slice(i, i + IDS_CHUNK);
    const res = await client.fetch<{ Items: RawItem[] }>(
      `/Users/${userId}/Items?Ids=${chunk.join(",")}&Fields=CanDelete&EnableImages=false&EnableUserData=false`,
    );
    for (const item of res.Items) entries.set(item.Id, toEntry(item));
  }
  return { order: ids.filter((id) => entries.has(id)), entries };
}

/** Toute la bibliothèque filtrée — seulement en mode sélection (`enabled`). */
export function useLibraryDeletableIndex(libraryId: string | undefined, filters: CatalogFilters, enabled: boolean) {
  const client = useJellyfinClient();
  const userId = useUserId();
  // Les filtres de la clé du catalogue, sans la taille de page ni les champs : un relevé par grille filtrée.
  const key = getLibraryCatalogKey(libraryId, { ...filters, limit: 0, fields: "grid" }).slice(2);
  return useQuery({
    queryKey: [DELETABLE_INDEX_KEY, "library", userId, ...key],
    queryFn: () => fetchLibraryDeletableIndex(client, userId ?? "", libraryId ?? "", filters),
    enabled: enabled && !!userId && !!libraryId,
    staleTime: 60_000,
  });
}

/** Ces titres-là (recherche, fiche) — seulement quand on en a besoin (`enabled`). */
export function useDeletableEntries(ids: readonly string[], enabled: boolean) {
  const client = useJellyfinClient();
  const userId = useUserId();
  return useQuery({
    queryKey: [DELETABLE_INDEX_KEY, "ids", userId, [...ids].sort().join(",")],
    queryFn: () => fetchDeletableEntries(client, userId ?? "", ids),
    enabled: enabled && !!userId && ids.length > 0,
    staleTime: 60_000,
  });
}
