/**
 * Octave mobile — la sélection d'UNE liste de titres (règles partagées : `@tentacle-tv/shared/octave` › selection) :
 * un seul magasin pour toute l'app, une liste à la fois. « Sélectionner » (ou « Modifier ») l'ouvre vide ; un toucher
 * coche ou décoche ; « Terminé » la ferme. La liste qui se démonte emporte sa sélection ; un titre qui la quitte
 * quitte la sélection.
 */

import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from "react";
import { EMPTY_SELECTION, applyGesture, isSelecting, openSelection, orderedKeys, pruneSelection, selectAll as selectAllOf, type SelectionState } from "@tentacle-tv/shared/octave";

let current: SelectionState = EMPTY_SELECTION;
const listeners = new Set<() => void>();
function set(next: SelectionState): void {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => current;
const NONE: ReadonlySet<string> = new Set();

export interface TrackSelection {
  selecting: boolean;
  selected: ReadonlySet<string>;
  /** Les clés choisies, dans l'ordre de la liste. */
  chosen: string[];
  toggle: (key: string) => void;
  selectAll: () => void;
  start: () => void;
  clear: () => void;
}

export function useTrackSelection(order: readonly string[]): TrackSelection {
  const owner = useId();
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  const orderRef = useRef(order);
  useEffect(() => {
    orderRef.current = order;
    set(pruneSelection(current, owner, order));
  }, [order, owner]);
  useEffect(
    () => () => {
      if (current.owner === owner) set(EMPTY_SELECTION);
    },
    [owner],
  );
  const own = state.owner === owner;
  const selected = own ? state.keys : NONE;
  const toggle = useCallback((key: string) => set(applyGesture(current, owner, orderRef.current, key, "toggle")), [owner]);
  const selectAll = useCallback(() => set(selectAllOf(owner, orderRef.current, true)), [owner]);
  const start = useCallback(() => set(openSelection(owner)), [owner]);
  const clear = useCallback(() => {
    if (current.owner === owner) set(EMPTY_SELECTION);
  }, [owner]);
  return { selecting: isSelecting(state, owner), selected, chosen: orderedKeys(order, selected), toggle, selectAll, start, clear };
}

/** La place que prend la barre de sélection au bas d'une liste (la liste se rallonge d'autant : rien n'est caché). */
export const SELECTION_BAR_ROOM = 132;

/**
 * La barre se pose 8 pt au-dessus du chrome du bas : `bottomInset` vaut onglets + mini-lecteur + 24 (la coquille,
 * `OctaveShell`), la page couvre l'écran entier dessous.
 */
export function selectionBarBottom(bottomInset: number): number {
  return Math.max(12, bottomInset - 16);
}
