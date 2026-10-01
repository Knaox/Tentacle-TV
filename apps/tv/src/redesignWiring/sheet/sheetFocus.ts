import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusBinder, FocusBinding } from "../../redesign/focus/focusBinding";
import {
  RATING_ENTRY,
  SCALE_FOCUS_KEYS,
  scaleFocusKey,
  type SheetActionModel,
  type SheetRatingModel,
} from "../../redesign/screens/sheet/ActionSheetView";
import { createEntryGuide } from "../focus/entryGuide";
import type { FocusStore } from "../focus/focusStore";
import { useChoiceEntry } from "../settings/settingsFocus";

/**
 * Le FOCUS du grand panneau, que la vue (`ActionSheetView`) ne décide pas —
 * commun au câblage (`ActionSheetRedesign`, dans sa `Modal`) et au banc, qui
 * l'éprouve en focus natif.
 *
 * - L'ENTRÉE (`sheetEntryOf`) : l'échelle de la note, sur la note posée,
 *   sinon sur 5/10 (`RATING_ENTRY`) ; sans note à poser, le premier picto.
 *   Dans une `Modal`, aucune préférence de focus n'est honorée : les autres
 *   cibles restent infocalisables jusqu'au premier focus (`useChoiceEntry`).
 * - Les GROUPES ont un guide d'entrée : HAUT depuis un picto revient sur la
 *   note posée (sinon 5), pas sur le cran qui se trouve au-dessus ; BAS depuis
 *   l'échelle entre dans les pictos par la lecture, puis par le dernier visité.
 * - La garde anti-clic fantôme couvre l'échelle, les pictos et la croix : le
 *   panneau s'ouvre sous un OK encore enfoncé (l'appui long), dont le
 *   relâchement ne doit rien valider — surtout pas une note.
 */

export const SHEET_CLOSE_KEY = "sheet:close";
export const sheetActionKey = (kind: SheetActionModel["kind"]) => `sheet:action:${kind}`;
const GUARDED = /^sheet:(action|scale):|^sheet:close$/;

/** L'entrée du panneau, une fois la note connue ; null tant qu'elle se résout. */
export function sheetEntryOf(rating: SheetRatingModel | null | undefined, actions: SheetActionModel[]): string | null {
  if (rating?.pending) return null;
  if (rating) return scaleFocusKey(rating.current ?? RATING_ENTRY);
  return firstPictoOf(actions);
}

/** Le premier picto, sinon la croix. */
export function firstPictoOf(actions: SheetActionModel[]): string {
  return actions[0] ? sheetActionKey(actions[0].kind) : SHEET_CLOSE_KEY;
}

export interface SheetFocusInput {
  rating: SheetRatingModel | null | undefined;
  actions: SheetActionModel[];
  /** L'entrée décidée (`sheetEntryOf`), figée ensuite ; null tant que le panneau attend. */
  entry: string | null;
}

/** Le port du focus du panneau, à poser par `FocusBindingProvider` autour de la vue. */
export function useSheetFocus(focus: FocusStore, { rating, actions, entry }: SheetFocusInput): FocusBinder {
  const releases = useChoiceEntry(focus, [...SCALE_FOCUS_KEYS, ...actions.map((a) => sheetActionKey(a.kind)), SHEET_CLOSE_KEY], entry);
  useGroupGuides(focus, rating, actions);

  // Une identité neuve à chaque libération du verrou : les éléments relisent leur liaison.
  return useCallback(
    (key: string): FocusBinding | undefined => {
      const binding = focus.binder(key);
      return GUARDED.test(key) ? { ...binding, phantomPressGuard: true } : binding;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [focus, releases],
  );
}

/**
 * Les guides d'entrée des groupes, liés AVANT leur premier rendu (le port
 * l'exige) et une seule fois ; ce qui varie — la note posée, le premier
 * picto — se lit au moment de viser.
 */
function useGroupGuides(focus: FocusStore, rating: SheetRatingModel | null | undefined, actions: SheetActionModel[]): void {
  const latest = useRef({ rating, actions });
  latest.current = { rating, actions };
  useState(() => {
    focus.bind("sheet:scale", {
      container: createEntryGuide(focus, {
        owns: (key) => key.startsWith("sheet:scale:"),
        fallback: () => scaleFocusKey(latest.current.rating?.current ?? RATING_ENTRY),
        remember: false,
      }),
    });
    focus.bind("sheet:actions", {
      container: createEntryGuide(focus, {
        owns: (key) => key.startsWith("sheet:action:"),
        fallback: () => (latest.current.actions[0] ? sheetActionKey(latest.current.actions[0].kind) : null),
      }),
    });
    return true;
  });
  useEffect(
    () => () => {
      focus.bind("sheet:scale", null);
      focus.bind("sheet:actions", null);
    },
    [focus],
  );
}
