import { useCallback, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { filterSheetEntryKey } from "@tentacle-tv/tv-core";
import type { LibraryFilterState } from "../../hooks/libraryCatalogParams";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useFilterSheetFocus } from "../../platform/tvos/screens/library";
import type { FilterSheetHandlers, FilterSheetModel, LibraryFilterKey } from "../../redesign/screens/library/libraryTypes";
import { useBackLayer } from "../back/BackScope";
import { applyOption, clearCriterion, selectRating, sheetOf, stepYear, type SheetContext } from "./libraryFilterSheets";

type Update = (effect: (f: LibraryFilterState) => LibraryFilterState) => void;

export interface LibrarySheets extends Required<FilterSheetHandlers> {
  /** La liste ouverte, mise en mots ; rien quand aucune ne l'est. */
  sheet: FilterSheetModel | null;
  openSheet: (key: LibraryFilterKey) => void;
  /** Menu, Retour ou « Voir N titres ». */
  closeSheet: () => void;
  /** La liste a fini de s'effacer, sa Modal se retire : le focus revient à sa pastille. */
  onSheetExited: () => void;
}

/**
 * Les grandes listes de la bibliothèque : laquelle est ouverte, ce qu'elle
 * montre, et le focus qui va avec. On y ENTRE par ce qui est retenu — figé à
 * l'ouverture : cocher en série ne doit pas faire sauter le focus. La liste
 * vit dans une Modal (`LibraryView`), où aucune préférence de focus n'est
 * honorée : seule l'entrée y est focalisable à l'ouverture (`useChoiceEntry`).
 * « Effacer », qui disparaît sous le doigt, rend le focus au premier choix par
 * le même verrou. BAS depuis n'importe quelle colonne atteint le pied de la
 * liste (groupe `sheet:footer`), par « Voir N titres ». En sortir rend le
 * focus à la pastille qui l'a ouverte (restauration de tvOS, réclamée en plus
 * à la fin du fondu de la liste : réclamé pendant, la Modal le gardait).
 */
export function useLibrarySheets(t: TFunction, filters: LibraryFilterState, update: Update, focus: FocusStore, context: SheetContext): LibrarySheets {
  const [open, setOpen] = useState<{ filter: LibraryFilterKey; entry: string } | null>(null);
  // Les gestionnaires lisent l'état du moment sans changer d'identité.
  const latest = useRef({ t, filters, context });
  latest.current = { t, filters, context };

  const sheet = open ? sheetOf(t, open.filter, filters, context) : null;
  // Le pied de la liste, son entrée verrouillée, la pastille rendue (applicateur tvOS).
  const { returnToPill } = useFilterSheetFocus(focus, sheet, open?.entry ?? null);

  const openSheet = useCallback((key: LibraryFilterKey) => {
    const { t: tr, filters: f, context: ctx } = latest.current;
    const initial = sheetOf(tr, key, f, ctx);
    if (initial) setOpen({ filter: key, entry: filterSheetEntryKey(initial) });
  }, []);

  const openRef = useRef(open);
  openRef.current = open;
  // Le critère dont la pastille reprend le focus, une fois la liste effacée.
  const closedFilter = useRef<string | null>(null);
  const closeSheet = useCallback(() => {
    const current = openRef.current;
    if (!current) return;
    setOpen(null);
    closedFilter.current = current.filter;
  }, []);
  const onSheetExited = useCallback(() => {
    const filter = closedFilter.current;
    closedFilter.current = null;
    if (filter) returnToPill(filter);
  }, [returnToPill]);
  // Retour, liste ouverte : la refermer (la Modal le reçoit, `onSheetClose`).
  useBackLayer("menu", open !== null, closeSheet);

  const onSheetOption = useCallback((filter: LibraryFilterKey, id: string) => update((f) => applyOption(f, filter, id)), [update]);
  const onSheetClear = useCallback((filter: LibraryFilterKey) => {
    const { t: tr, filters: f, context: ctx } = latest.current;
    const cleared = sheetOf(tr, filter, clearCriterion(f, filter), ctx);
    update((current) => clearCriterion(current, filter));
    if (cleared) setOpen((current) => (current ? { ...current, entry: filterSheetEntryKey(cleared) } : current));
  }, [update]);
  const onYearStep = useCallback(
    (bound: "from" | "to", delta: -1 | 1) => update((f) => stepYear(f, bound, delta, latest.current.context.span)),
    [update],
  );
  const onRatingSelect = useCallback((value: number) => update((f) => selectRating(f, value)), [update]);

  return {
    sheet,
    openSheet,
    closeSheet,
    onSheetExited,
    onSheetOption,
    onSheetClear,
    onSheetApply: closeSheet,
    onYearStep,
    onRatingSelect,
  };
}
