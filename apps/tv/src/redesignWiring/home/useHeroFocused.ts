import { useEffect, useRef, useState } from "react";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";

/** La clé de la bannière (`heroModel`). */
const HERO_KEY = /^hero:/;

/**
 * La bannière a le focus — tenu PAR CLÉ : une prise peut arriver avant la perte
 * d'une autre, et une perte tardive ne doit pas dire la bannière quittée (la
 * rotation repartirait sous les yeux).
 */
export function useHeroFocused(focus: FocusStore): boolean {
  const holders = useRef(new Set<string>());
  const [focused, setFocused] = useState(() => HERO_KEY.test(focus.focusedKey() ?? ""));
  useEffect(
    () =>
      focus.subscribe((key, isFocused) => {
        if (!HERO_KEY.test(key)) return;
        if (isFocused) holders.current.add(key);
        else holders.current.delete(key);
        setFocused(holders.current.size > 0);
      }),
    [focus],
  );
  return focused;
}
