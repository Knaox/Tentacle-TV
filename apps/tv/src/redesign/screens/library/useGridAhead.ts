import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { FlashList } from "@shopify/flash-list";
import { mountProfile } from "../../render/mountProfile";

/**
 * L'avance de la grille ÉLARGIE après l'ouverture (mode Lite :
 * `gridDrawDistance` à l'ouverture, `gridActiveDrawDistance` ensuite) :
 * « Films » s'ouvre sur l'écran seul, puis, la page posée
 * (`gridWidenDelayMs`) ou au premier pas hors de la première ligne, la
 * grille prend une ligne entière d'avance — BAS tenu trouve toujours la
 * suivante montée. Au niveau normal
 * (les deux distances égales), le gestionnaire du câblage, tel quel.
 * L'avance s'élargit PAR PAS (`gridWidenStep` par image, une demi-ligne) :
 * jamais deux lignes montées dans la même image.
 * L'index des cartes se lit par référence : une page de plus ne redessine
 * pas la grille.
 */
export function useGridAhead<T, C>(
  list: RefObject<FlashList<T> | null>,
  cards: readonly C[],
  columns: number,
  onFocusCard: ((card: C) => void) | undefined,
): ((card: C) => void) | undefined {
  const { gridDrawDistance, gridActiveDrawDistance, gridWidenStep, gridWidenDelayMs } = mountProfile();
  const latest = useRef({ cards, columns, onFocusCard });
  latest.current = { cards, columns, onFocusCard };
  const frame = useRef<number | null>(null);
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);
  const active = gridActiveDrawDistance > gridDrawDistance;
  // L'élargissement, par pas, une fois (relancé seulement s'il n'a pas atteint sa cible).
  const start = useCallback(() => {
    if (frame.current !== null) return;
    const step = () => {
      frame.current = null;
      // `updateRenderAheadOffset` : l'avance de RecyclerListView, sous FlashList (1.x).
      const recycler = list.current?.recyclerlistview_unsafe;
      if (!recycler) return;
      const ahead = recycler.getCurrentRenderAheadOffset();
      if (ahead >= gridActiveDrawDistance) return;
      recycler.updateRenderAheadOffset(Math.min(gridActiveDrawDistance, ahead + gridWidenStep));
      frame.current = requestAnimationFrame(step);
    };
    step();
  }, [list, gridActiveDrawDistance, gridWidenStep]);
  // La page posée (ses titres arrivés, l'ouverture passée) : l'avance s'élargit
  // d'elle-même, avant que le pouce ne descende.
  const loaded = cards.length > 0;
  useEffect(() => {
    if (!active || !loaded) return undefined;
    const timer = setTimeout(start, gridWidenDelayMs);
    return () => clearTimeout(timer);
  }, [active, loaded, start, gridWidenDelayMs]);
  const widen = useCallback(
    (card: C) => {
      const { cards: current, columns: perLine, onFocusCard: forward } = latest.current;
      if (current.indexOf(card) >= perLine) start();
      forward?.(card);
    },
    [start],
  );
  return active ? widen : onFocusCard;
}
