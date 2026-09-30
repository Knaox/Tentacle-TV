import { PLATFORMS, type MediaItem } from "@tentacle-tv/shared";
import type { LibraryFilterState } from "../../../src/hooks/libraryCatalogParams";
import type { GenreOption } from "../../../src/redesignWiring/library/libraryFilterModel";
import { yearSpanOf } from "../../../src/redesignWiring/library/libraryFilterSheets";
import type { BenchData } from "./benchData";

/**
 * La bibliothèque au banc : le VRAI début de catalogue de l'instantané,
 * filtré et trié comme le demanderait l'app. Le serveur filtre dans l'app ;
 * ici on filtre les 48 premiers titres A→Z, avec les mêmes règles (genres en
 * OU, plateformes par studio comme `usePlatformFilter`). La mise en mots des
 * filtres (pastilles, listes) n'est pas ici : le banc prend celle de l'écran
 * (`src/redesignWiring/library/`).
 */

export type LibraryKind = "movies" | "series" | "anime";

/** Une bibliothèque de l'instantané par nature (Films, Séries, Animés). */
export function libraryOf(data: BenchData, kind: LibraryKind) {
  const libs = data.snapshot.libraries;
  if (kind === "movies") return libs.find((lib) => lib.collectionType === "movies");
  const shows = libs.filter((lib) => lib.collectionType === "tvshows");
  const anime = shows.find((lib) => /anim/i.test(lib.name));
  return kind === "anime" ? anime : shows.find((lib) => lib !== anime);
}

export function genresOf(data: BenchData, libraryId: string | undefined): GenreOption[] {
  return (libraryId ? data.snapshot.genres?.[libraryId] : undefined) ?? [];
}

const resumable = (item: MediaItem) => !item.UserData?.Played && (item.UserData?.PlayedPercentage ?? 0) > 0;

function platformStudios(ids: number[]): string[] {
  return ids.flatMap((id) => PLATFORMS.find((p) => p.id === id)?.studioNames ?? []).map((name) => name.toLowerCase());
}

function sortValue(item: MediaItem, sortBy: string): number | string {
  if (sortBy === "DateCreated") return Date.parse(item.DateCreated ?? "") || 0;
  if (sortBy === "ProductionYear") return item.ProductionYear ?? 0;
  if (sortBy === "CommunityRating") return item.CommunityRating ?? 0;
  // `SortName` arrive avec l'élément, mais le type partagé ne le déclare pas.
  const sortName = (item as MediaItem & { SortName?: string }).SortName;
  return (sortName ?? item.Name ?? "").toLowerCase();
}

/** Le catalogue réel d'une bibliothèque, filtré et trié comme le demanderait l'app. */
export function filterCatalog(data: BenchData, libraryId: string | undefined, f: LibraryFilterState): MediaItem[] {
  if (!libraryId) return [];
  const names = new Map(genresOf(data, libraryId).map((g) => [g.id, g.name]));
  const wanted = f.genreIds.map((id) => names.get(id)).filter((name): name is string => !!name);
  const studios = platformStudios(f.platformIds);
  const items = data.items(data.snapshot.catalog?.[libraryId]).filter((item) => {
    if (f.statusFilter === "IsUnplayed" && item.UserData?.Played) return false;
    if (f.statusFilter === "IsResumable" && !resumable(item)) return false;
    if (f.isFavorite && !item.UserData?.IsFavorite) return false;
    if (wanted.length && !(item.Genres ?? []).some((g) => wanted.includes(g))) return false;
    if (f.yearFrom != null && (item.ProductionYear ?? 0) < f.yearFrom) return false;
    if (f.yearTo != null && (item.ProductionYear ?? 9999) > f.yearTo) return false;
    if (f.ratingMin != null && (item.CommunityRating ?? 0) < f.ratingMin) return false;
    if (studios.length) {
      const own = (item.Studios ?? []).map((s) => s.Name?.toLowerCase() ?? "");
      if (!own.some((s) => studios.some((n) => s.includes(n)))) return false;
    }
    return true;
  });
  const dir = f.sortOrder === "Descending" ? -1 : 1;
  return items.sort((a, b) => {
    const x = sortValue(a, f.sortBy);
    const y = sortValue(b, f.sortBy);
    if (x === y) return 0;
    return (x < y ? -1 : 1) * dir;
  });
}

/** Les années extrêmes du catalogue (bornes des décennies proposées), lues
 *  comme l'écran les lit (`yearSpanOf`). */
export function yearSpan(data: BenchData, libraryId: string | undefined): [number, number] {
  return yearSpanOf(data.items(libraryId ? data.snapshot.catalog?.[libraryId] : undefined));
}
