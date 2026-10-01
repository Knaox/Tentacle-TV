import { useEffect, useState } from "react";
import type { FocusStore } from "./focusStore";

/** Vrai tant que `focusKey` porte le focus natif — un état, pour ce qui doit se décider d'avance. */
export function useKeyFocused(focus: FocusStore, focusKey: string): boolean {
  const [focused, setFocused] = useState(() => focus.focusedKey() === focusKey);
  useEffect(() => {
    setFocused(focus.focusedKey() === focusKey);
    return focus.subscribe((key, isFocused) => {
      if (key === focusKey) setFocused(isFocused);
    });
  }, [focus, focusKey]);
  return focused;
}
