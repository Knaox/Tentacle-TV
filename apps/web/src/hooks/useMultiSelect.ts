import { useState, useCallback, useMemo } from "react";

export function useMultiSelect() {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const enterSelectionMode = useCallback(() => {
    setIsSelecting(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelecting(false);
    setSelected(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  return useMemo(() => ({
    isSelecting,
    selected,
    count: selected.size,
    toggle,
    selectAll,
    clear,
    enterSelectionMode,
    exitSelectionMode,
    isSelected,
  }), [isSelecting, selected, toggle, selectAll, clear, enterSelectionMode, exitSelectionMode, isSelected]);
}
