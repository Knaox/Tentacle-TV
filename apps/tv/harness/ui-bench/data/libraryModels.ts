import { PLATFORMS, type MediaItem } from "@tentacle-tv/shared";
import type { TFunction } from "i18next";
import { DEFAULT_FILTERS, type LibraryFilterState } from "../../../src/hooks/libraryCatalogParams";
import type { ActiveFilterModel, FilterPillModel } from "../../../src/redesign/screens/library/libraryTypes";
import type { BenchData } from "./benchData";

/**
 * La bibliothèque au banc : l'état des filtres de l'app (`LibraryFilterState`,
 * les défauts de `useLibraryFilters`), appliqué au VRAI début de catalogue de
 * l'instantané, puis mis en mots pour la vue — pastilles, filtres actifs.
 * Le serveur filtre dans l'app ; ici on filtre les 48 premiers titres A→Z,
 * avec les mêmes règles (genres en OU, plateformes par studio comme
 * `usePlatformFilter`).
 */

export type { LibraryFilterState };
export { DEFAULT_FILTERS };

/** Miroir de `SORT_OPTIONS` (`TVLibrarySortGenreMenus`) : critère, libellé,
 *  ordre naturel — et les libellés de la valeur selon l'ordre retenu. */
export const SORTS = [
  { value: "DateCreated", key: "sortDateDesc", order: "Descending", desc: "sortDateDesc", asc: "sortDateAsc" },
  { value: "SortName", key: "sortTitleAsc", order: "Ascending", desc: "sortTitleDesc", asc: "sortTitleAsc" },
  { value: "ProductionYear", key: "sortYear", order: "Descending", desc: "sortYearDesc", asc: "sortYearAsc" },
  { value: "CommunityRating", key: "sortRatingDesc", order: "Descending", desc: "sortRatingDesc", asc: "sortRatingAsc" },
] as const;

export type LibraryKind = "movies" | "series" | "anime";

/** Une bibliothèque de l'instantané par nature (Films, Séries, Animés). */
export function libraryOf(data: BenchData, kind: LibraryKind) {
  const libs = data.snapshot.libraries;
  if (kind === "movies") return libs.find((lib) => lib.collectionType === "movies");
  const shows = libs.filter((lib) => lib.collectionType === "tvshows");
  const anime = shows.find((lib) => /anim/i.test(lib.name));
  return kind === "anime" ? anime : shows.find((lib) => lib !== anime);
}

export function genresOf(data: BenchData, libraryId: string | undefined) {
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

/** « 7 » ou « 7.5 » — le point décimal des cartes. */
export const ratingLabel = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

export function sortLabel(t: TFunction, f: LibraryFilterState): string {
  const sort = SORTS.find((s) => s.value === f.sortBy) ?? SORTS[1];
  return t(`common:${f.sortOrder === "Descending" ? sort.desc : sort.asc}`);
}

export function yearsLabel(f: LibraryFilterState): string | null {
  if (f.yearFrom == null && f.yearTo == null) return null;
  return `${f.yearFrom ?? "…"} – ${f.yearTo ?? "…"}`;
}

function statusLabel(t: TFunction, status: string | null): string {
  if (status === "IsUnplayed") return t("common:unwatched");
  if (status === "IsResumable") return t("common:inProgress");
  return t("common:allFilter");
}

/** « Action », « Action +2 » — la valeur d'une pastille à choix multiples. */
function manyLabel(names: string[], none: string): string {
  if (names.length === 0) return none;
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
}

/** Les sept pastilles, dans l'ordre de l'écran, chacune avec sa valeur. */
export function pillsOf(t: TFunction, f: LibraryFilterState, genres: Array<{ id: string; name: string }>): FilterPillModel[] {
  const genreNames = f.genreIds.map((id) => genres.find((g) => g.id === id)?.name).filter((n): n is string => !!n);
  const platformNames = f.platformIds.map((id) => PLATFORMS.find((p) => p.id === id)?.name).filter((n): n is string => !!n);
  const years = yearsLabel(f);
  return [
    { key: "status", label: t("library:watchStatus"), value: statusLabel(t, f.statusFilter), active: f.statusFilter !== null },
    { key: "favorites", label: t("common:favorites"), toggle: true, active: f.isFavorite, icon: "heart", activeIcon: "heartFilled" },
    { key: "genres", label: t("common:genres"), value: manyLabel(genreNames, t("common:allGenres")), active: genreNames.length > 0 },
    {
      key: "sort",
      label: t("common:sortBy"),
      value: sortLabel(t, f),
      active: f.sortBy !== DEFAULT_FILTERS.sortBy || f.sortOrder !== DEFAULT_FILTERS.sortOrder,
    },
    { key: "years", label: t("common:sortYear"), value: years ?? t("common:allYears"), active: years !== null },
    {
      key: "rating",
      label: t("common:ratingMin"),
      value: f.ratingMin != null ? `★ ${ratingLabel(f.ratingMin)}+` : t("common:ratingAny"),
      active: f.ratingMin != null,
    },
    { key: "platforms", label: t("common:platforms"), value: manyLabel(platformNames, t("common:allFilter")), active: platformNames.length > 0 },
  ];
}

/** Les filtres actifs, un par geste de retrait. Le tri n'en est pas un. */
export function activeFiltersOf(t: TFunction, f: LibraryFilterState, genres: Array<{ id: string; name: string }>): ActiveFilterModel[] {
  const active: ActiveFilterModel[] = [];
  if (f.statusFilter) active.push({ id: "status", label: statusLabel(t, f.statusFilter) });
  if (f.isFavorite) active.push({ id: "favorites", label: t("common:favorites") });
  for (const id of f.genreIds) {
    const name = genres.find((g) => g.id === id)?.name;
    if (name) active.push({ id: `genre:${id}`, label: name });
  }
  const years = yearsLabel(f);
  if (years) active.push({ id: "years", label: years });
  if (f.ratingMin != null) active.push({ id: "rating", label: `★ ${ratingLabel(f.ratingMin)}+` });
  for (const id of f.platformIds) {
    const name = PLATFORMS.find((p) => p.id === id)?.name;
    if (name) active.push({ id: `platform:${id}`, label: name });
  }
  return active;
}

/** Retirer un filtre actif (sa croix) — ce que feront les setters de `useLibraryFilters`. */
export function removeFilter(f: LibraryFilterState, id: string): LibraryFilterState {
  if (id === "status") return { ...f, statusFilter: null };
  if (id === "favorites") return { ...f, isFavorite: false };
  if (id === "years") return { ...f, yearFrom: null, yearTo: null };
  if (id === "rating") return { ...f, ratingMin: null };
  if (id.startsWith("genre:")) return { ...f, genreIds: f.genreIds.filter((g) => g !== id.slice(6)) };
  if (id.startsWith("platform:")) return { ...f, platformIds: f.platformIds.filter((p) => String(p) !== id.slice(9)) };
  return f;
}

/** Les années extrêmes du catalogue (bornes des décennies proposées). */
export function yearSpan(data: BenchData, libraryId: string | undefined): [number, number] {
  const years = data.items(libraryId ? data.snapshot.catalog?.[libraryId] : undefined)
    .map((item) => item.ProductionYear)
    .filter((y): y is number => !!y);
  return years.length ? [Math.min(...years), Math.max(...years)] : [1990, new Date().getFullYear()];
}
