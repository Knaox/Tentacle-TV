/**
 * Octave — la sélection d'UNE liste (selectionRules.ts) : un seul magasin pour tout Octave, une liste à la fois.
 * La liste qui se démonte (on change de page) emporte sa sélection ; un titre qui quitte la liste quitte la
 * sélection. En sélection : Échap en sort, Cmd/Ctrl-A choisit toute la liste (hors champ de saisie et hors boîte
 * de dialogue ouverte, qui gardent leurs touches).
 */

import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from "react";
import { EMPTY_SELECTION, applyGesture, isSelecting, openSelection, pruneSelection, selectAll as selectAllOf, type SelectGesture, type SelectionState } from "@tentacle-tv/shared/octave";

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

/** Pour les tests. */
export function resetSelectionForTests(): void {
  set(EMPTY_SELECTION);
}

const NONE: ReadonlySet<string> = new Set();

export interface ListSelection {
  owner: string;
  selected: ReadonlySet<string>;
  selecting: boolean;
  select: (key: string, gesture: SelectGesture) => void;
  selectAll: () => void;
  /** « Sélectionner » : la sélection s'ouvre, vide (les cases paraissent, un clic coche). */
  start: () => void;
  clear: () => void;
}

function typingOrDialog(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return true;
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

export function useListSelection(order: readonly string[]): ListSelection {
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
  const selecting = isSelecting(state, owner);
  const select = useCallback((key: string, gesture: SelectGesture) => set(applyGesture(current, owner, orderRef.current, key, gesture)), [owner]);
  const selectAll = useCallback(() => set(selectAllOf(owner, orderRef.current, current.owner === owner && current.open === true)), [owner]);
  const start = useCallback(() => set(openSelection(owner)), [owner]);
  const clear = useCallback(() => {
    if (current.owner === owner) set(EMPTY_SELECTION);
  }, [owner]);

  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (typingOrDialog(e.target)) return;
      if (e.key === "Escape") {
        clear();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [clear, selectAll, selecting]);

  return { owner, selected: own ? state.keys : NONE, selecting, select, selectAll, start, clear };
}
