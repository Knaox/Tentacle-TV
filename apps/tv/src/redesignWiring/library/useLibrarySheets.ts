import { useCallback, useRef, useState } from "react";
import type { TFunction } from "i18next";
import type { LibraryFilterState } from "../../hooks/libraryCatalogParams";
import type { FilterSheetHandlers, FilterSheetModel, LibraryFilterKey } from "../../redesign/screens/library/libraryTypes";
import { createEntryGuide } from "../focus/entryGuide";
import type { FocusStore } from "../focus/focusStore";
import { useChoiceEntry } from "../settings/settingsFocus";
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

/** Tous les éléments focalisables d'une liste (en-têtes des vues des listes). */
export function sheetFocusKeys(sheet: FilterSheetModel): string[] {
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
  if (sheet.clearLabel) keys.push("sheet:clear");
  keys.push("sheet:apply");
  return keys;
}

const NO_KEYS: string[] = [];
const isFooterKey = (key: string) => key === "sheet:apply" || key === "sheet:clear";

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
 * l'ouverture : cocher en série ne doit pas faire sauter le focus. La liste
 * vit dans une Modal (`LibraryView`), où aucune préférence de focus n'est
 * honorée : seule l'entrée y est focalisable à l'ouverture (`useChoiceEntry`).
 * « Effacer », qui disparaît sous le doigt, rend le focus au premier choix par
 * le même verrou. BAS depuis n'importe quelle colonne atteint le pied de la
 * liste (groupe `sheet:footer`), par « Voir N titres ». En sortir rend le
 * focus à la pastille qui l'a ouverte (restauration de tvOS, réclamée en plus).
 */
export function useLibrarySheets(t: TFunction, filters: LibraryFilterState, update: Update, focus: FocusStore, context: SheetContext): LibrarySheets {
  const [open, setOpen] = useState<{ filter: LibraryFilterKey; entry: string } | null>(null);
  // Les gestionnaires lisent l'état du moment sans changer d'identité.
  const latest = useRef({ t, filters, context });
  latest.current = { t, filters, context };

  // Le pied de la liste, lié avant le premier rendu d'une liste.
  useState(() => focus.bind("sheet:footer", { container: createEntryGuide(focus, { owns: isFooterKey, fallback: () => "sheet:apply" }) }));

  const sheet = open ? sheetOf(t, open.filter, filters, context) : null;
  useChoiceEntry(focus, sheet ? sheetFocusKeys(sheet) : NO_KEYS, open?.entry ?? null);

  const openSheet = useCallback((key: LibraryFilterKey) => {
    const { t: tr, filters: f, context: ctx } = latest.current;
    const initial = sheetOf(tr, key, f, ctx);
    if (initial) setOpen({ filter: key, entry: sheetEntryKey(initial) });
  }, []);

  const openRef = useRef(open);
  openRef.current = open;
  const closeSheet = useCallback(() => {
    const current = openRef.current;
    if (!current) return;
    setOpen(null);
    focus.claim(`pill:${current.filter}`);
  }, [focus]);

  const onSheetOption = useCallback((filter: LibraryFilterKey, id: string) => update((f) => applyOption(f, filter, id)), [update]);
  const onSheetClear = useCallback((filter: LibraryFilterKey) => {
    const { t: tr, filters: f, context: ctx } = latest.current;
    const cleared = sheetOf(tr, filter, clearCriterion(f, filter), ctx);
    update((current) => clearCriterion(current, filter));
    if (cleared) setOpen((current) => (current ? { ...current, entry: sheetEntryKey(cleared) } : current));
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
    onSheetOption,
    onSheetClear,
    onSheetApply: closeSheet,
    onYearStep,
    onRatingSelect,
  };
}
