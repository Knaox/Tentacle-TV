import { useCallback, useEffect, useRef } from "react";
import { GRID_COLUMN_HOLD_START, GRID_KEY_PREFIX, gridColumnHoldFocus, gridColumnHoldSettle, gridIndexOf, gridKey } from "@tentacle-tv/tv-core";
import type { FocusStore } from "./focusStore";

/**
 * HAUT et BAS gardent la COLONNE même au défilement accéléré (tv-core
 * `focus/gridColumnHold.ts`, GR-7 bis) : l'applicateur dit à la règle chaque
 * focus de l'écran, et, la grille posée (le rappel rendu, que la vue appelle :
 * `gridSettlePort`), réclame l'affiche qu'elle rend — dans la ligne où l'on
 * est. Ni durée ni seuil ici ; les mêmes gestes sur Android TV.
 */
export function useGridColumnHold(focus: FocusStore, count: number, columns: number, prefix: string = GRID_KEY_PREFIX): () => void {
  const live = useRef({ count, columns, prefix });
  live.current = { count, columns, prefix };
  const state = useRef(GRID_COLUMN_HOLD_START);
  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (!focused) return;
        const { count: total, columns: perLine, prefix: keys } = live.current;
        state.current = gridColumnHoldFocus(state.current, gridIndexOf(key, keys), perLine, total);
      }),
    [focus],
  );
  return useCallback(() => {
    const { count: total, columns: perLine, prefix: keys } = live.current;
    const step = gridColumnHoldSettle(state.current, perLine, total);
    state.current = step.state;
    if (step.correct === null) return;
    focus.claim(keys === GRID_KEY_PREFIX ? gridKey(step.correct) : `${keys}:${step.correct}`);
  }, [focus]);
}
