import { useCallback, useRef, useState } from "react";
import type { TFunction } from "i18next";
import type { LibraryFilterState } from "../../hooks/libraryCatalogParams";
import type { FilterSheetHandlers, FilterSheetModel, LibraryFilterKey } from "../../redesign/screens/library/libraryTypes";
import type { FocusStore } from "../focus/focusStore";
import { applyOption, clearCriterion, selectRating, sheetOf, stepYear, type SheetContext } from "./libraryFilterSheets";

type Update = (effect: (f: LibraryFilterState) => LibraryFilterState) => void;

/** L'élément qui reçoit le focus à l'ouverture d'une liste : ce qui est
 *  retenu (option cochée, critère, décennie, palier), sinon le premier. */
export function sheetEntryKey(sheet: FilterSheetModel): string {
  const first = (index: number) => Math.max(0, index);
  switch (sheet.kind) {
    case "choice":
      return `sheet:option:${first(sheet.options.findIndex((o) => o.selected))}`;
    case "sort":
      return `sheet:option:${first(sheet.criteria.findIndex((o) => o.selected))}`;
    case "years": {
      const preset = sheet.presets.findIndex((o) => o.selected);
      // Un intervalle sur mesure : ses flèches.
      return preset >= 0 ? `sheet:preset:${preset}` : "sheet:from:prev";
    }
    case "rating":
      return `sheet:stop:${first(sheet.stops.findIndex((s) => s.selected))}`;
  }
}

export interface LibrarySheets extends Required<FilterSheetHandlers> {
  /** La liste ouverte, mise en mots ; rien quand aucune ne l'est. */
  sheet: FilterSheetModel | null;
  openSheet: (key: LibraryFilterKey) => void;
  /** Menu, Retour ou « Voir N titres ». */
  closeSheet: () => void;
}

/**
 * Les grandes listes de la bibliothèque : laquelle est ouverte, ce qu'elle
 * montre, et le focus qui va avec. On y ENTRE par ce qui est retenu — figé à
 * l'ouverture : cocher en série ne doit pas faire sauter le focus — et
 * « Effacer », qui disparaît sous le doigt, rend le focus au premier choix.
 * La liste vit dans une Modal (`LibraryView`) : en sortir rend le focus à la
 * pastille qui l'a ouverte (restauration de tvOS, réclamée en plus).
 */
export function useLibrarySheets(t: TFunction, filters: LibraryFilterState, update: Update, focus: FocusStore, context: SheetContext): LibrarySheets {
  const [open, setOpen] = useState<LibraryFilterKey | null>(null);
  const entry = useRef<string | null>(null);
  // Les gestionnaires lisent l'état du moment sans changer d'identité.
  const latest = useRef({ t, filters, context });
  latest.current = { t, filters, context };

  const release = useCallback(() => {
    if (entry.current) focus.bind(entry.current, null);
    entry.current = null;
  }, [focus]);

  const openSheet = useCallback((key: LibraryFilterKey) => {
    const { t: tr, filters: f, context: ctx } = latest.current;
    const initial = sheetOf(tr, key, f, ctx);
    if (!initial) return;
    release();
    // Posée AVANT le montage : la cible la lit à son premier rendu.
    entry.current = sheetEntryKey(initial);
    focus.bind(entry.current, { native: { hasTVPreferredFocus: true } });
    setOpen(key);
  }, [focus, release]);

  const openRef = useRef(open);
  openRef.current = open;
  const closeSheet = useCallback(() => {
    const key = openRef.current;
    if (!key) return;
    release();
    setOpen(null);
    focus.claim(`pill:${key}`);
  }, [focus, release]);

  const onSheetOption = useCallback((filter: LibraryFilterKey, id: string) => update((f) => applyOption(f, filter, id)), [update]);
  const onSheetClear = useCallback((filter: LibraryFilterKey) => {
    const { t: tr, filters: f, context: ctx } = latest.current;
    const cleared = sheetOf(tr, filter, clearCriterion(f, filter), ctx);
    update((current) => clearCriterion(current, filter));
    if (cleared) focus.claim(sheetEntryKey(cleared));
  }, [update, focus]);
  const onYearStep = useCallback(
    (bound: "from" | "to", delta: -1 | 1) => update((f) => stepYear(f, bound, delta, latest.current.context.span)),
    [update],
  );
  const onRatingSelect = useCallback((value: number) => update((f) => selectRating(f, value)), [update]);

  return {
    sheet: open ? sheetOf(t, open, filters, context) : null,
    openSheet,
    closeSheet,
    onSheetOption,
    onSheetClear,
    onSheetApply: closeSheet,
    onYearStep,
    onRatingSelect,
  };
}
