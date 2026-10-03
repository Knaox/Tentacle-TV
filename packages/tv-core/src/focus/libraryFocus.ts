import { libraryIdOf, navEntryOf } from "../nav/railKeys";
import { GRID_FIRST_KEY } from "./gridFocus";

/**
 * Le focus de la BIBLIOTHÈQUE d'un téléviseur — sa barre de filtres façon
 * Netflix (une pastille par critère, les filtres actifs dessous, « Tout
 * effacer »), ses grandes listes de choix, sa grille. Module pur : la
 * plateforme pose le focus, verrouille, réclame.
 */

/** La pastille de tête : elle tient le focus pendant un premier chargement. */
export const LIBRARY_LOADING_ENTRY = "pill:status";

/** La barre de filtres (un groupe qui mémorise) et le vide des filtres trop serrés. */
export const LIBRARY_FILTERS_GROUP = "filters";
export const LIBRARY_EMPTY_GROUP = "library:empty";
export const LIBRARY_EMPTY_ACTION = "empty:primary";
export const isLibraryEmptyKey = (key: string): boolean => key.startsWith("empty:");

/**
 * L'entrée de la bibliothèque (BI-1) : le panneau d'état (erreur, bibliothèque
 * vide), la pastille de tête pendant le chargement, la première affiche, la
 * sortie du vide des filtres trop serrés (« Tout effacer »).
 */
export function libraryEntryKey(state: { status: boolean; loading: boolean; items: number; noResults: boolean }): string {
  if (state.status) return "status:primary";
  if (state.loading) return LIBRARY_LOADING_ENTRY;
  if (state.items > 0) return GRID_FIRST_KEY;
  return state.noResults ? LIBRARY_EMPTY_ACTION : LIBRARY_LOADING_ENTRY;
}

/** Un focus qui annule la reprise du premier chargement : ailleurs que la pastille de tête, hors navigation. */
export function libraryFocusMoved(focusedKey: string, inNavigation: boolean): boolean {
  return focusedKey !== LIBRARY_LOADING_ENTRY && !inNavigation;
}

/**
 * Premier chargement (BI-2) : les affiches arrivées, la première reprend le
 * focus à la pastille de tête — si personne n'a bougé entre-temps.
 */
export function libraryClaimAfterLoad(state: { loading: boolean; items: number; moved: boolean; focusedKey: string | null }): string | null {
  if (state.loading || state.items === 0 || state.moved || state.focusedKey !== LIBRARY_LOADING_ENTRY) return null;
  return GRID_FIRST_KEY;
}

/** OK sur une pastille (BI-5) : Favoris bascule, les autres ouvrent leur liste. */
export function filterPillPress(pill: string): "toggleFavorites" | "openSheet" {
  return pill === "favorites" ? "toggleFavorites" : "openSheet";
}

/** Le critère d'un filtre actif : sa pastille (un genre → « genres », une plateforme → « platforms »). */
export function filterCriterionOf(filterId: string): string {
  if (filterId.startsWith("genre:")) return "genres";
  if (filterId.startsWith("platform:")) return "platforms";
  return filterId;
}

/**
 * Le focus après le retrait d'un filtre actif (BI-5) : le filtre qui prend sa
 * place (sinon le précédent) ; la rangée vidée, la pastille de son critère.
 * Retirer démonte ce qu'on vient d'actionner : sans réclamation, le focus
 * tomberait où la plateforme veut — la navigation, souvent.
 */
export function filterFocusAfterRemove(activeIds: readonly string[], removedId: string): string {
  const index = activeIds.indexOf(removedId);
  const remaining = activeIds.length - 1;
  return remaining > 0 ? `active:${Math.min(Math.max(0, index), remaining - 1)}` : `pill:${filterCriterionOf(removedId)}`;
}

/** « Tout effacer » (BI-5) : la pastille de tête ; depuis le vide des filtres trop serrés, la première affiche revenue. */
export function filterFocusAfterClearAll(focusedKey: string | null): string {
  return focusedKey === LIBRARY_EMPTY_ACTION ? GRID_FIRST_KEY : LIBRARY_LOADING_ENTRY;
}

/** Une grande liste, vue d'ici : ce qui y est retenu. */
type Choice = { readonly selected: boolean };
export type FilterSheetShape =
  | { kind: "choice"; options: readonly Choice[]; clearLabel?: string }
  | { kind: "sort"; criteria: readonly Choice[]; orders: readonly unknown[]; clearLabel?: string }
  | { kind: "years"; presets: readonly Choice[]; clearLabel?: string }
  | { kind: "rating"; stops: readonly Choice[]; clearLabel?: string };

/** Le pied d'une liste (un guide d'entrée) : « Voir N titres », BAS depuis n'importe quelle colonne (BI-8). */
export const SHEET_FOOTER_GROUP = "sheet:footer";
export const SHEET_APPLY_KEY = "sheet:apply";
export const SHEET_CLEAR_KEY = "sheet:clear";
export const isSheetFooterKey = (key: string): boolean => key === SHEET_APPLY_KEY || key === SHEET_CLEAR_KEY;

/**
 * L'entrée d'une liste à son ouverture (BI-7) : ce qui est retenu — l'option
 * cochée, le critère de tri, la décennie, le palier —, sinon le premier ; un
 * intervalle d'années sur mesure : ses flèches.
 */
export function filterSheetEntryKey(sheet: FilterSheetShape): string {
  const first = (index: number) => Math.max(0, index);
  switch (sheet.kind) {
    case "choice":
      return `sheet:option:${first(sheet.options.findIndex((o) => o.selected))}`;
    case "sort":
      return `sheet:option:${first(sheet.criteria.findIndex((o) => o.selected))}`;
    case "years": {
      const preset = sheet.presets.findIndex((o) => o.selected);
      return preset >= 0 ? `sheet:preset:${preset}` : "sheet:from:prev";
    }
    case "rating":
      return `sheet:stop:${first(sheet.stops.findIndex((s) => s.selected))}`;
  }
}

/** Tous les éléments focalisables d'une liste (BI-6), dans leur ordre. */
export function filterSheetFocusKeys(sheet: FilterSheetShape): string[] {
  const keys: string[] = [];
  const add = (prefix: string, count: number) => {
    for (let index = 0; index < count; index++) keys.push(`${prefix}:${index}`);
  };
  switch (sheet.kind) {
    case "choice":
      add("sheet:option", sheet.options.length);
      break;
    case "sort":
      add("sheet:option", sheet.criteria.length);
      add("sheet:order", sheet.orders.length);
      break;
    case "years":
      keys.push("sheet:from:prev", "sheet:from:next", "sheet:to:prev", "sheet:to:next");
      add("sheet:preset", sheet.presets.length);
      break;
    case "rating":
      add("sheet:stop", sheet.stops.length);
      break;
  }
  if (sheet.clearLabel) keys.push(SHEET_CLEAR_KEY);
  keys.push(SHEET_APPLY_KEY);
  return keys;
}

/** La liste effacée, sa Modal retirée : la pastille qui l'avait ouverte reprend le focus (BI-10). */
export const filterPillKey = (filter: string): string => `pill:${filter}`;

/** Le focus qui TIENT sur une bibliothèque, dans la navigation, la prépare (BI-11). */
export const LIBRARY_PREFETCH_DWELL_MS = 300;

/** Les affiches préchargées : deux lignes de six, ce que montre la grille à l'ouverture. */
export const LIBRARY_PREFETCH_POSTERS = 12;

/** La bibliothèque d'une entrée de la navigation focalisée, ou `null` (BI-11). */
export function libraryPrefetchTarget(focusKey: string): string | null {
  const entry = navEntryOf(focusKey);
  return entry ? libraryIdOf(entry) : null;
}
