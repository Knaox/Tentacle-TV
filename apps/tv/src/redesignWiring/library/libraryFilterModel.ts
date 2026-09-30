import { PLATFORMS } from "@tentacle-tv/shared";
import type { TFunction } from "i18next";
import { DEFAULT_FILTERS, type LibraryFilterState } from "../../hooks/libraryCatalogParams";
import type { ActiveFilterModel, FilterPillModel } from "../../redesign/screens/library/libraryTypes";

/**
 * La barre de filtres de la bibliothèque, MISE EN MOTS pour la vue : l'état
 * de `useLibraryFilters` devient des pastilles (le critère et sa valeur
 * courante) et des filtres actifs (un par geste de retrait) — plus l'effet
 * d'un retrait sur cet état. Pur, sans React ni données : le banc UI le monte
 * tel quel sur son instantané, l'écran sur le vrai catalogue.
 */

export interface GenreOption {
  id: string;
  name: string;
}

/** Les libellés de la VALEUR d'un tri selon l'ordre retenu : « Titre A→Z »,
 *  « Titre Z→A »… (clés de `common`). */
export const SORT_ORDER_LABELS: Readonly<Record<string, { desc: string; asc: string }>> = {
  DateCreated: { desc: "sortDateDesc", asc: "sortDateAsc" },
  SortName: { desc: "sortTitleDesc", asc: "sortTitleAsc" },
  ProductionYear: { desc: "sortYearDesc", asc: "sortYearAsc" },
  CommunityRating: { desc: "sortRatingDesc", asc: "sortRatingAsc" },
};

/** « 7 » ou « 7.5 » — le point décimal des cartes. */
export const ratingLabel = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

export function sortLabel(t: TFunction, f: LibraryFilterState): string {
  const labels = SORT_ORDER_LABELS[f.sortBy] ?? SORT_ORDER_LABELS[DEFAULT_FILTERS.sortBy];
  return t(`common:${f.sortOrder === "Descending" ? labels.desc : labels.asc}`);
}

/** « 2010 – 2019 », « 1990 – … » ; rien quand aucune borne n'est posée. */
export function yearsLabel(f: LibraryFilterState): string | null {
  if (f.yearFrom == null && f.yearTo == null) return null;
  return `${f.yearFrom ?? "…"} – ${f.yearTo ?? "…"}`;
}

export function statusLabel(t: TFunction, status: string | null): string {
  if (status === "IsUnplayed") return t("common:unwatched");
  if (status === "IsResumable") return t("common:inProgress");
  return t("common:allFilter");
}

const ratingValue = (min: number) => `★ ${ratingLabel(min)}+`;

/** « Action », « Action +2 » — la valeur d'une pastille à choix multiples. */
function manyLabel(names: string[], none: string): string {
  if (names.length === 0) return none;
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
}

const genreName = (genres: GenreOption[], id: string) => genres.find((g) => g.id === id)?.name;
const platformName = (id: number) => PLATFORMS.find((p) => p.id === id)?.name;
const present = (name: string | undefined): name is string => !!name;

/** Les sept pastilles, dans l'ordre de l'écran, chacune avec sa valeur. */
export function pillsOf(t: TFunction, f: LibraryFilterState, genres: GenreOption[]): FilterPillModel[] {
  const genreNames = f.genreIds.map((id) => genreName(genres, id)).filter(present);
  const platformNames = f.platformIds.map(platformName).filter(present);
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
      value: f.ratingMin != null ? ratingValue(f.ratingMin) : t("common:ratingAny"),
      active: f.ratingMin != null,
    },
    { key: "platforms", label: t("common:platforms"), value: manyLabel(platformNames, t("common:allFilter")), active: platformNames.length > 0 },
  ];
}

/** Les filtres actifs, un par geste de retrait. Le tri n'en est pas un : il
 *  ordonne, il ne retire rien. */
export function activeFiltersOf(t: TFunction, f: LibraryFilterState, genres: GenreOption[]): ActiveFilterModel[] {
  const active: ActiveFilterModel[] = [];
  if (f.statusFilter) active.push({ id: "status", label: statusLabel(t, f.statusFilter) });
  if (f.isFavorite) active.push({ id: "favorites", label: t("common:favorites") });
  for (const id of f.genreIds) {
    const name = genreName(genres, id);
    if (name) active.push({ id: `genre:${id}`, label: name });
  }
  const years = yearsLabel(f);
  if (years) active.push({ id: "years", label: years });
  if (f.ratingMin != null) active.push({ id: "rating", label: ratingValue(f.ratingMin) });
  for (const id of f.platformIds) {
    const name = platformName(id);
    if (name) active.push({ id: `platform:${id}`, label: name });
  }
  return active;
}

/** Retirer un filtre actif (sa croix). */
export function removeFilter(f: LibraryFilterState, id: string): LibraryFilterState {
  if (id === "status") return { ...f, statusFilter: null };
  if (id === "favorites") return { ...f, isFavorite: false };
  if (id === "years") return { ...f, yearFrom: null, yearTo: null };
  if (id === "rating") return { ...f, ratingMin: null };
  if (id.startsWith("genre:")) return { ...f, genreIds: f.genreIds.filter((g) => g !== id.slice(6)) };
  if (id.startsWith("platform:")) return { ...f, platformIds: f.platformIds.filter((p) => String(p) !== id.slice(9)) };
  return f;
}

/** Favoris : une bascule, exclusive du statut (parité `useLibraryFilters`). */
export function toggleFavorites(f: LibraryFilterState): LibraryFilterState {
  return { ...f, isFavorite: !f.isFavorite, statusFilter: f.isFavorite ? f.statusFilter : null };
}
