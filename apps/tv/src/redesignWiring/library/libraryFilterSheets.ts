import { PLATFORMS } from "@tentacle-tv/shared";
import type { TFunction } from "i18next";
import { DEFAULT_FILTERS, SORT_OPTIONS, type LibraryFilterState } from "../../hooks/libraryCatalogParams";
import type { FilterSheetModel, LibraryFilterKey, RatingStop } from "../../redesign/screens/library/libraryTypes";
import { ratingLabel, statusLabel, type GenreOption } from "./libraryFilterModel";

/**
 * Les grandes listes en surimpression de la bibliothèque, tirées de l'état
 * des filtres : options cochées, valeurs en mots, « Voir N titres ». Et leur
 * effet sur cet état — ce que l'écran passe à `useLibraryFilters().update`.
 * Pur, comme `libraryFilterModel` : le banc UI en tire ses scènes.
 */

export interface SheetContext {
  genres: GenreOption[];
  /** Le nombre de titres que donnent les filtres courants. */
  resultCount: number;
  /** Les années extrêmes connues du catalogue : les décennies proposées, et
   *  le point de départ d'une borne libre. */
  span: [number, number];
}

/** Jusqu'où vont les flèches d'une borne (l'ancien menu acceptait 1900–2100 ;
 *  au-delà de l'an prochain, rien n'est encore sorti). */
export const YEAR_LIMITS: readonly [number, number] = [1900, new Date().getFullYear() + 1];

/** Sans titre daté : les quatre dernières décennies. */
const FALLBACK_SPAN_YEARS = 40;

/**
 * Les années extrêmes des titres connus. Jellyfin ne dit pas celles d'une
 * bibliothèque (son `/Years` n'est pas proxyfié) : on les lit sur ce qui est
 * chargé — un échantillon A→Z sans lien avec les années, qui s'élargit page
 * après page.
 */
export function yearSpanOf(items: ReadonlyArray<{ ProductionYear?: number | null }>): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const item of items) {
    const year = item.ProductionYear;
    if (!year) continue;
    if (year < min) min = year;
    if (year > max) max = year;
  }
  const now = new Date().getFullYear();
  return min <= max ? [min, max] : [now - FALLBACK_SPAN_YEARS, now];
}

const MAX_DECADES = 5;

const STATUSES = [
  { id: "all", value: null },
  { id: "IsUnplayed", value: "IsUnplayed" },
  { id: "IsResumable", value: "IsResumable" },
] as const;

/** Les décennies du catalogue, de la plus récente à la plus ancienne. */
function decades(span: [number, number]): number[] {
  const out: number[] = [];
  for (let d = Math.floor(span[1] / 10) * 10; d >= Math.floor(span[0] / 10) * 10 && out.length < MAX_DECADES; d -= 10) out.push(d);
  return out;
}

function selectedSubtitle(t: TFunction, count: number): string {
  return count > 0 ? t("library:selected", { count }) : t("library:multipleChoice");
}

export function sheetOf(t: TFunction, kind: LibraryFilterKey, f: LibraryFilterState, ctx: SheetContext): FilterSheetModel | null {
  const base = { filter: kind, applyLabel: t("common:showResultsCount", { count: ctx.resultCount }) };
  const clear = t("common:clear");
  switch (kind) {
    case "genres":
      return {
        ...base,
        kind: "choice",
        title: t("common:genres"),
        subtitle: selectedSubtitle(t, f.genreIds.length),
        clearLabel: f.genreIds.length ? clear : undefined,
        multiple: true,
        columns: 3,
        visibleRows: 7,
        options: ctx.genres.map((g) => ({ id: g.id, label: g.name, selected: f.genreIds.includes(g.id) })),
      };
    case "platforms":
      return {
        ...base,
        kind: "choice",
        title: t("common:platforms"),
        subtitle: selectedSubtitle(t, f.platformIds.length),
        clearLabel: f.platformIds.length ? clear : undefined,
        multiple: true,
        columns: 3,
        options: PLATFORMS.map((p) => ({ id: String(p.id), label: p.name, selected: f.platformIds.includes(p.id) })),
      };
    case "status":
      return {
        ...base,
        kind: "choice",
        title: t("library:watchStatus"),
        multiple: false,
        columns: 1,
        options: STATUSES.map((s) => ({ id: s.id, label: statusLabel(t, s.value), selected: f.statusFilter === s.value })),
      };
    case "sort":
      return {
        ...base,
        kind: "sort",
        title: t("common:sortBy"),
        criteriaTitle: t("library:sortCriterion"),
        criteria: SORT_OPTIONS.map((s) => ({ id: s.value, label: t(`common:${s.key}`), selected: f.sortBy === s.value })),
        orderTitle: t("common:sortOrder"),
        orders: [
          { id: "order:Descending", label: t("common:sortOrderDesc"), selected: f.sortOrder === "Descending" },
          { id: "order:Ascending", label: t("common:sortOrderAsc"), selected: f.sortOrder === "Ascending" },
        ],
      };
    case "years": {
      const set = f.yearFrom != null || f.yearTo != null;
      return {
        ...base,
        kind: "years",
        title: t("common:sortYear"),
        clearLabel: set ? clear : undefined,
        from: { label: t("common:yearFrom"), value: f.yearFrom != null ? String(f.yearFrom) : "—", set: f.yearFrom != null },
        to: { label: t("common:yearTo"), value: f.yearTo != null ? String(f.yearTo) : "—", set: f.yearTo != null },
        presetsTitle: t("library:decades"),
        presets: [
          { id: "all", label: t("common:allYears"), selected: !set },
          ...decades(ctx.span).map((d) => ({
            id: `decade:${d}`,
            label: t("favorites:sectionDecade", { decade: d }),
            selected: f.yearFrom === d && f.yearTo === d + 9,
          })),
        ],
        stepLabels: { previous: t("common:previous"), next: t("common:next") },
      };
    }
    case "rating": {
      const min = f.ratingMin ?? 0;
      const stops: RatingStop[] = Array.from({ length: 21 }, (_, i) => {
        const value = i / 2;
        return { value, label: ratingLabel(value), selected: value === min, kept: value >= min };
      });
      return {
        ...base,
        kind: "rating",
        title: t("common:ratingMin"),
        clearLabel: f.ratingMin != null ? clear : undefined,
        readoutValue: f.ratingMin != null ? ratingLabel(f.ratingMin) : undefined,
        readoutText: f.ratingMin != null ? t("library:ratingAndUp") : t("common:ratingAny"),
        stops,
      };
    }
    default:
      return null;
  }
}

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

/** Une option choisie dans une liste — l'effet sur l'état des filtres. */
export function applyOption(f: LibraryFilterState, filter: LibraryFilterKey, id: string): LibraryFilterState {
  if (filter === "genres") return { ...f, genreIds: toggle(f.genreIds, id) };
  if (filter === "platforms") return { ...f, platformIds: toggle(f.platformIds, Number(id)) };
  // Statut et Favoris s'excluent (parité `useLibraryFilters`).
  if (filter === "status") return { ...f, statusFilter: id === "all" ? null : id, isFavorite: false };
  if (filter === "sort") {
    if (id.startsWith("order:")) return { ...f, sortOrder: id.slice(6) };
    // Un critère pose son ordre naturel.
    const sort = SORT_OPTIONS.find((s) => s.value === id);
    return sort ? { ...f, sortBy: sort.value, sortOrder: sort.order } : f;
  }
  if (filter === "years") {
    if (id === "all") return { ...f, yearFrom: null, yearTo: null };
    const decade = Number(id.slice(7));
    return { ...f, yearFrom: decade, yearTo: decade + 9 };
  }
  return f;
}

/** « Effacer » dans une liste : ce critère revient à son défaut. */
export function clearCriterion(f: LibraryFilterState, filter: LibraryFilterKey): LibraryFilterState {
  if (filter === "genres") return { ...f, genreIds: [] };
  if (filter === "platforms") return { ...f, platformIds: [] };
  if (filter === "status") return { ...f, statusFilter: null };
  if (filter === "years") return { ...f, yearFrom: null, yearTo: null };
  if (filter === "rating") return { ...f, ratingMin: null };
  if (filter === "sort") return { ...f, sortBy: DEFAULT_FILTERS.sortBy, sortOrder: DEFAULT_FILTERS.sortOrder };
  return f;
}

/**
 * Une flèche d'une borne d'années. Une borne libre prend d'abord son point de
 * départ — l'année la plus ancienne connue pour « De », la plus récente pour
 * « À » — ; les appuis suivants la déplacent d'un an. L'intervalle reste
 * dans l'ordre : pousser « De » au-delà de « À » emmène « À » avec lui.
 */
export function stepYear(f: LibraryFilterState, bound: "from" | "to", delta: -1 | 1, span: [number, number]): LibraryFilterState {
  const current = bound === "from" ? f.yearFrom : f.yearTo;
  const start = bound === "from" ? span[0] : span[1];
  const next = current == null ? start : Math.min(YEAR_LIMITS[1], Math.max(YEAR_LIMITS[0], current + delta));
  if (bound === "from") return { ...f, yearFrom: next, yearTo: f.yearTo != null && f.yearTo < next ? next : f.yearTo };
  return { ...f, yearTo: next, yearFrom: f.yearFrom != null && f.yearFrom > next ? next : f.yearFrom };
}

/** Un palier de note choisi : zéro, c'est « toutes ». */
export function selectRating(f: LibraryFilterState, value: number): LibraryFilterState {
  return { ...f, ratingMin: value > 0 ? value : null };
}
