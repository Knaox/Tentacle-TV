/**
 * Octave — l'affichage d'une liste révisée (recherche d'extension, contrat v2) :
 * l'ordre est GELÉ tant que le pointeur ou le focus est dans la liste
 * (`settleOrder`), et un changement d'ordre se joue en GLISSEMENT (FLIP :
 * `transform` seul, 200 ms, rien en mouvement réduit) — jamais une rangée qui
 * saute sous le curseur.
 */

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type RefObject } from "react";
import { settleOrder } from "./stableOrder";

const SLIDE_MS = 200;

export interface RevisedRows<T> {
  items: T[];
  /** À poser sur le conteneur de la liste. */
  holdProps: {
    onPointerEnter: () => void;
    onPointerLeave: () => void;
    onFocus: () => void;
    onBlur: (e: FocusEvent<HTMLElement>) => void;
  };
}

export function useRevisedRows<T extends { key: string }>(next: readonly T[]): RevisedRows<T> {
  const [pointer, setPointer] = useState(false);
  const [focus, setFocus] = useState(false);
  const [shown, setShown] = useState<T[]>([]);
  const items = useMemo(() => settleOrder(shown, next, pointer || focus), [shown, next, pointer, focus]);
  // Ce qui est affiché devient la base de la révision suivante (état dérivé, posé pendant le rendu).
  if (items.length !== shown.length || items.some((item, i) => item !== shown[i])) setShown(items);
  const onBlur = useCallback((e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false);
  }, []);
  return {
    items,
    holdProps: {
      onPointerEnter: useCallback(() => setPointer(true), []),
      onPointerLeave: useCallback(() => setPointer(false), []),
      onFocus: useCallback(() => setFocus(true), []),
      onBlur,
    },
  };
}

/** Les rangées (enfants directs de `[role=grid]`) glissent de leur ancienne place à la nouvelle. */
export function useRowSlide(container: RefObject<HTMLElement | null>, keys: readonly string[]): void {
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const grid = container.current?.querySelector<HTMLElement>("[role=grid]");
    if (!grid) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rows = Array.from(grid.children) as HTMLElement[];
    const now = new Map<string, number>();
    rows.forEach((row, i) => {
      const key = keys[i];
      if (!key) return;
      const top = row.getBoundingClientRect().top;
      now.set(key, top);
      const before = tops.current.get(key);
      if (reduce || before === undefined || Math.abs(before - top) < 1 || typeof row.animate !== "function") return;
      row.animate([{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }], { duration: SLIDE_MS, easing: "cubic-bezier(0.2, 0, 0, 1)" });
    });
    tops.current = now;
  }, [container, keys]);
}
