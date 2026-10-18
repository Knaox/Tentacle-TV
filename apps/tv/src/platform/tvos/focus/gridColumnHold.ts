import { useCallback, useEffect, useRef } from "react";
import {
  GRID_COLUMN_HOLD_START,
  GRID_KEY_PREFIX,
  directionOf,
  gridColumnHoldFocus,
  gridColumnHoldMove,
  gridColumnHoldSettle,
  gridIndexOf,
  gridKey,
  type GridLineRange,
} from "@tentacle-tv/tv-core";
import { useRemoteIntents } from "../../input";
import type { FocusStore } from "./focusStore";

/**
 * HAUT et BAS gardent la COLONNE même au défilement accéléré (tv-core
 * `focus/gridColumnHold.ts`, GR-7 bis) : l'applicateur dit à la règle chaque
 * focus de l'écran, et, la grille posée ou ralentie (le rappel rendu, que la
 * vue appelle : `gridSettlePort`, avec les lignes à l'écran au ralenti),
 * réclame l'affiche qu'elle rend — dans la ligne où l'on est. Les pas GAUCHE / DROITE de l'entrée unique lui disent un passage voulu
 * par les filtres. Ni durée ni seuil ici (l'heure du focus seulement) ; les
 * mêmes gestes sur Android TV.
 */
export function useGridColumnHold(focus: FocusStore, count: number, columns: number, prefix: string = GRID_KEY_PREFIX): (visible?: GridLineRange) => void {
  const live = useRef({ count, columns, prefix });
  live.current = { count, columns, prefix };
  const state = useRef(GRID_COLUMN_HOLD_START);
  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (!focused) return;
        const { count: total, columns: perLine, prefix: keys } = live.current;
        state.current = gridColumnHoldFocus(state.current, gridIndexOf(key, keys), perLine, total, Date.now());
      }),
    [focus],
  );
  useRemoteIntents((event) => {
    const direction = directionOf(event.intent);
    if (direction) state.current = gridColumnHoldMove(state.current, direction);
  });
  return useCallback((visible?: GridLineRange) => {
    const { count: total, columns: perLine, prefix: keys } = live.current;
    const step = gridColumnHoldSettle(state.current, perLine, total, visible);
    state.current = step.state;
    if (step.correct === null) return;
    focus.claim(keys === GRID_KEY_PREFIX ? gridKey(step.correct) : `${keys}:${step.correct}`);
  }, [focus]);
}
