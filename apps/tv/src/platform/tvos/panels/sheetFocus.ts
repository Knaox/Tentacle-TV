import { useCallback, useEffect, useRef, useState } from "react";
import {
  SHEET_ACTIONS_GROUP,
  SHEET_CLOSE_KEY,
  SHEET_GUIDE_MEMORY,
  SHEET_HEADER_GROUP,
  SHEET_SCALE_GROUP,
  isActionKey,
  isScaleKey,
  isSheetGuardedKey,
  sheetActionsTarget,
  sheetHeaderTarget,
  sheetLockKeys,
  sheetScaleTarget,
  type SheetPicto,
  type SheetRating,
} from "@tentacle-tv/tv-core";
import type { FocusBinder, FocusBinding } from "../../../redesign/focus/focusBinding";
import { createEntryGuide } from "../focus/entryGuide";
import type { FocusStore } from "../focus/focusStore";
import { useChoiceEntry } from "./useChoiceEntry";

/**
 * Applique, sur tvOS, le FOCUS du grand panneau que décide tv-core
 * (`cards/sheetEntry`, `cards/sheetKeys`) — commun au câblage
 * (`ActionSheetRedesign`, `AbsentSheetRedesign`, dans leur `Modal`) et au
 * banc, qui l'éprouve en focus natif :
 *
 * - l'ENTRÉE décidée (`sheetEntryNow`, figée par l'appelant) : les autres
 *   cibles restent infocalisables jusqu'au premier focus (`useChoiceEntry`) —
 *   dans une `Modal`, aucune préférence de focus n'est honorée ;
 * - les trois GROUPES, chacun un guide d'entrée (`TVFocusGuideView`, par
 *   `createEntryGuide`) sur toute la largeur du panneau — le moteur de tvOS ne
 *   vise que ce qui CHEVAUCHE l'élément qu'on quitte : le guide reçoit le
 *   geste et le rend à la cible que tv-core lui donne (la croix une fois le
 *   verrou levé, le cran retenu, le picto retenu) ;
 * - la garde anti-clic fantôme sur les cibles que tv-core désigne : le
 *   panneau s'ouvre sous un OK encore enfoncé.
 */

export interface SheetFocusInput {
  rating: SheetRating | null | undefined;
  actions: readonly SheetPicto[];
  /** L'entrée décidée, figée ensuite ; null tant que le panneau attend. */
  entry: string | null;
}

/** Le port du focus du panneau, à poser par `FocusBindingProvider` autour de la vue. */
export function useSheetFocus(focus: FocusStore, { rating, actions, entry }: SheetFocusInput): FocusBinder {
  const releases = useChoiceEntry(focus, sheetLockKeys(actions), entry);
  useGroupGuides(focus, { rating, actions, entered: releases > 0 });

  // Une identité neuve à chaque libération du verrou : les éléments relisent leur liaison.
  return useCallback(
    (key: string): FocusBinding | undefined => {
      const binding = focus.binder(key);
      return isSheetGuardedKey(key) ? { ...binding, phantomPressGuard: true } : binding;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [focus, releases],
  );
}

interface GuideState {
  rating: SheetRating | null | undefined;
  actions: readonly SheetPicto[];
  /** Le verrou d'entrée est levé : toutes les cibles sont focalisables. */
  entered: boolean;
}

/**
 * Les guides d'entrée des groupes, liés AVANT leur premier rendu (le port
 * l'exige) et une seule fois ; ce qui varie — la note posée, le premier
 * picto, le verrou levé — se lit au moment de viser. Un guide vise de
 * nouveau après chaque rendu : la levée du verrou redessine le panneau
 * (nouveau `bind`), et la croix devient alors une destination.
 */
function useGroupGuides(focus: FocusStore, state: GuideState): void {
  const latest = useRef(state);
  latest.current = state;
  useState(() => {
    focus.bind(SHEET_HEADER_GROUP, {
      container: createEntryGuide(focus, {
        owns: (key) => key === SHEET_CLOSE_KEY,
        fallback: () => sheetHeaderTarget(latest.current.entered),
        remember: SHEET_GUIDE_MEMORY.header,
      }),
    });
    focus.bind(SHEET_SCALE_GROUP, {
      container: createEntryGuide(focus, {
        owns: isScaleKey,
        fallback: () => sheetScaleTarget(latest.current.rating),
        remember: SHEET_GUIDE_MEMORY.scale,
      }),
    });
    focus.bind(SHEET_ACTIONS_GROUP, {
      container: createEntryGuide(focus, {
        owns: isActionKey,
        fallback: () => sheetActionsTarget(latest.current.actions),
        remember: SHEET_GUIDE_MEMORY.actions,
      }),
    });
    return true;
  });
  useEffect(
    () => () => {
      focus.bind(SHEET_HEADER_GROUP, null);
      focus.bind(SHEET_SCALE_GROUP, null);
      focus.bind(SHEET_ACTIONS_GROUP, null);
    },
    [focus],
  );
}
