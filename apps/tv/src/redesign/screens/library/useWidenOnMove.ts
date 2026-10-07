import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { FlashList } from "@shopify/flash-list";
import { mountProfile } from "../../render/mountProfile";

/**
 * L'avance de la grille ÉLARGIE au premier pas hors de la première ligne
 * (mode Lite : `gridDrawDistance` à l'ouverture, `gridActiveDrawDistance`
 * dès qu'on la parcourt) : « Films » s'ouvre sur l'écran et une ligne à
 * peine, puis, quand le focus descend, la grille garde une ligne entière
 * d'avance — BAS tenu trouve toujours la suivante montée. Au niveau normal
 * (les deux distances égales), le gestionnaire du câblage, tel quel.
 * L'avance s'élargit PAR PAS (`gridWidenStep` par image, une demi-ligne) :
 * jamais deux lignes montées dans la même image.
 * L'index des cartes se lit par référence : une page de plus ne redessine
 * pas la grille.
 */
export function useWidenOnMove<T, C>(
  list: RefObject<FlashList<T> | null>,
  cards: readonly C[],
  columns: number,
  onFocusCard: ((card: C) => void) | undefined,
): ((card: C) => void) | undefined {
  const { gridDrawDistance, gridActiveDrawDistance, gridWidenStep } = mountProfile();
  const latest = useRef({ cards, columns, onFocusCard });
  latest.current = { cards, columns, onFocusCard };
  const frame = useRef<number | null>(null);
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);
  const widen = useCallback(
    (card: C) => {
      const { cards: current, columns: perLine, onFocusCard: forward } = latest.current;
      if (frame.current === null && current.indexOf(card) >= perLine) {
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
      }
      forward?.(card);
    },
    [list, gridActiveDrawDistance, gridWidenStep],
  );
  return gridActiveDrawDistance > gridDrawDistance ? widen : onFocusCard;
}
