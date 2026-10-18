import { useCallback, useEffect, useRef } from "react";
import {
  GRID_COLUMN_HOLD_START,
  GRID_KEY_PREFIX,
  gridColumnHoldFocus,
  gridColumnHoldKey,
  gridColumnHoldRelease,
  gridIndexOf,
  gridKey,
  type GridColumnHoldStep,
} from "@tentacle-tv/tv-core";
import { useRemoteIntents } from "../../input";
import type { FocusStore } from "./focusStore";

/**
 * HAUT et BAS gardent la COLONNE même au défilement accéléré (tv-core
 * `focus/gridColumnHold.ts`, GR-7 bis) : l'applicateur dit à la règle chaque
 * focus de l'écran et chaque maintien de touche (l'entrée unique de la
 * télécommande), puis réclame l'affiche qu'elle rend — dans la ligne où l'on
 * est, une fois HAUT ou BAS lâché, ou la grille posée (le rappel rendu, que la
 * vue appelle : `gridSettlePort`). Les mêmes intentions sur Android TV.
 */
export function useGridColumnHold(focus: FocusStore, count: number, columns: number, prefix: string = GRID_KEY_PREFIX): () => void {
  const live = useRef({ count, columns });
  live.current = { count, columns };
  const state = useRef(GRID_COLUMN_HOLD_START);
  const keyOf = (index: number) => (prefix === GRID_KEY_PREFIX ? gridKey(index) : `${prefix}:${index}`);
  const apply = useRef<(step: GridColumnHoldStep) => void>(() => undefined);
  apply.current = (step) => {
    state.current = step.state;
    if (step.correct !== null) focus.claim(keyOf(step.correct));
  };
  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (!focused) return;
        apply.current(gridColumnHoldFocus(state.current, gridIndexOf(key, prefix), live.current.columns, live.current.count));
      }),
    [focus, prefix],
  );
  useRemoteIntents((event) => {
    const { intent } = event;
    if (intent.type !== "hold") return;
    apply.current(gridColumnHoldKey(state.current, intent.key, intent.phase, live.current.columns, live.current.count));
  });
  return useCallback(() => apply.current(gridColumnHoldRelease(state.current, live.current.columns, live.current.count)), []);
}
