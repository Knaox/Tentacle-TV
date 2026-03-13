import { useState, useCallback } from "react";

export function useMultiSelect<T extends string>() {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: T[]) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
    setActive(false);
  }, []);

  const enter = useCallback(() => setActive(true), []);

  return { active, selected, count: selected.size, toggle, selectAll, clear, enter };
}
