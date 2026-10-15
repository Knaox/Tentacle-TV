import { useCallback, useMemo, useRef } from "react";
import type { TFunction } from "i18next";
import type { LibraryFilterState } from "../../hooks/libraryCatalogParams";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import type { FilterSheetHandlers } from "../../redesign/screens/library/libraryTypes";
import { applyOption, clearCriterion, selectRating, sheetOf, stepYear, type SheetContext } from "./libraryFilterSheets";
import { useFilterSheets, type FilterSheets, type FilterUpdate } from "./useFilterSheets";

export interface LibrarySheets extends FilterSheets, Required<FilterSheetHandlers> {}

/**
 * Les grandes listes de la bibliothèque : celles de toute barre de filtres
 * (`useFilterSheets` — ouverture, entrée verrouillée, pied, Retour, pastille
 * rendue), plus les deux gestes propres à la bibliothèque : les flèches des
 * années et les paliers de la note.
 */
export function useLibrarySheets(
  t: TFunction,
  filters: LibraryFilterState,
  update: FilterUpdate<LibraryFilterState>,
  focus: FocusStore,
  context: SheetContext,
): LibrarySheets {
  const model = useMemo(
    () => ({ sheetOf: (key: Parameters<typeof sheetOf>[1], f: LibraryFilterState) => sheetOf(t, key, f, context), apply: applyOption, clear: clearCriterion }),
    [t, context],
  );
  const sheets = useFilterSheets(filters, update, focus, model);
  const span = useRef(context.span);
  span.current = context.span;
  const onYearStep = useCallback(
    (bound: "from" | "to", delta: -1 | 1) => update((f) => stepYear(f, bound, delta, span.current)),
    [update],
  );
  const onRatingSelect = useCallback((value: number) => update((f) => selectRating(f, value)), [update]);
  return { ...sheets, onYearStep, onRatingSelect };
}
