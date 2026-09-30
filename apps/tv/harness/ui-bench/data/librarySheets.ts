import { PLATFORMS } from "@tentacle-tv/shared";
import type { TFunction } from "i18next";
import type { FilterSheetModel, LibraryFilterKey, RatingStop } from "../../../src/redesign/screens/library/libraryTypes";
import { DEFAULT_FILTERS, SORTS, ratingLabel, type LibraryFilterState } from "./libraryModels";

/**
 * Les grandes listes en surimpression de la bibliothèque, tirées de l'état
 * des filtres : options cochées, valeurs en mots, « Voir N titres ». Et leur
 * effet sur l'état — ce que feront les setters de `useLibraryFilters` — pour
 * que le banc se manipule à la télécommande.
 */

export interface SheetContext {
  genres: Array<{ id: string; name: string }>;
  /** Le nombre de titres que donnent les filtres courants. */
  resultCount: number;
  /** Les années extrêmes du catalogue. */
  span: [number, number];
}

const STATUSES = [
  { id: "all", value: null, key: "allFilter" },
  { id: "IsUnplayed", value: "IsUnplayed", key: "unwatched" },
  { id: "IsResumable", value: "IsResumable", key: "inProgress" },
] as const;

/** Les décennies du catalogue, de la plus récente à la plus ancienne. */
function decades(span: [number, number]): number[] {
  const out: number[] = [];
  for (let d = Math.floor(span[1] / 10) * 10; d >= Math.floor(span[0] / 10) * 10 && out.length < 5; d -= 10) out.push(d);
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
        options: STATUSES.map((s) => ({ id: s.id, label: t(`common:${s.key}`), selected: f.statusFilter === s.value })),
      };
    case "sort":
      return {
        ...base,
        kind: "sort",
        title: t("common:sortBy"),
        criteriaTitle: t("library:sortCriterion"),
        criteria: SORTS.map((s) => ({ id: s.value, label: t(`common:${s.key}`), selected: f.sortBy === s.value })),
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
  if (filter === "status") return { ...f, statusFilter: id === "all" ? null : id, isFavorite: false };
  if (filter === "sort") {
    if (id.startsWith("order:")) return { ...f, sortOrder: id.slice(6) };
    const sort = SORTS.find((s) => s.value === id);
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

/** Une flèche d'une borne : un an de plus ou de moins, dans les années du catalogue. */
export function stepYear(f: LibraryFilterState, bound: "from" | "to", delta: -1 | 1, span: [number, number]): LibraryFilterState {
  const current = bound === "from" ? f.yearFrom ?? span[0] : f.yearTo ?? span[1];
  const next = Math.min(span[1], Math.max(span[0], current + delta));
  return bound === "from" ? { ...f, yearFrom: next } : { ...f, yearTo: next };
}
