import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeletableEntry } from "@tentacle-tv/api-client";
import {
  EMPTY_DELETION_SELECTION,
  pruneSelection,
  rangeInSelection,
  selectAllInSelection,
  toggleInSelection,
  type DeletionSelectionState,
} from "@tentacle-tv/shared";

/**
 * Le mode sélection d'une grille (bibliothèque, recherche) — l'état React autour
 * de la règle pure (`shared` › `libraryDelete/deletionSelection.ts`).
 *
 * `universe` : TOUS les titres que « tout sélectionner » couvre, dans l'ordre
 * affiché (la bibliothèque filtrée entière, pas la page chargée) ; `entries` : le
 * verdict de Jellyfin pour chacun (`CanDelete`). Un titre sans verdict n'est pas
 * cochable. Échap quitte (sauf quand un dialogue est ouvert : `paused`).
 */

/** Ce qu'une carte montre dans son coin en mode sélection. */
export type SelectMark = "selected" | "unselected" | "locked" | "pending";

/** Ce qui se supprime : un film, une série, une saison, un épisode — jamais une collection. */
export const DELETABLE_TYPES: ReadonlySet<string> = new Set(["Movie", "Series", "Season", "Episode"]);

export interface DeletionSelection {
  active: boolean;
  enter: () => void;
  exit: () => void;
  markOf: (id: string) => SelectMark;
  /** `range` : Maj + clic. */
  toggle: (id: string, range: boolean) => void;
  selectAll: () => void;
  clear: () => void;
  /** Les titres cochés, dans l'ordre affiché. */
  selected: DeletableEntry[];
  /** Ce que « tout sélectionner » cocherait. */
  selectableCount: number;
  universeCount: number;
  /** Le verdict de Jellyfin est arrivé pour l'ensemble. */
  ready: boolean;
}

interface Options {
  /** Le mode est-il ouvert ? Tenu par l'appelant : le relevé des titres en dépend. */
  active: boolean;
  setActive: (active: boolean) => void;
  universe: readonly string[];
  entries: ReadonlyMap<string, DeletableEntry> | undefined;
  paused: boolean;
}

export function useDeletionSelection({ active, setActive, universe, entries, paused }: Options): DeletionSelection {
  const [state, setState] = useState<DeletionSelectionState>(EMPTY_DELETION_SELECTION);

  const selectable = useCallback(
    (id: string) => {
      const entry = entries?.get(id);
      return entry !== undefined && entry.canDelete && DELETABLE_TYPES.has(entry.type);
    },
    [entries],
  );

  // Un filtre change, un titre part : la sélection ne garde que ce qui est encore là et cochable.
  const present = useMemo(() => new Set(universe), [universe]);
  useEffect(() => {
    setState((prev) => pruneSelection(prev, present, selectable));
  }, [present, selectable]);

  const exit = useCallback(() => {
    setActive(false);
    setState(EMPTY_DELETION_SELECTION);
  }, [setActive]);
  const enter = useCallback(() => setActive(true), [setActive]);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || pausedRef.current || e.defaultPrevented) return;
      exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, exit]);

  const universeRef = useRef(universe);
  universeRef.current = universe;
  const toggle = useCallback((id: string, range: boolean) => {
    setState((prev) => (range ? rangeInSelection(prev, id, universeRef.current, selectable) : toggleInSelection(prev, id, selectable)));
  }, [selectable]);
  const selectAll = useCallback(() => setState(selectAllInSelection(universeRef.current, selectable)), [selectable]);
  const clear = useCallback(() => setState(EMPTY_DELETION_SELECTION), []);

  const markOf = useCallback(
    (id: string): SelectMark => {
      if (state.selected.has(id)) return "selected";
      const entry = entries?.get(id);
      if (entry === undefined) return "pending";
      return selectable(id) ? "unselected" : "locked";
    },
    [state.selected, entries, selectable],
  );

  const selected = useMemo(
    () => universe.filter((id) => state.selected.has(id)).map((id) => entries?.get(id)).filter((e): e is DeletableEntry => e !== undefined),
    [universe, state.selected, entries],
  );
  const selectableCount = useMemo(() => universe.filter(selectable).length, [universe, selectable]);

  return {
    active, enter, exit, markOf, toggle, selectAll, clear, selected,
    selectableCount, universeCount: universe.length, ready: entries !== undefined,
  };
}
