import { useCallback, useEffect, useState } from "react";
import { pruneSelection, selectionState, toggleAllSelection, toggleSelection, type SelectionState } from "@tentacle-tv/offline-core";

export interface OfflineSelection {
  active: boolean;
  selection: ReadonlySet<number>;
  count: number;
  state: SelectionState;
  toggle: (fileId: number) => void;
  toggleAll: () => void;
  enter: () => void;
  exit: () => void;
}

/**
 * Le mode sélection de l'écran de gestion, sur la logique pure du cœur : la
 * sélection s'élague toute seule quand la liste change sous les doigts (un
 * transfert qui finit, une purge), et « tout sélectionner » complète une
 * sélection partielle au lieu de la vider. `presentIds` doit être mémorisé.
 */
export function useOfflineSelection(presentIds: readonly number[]): OfflineSelection {
  const [active, setActive] = useState(false);
  const [selection, setSelection] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    setSelection((prev) => {
      const next = pruneSelection(prev, presentIds);
      return next.size === prev.size ? prev : next;
    });
  }, [presentIds]);

  const toggle = useCallback((fileId: number) => setSelection((prev) => toggleSelection(prev, fileId)), []);
  const toggleAll = useCallback(() => setSelection((prev) => toggleAllSelection(prev, presentIds)), [presentIds]);
  const enter = useCallback(() => setActive(true), []);
  const exit = useCallback(() => {
    setActive(false);
    setSelection(new Set());
  }, []);

  return { active, selection, count: selection.size, state: selectionState(selection, presentIds), toggle, toggleAll, enter, exit };
}
