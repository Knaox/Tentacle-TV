import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { FlashList } from "@shopify/flash-list";
import { createStagingPacer, LINE_STAGING, nextLineCount } from "@tentacle-tv/tv-core";
import { mountProfile } from "../../render/mountProfile";

/**
 * Combien de ses `total` lignes la grille rend : toutes, sauf quand le profil
 * de montage étale le premier montage (`gridStaging`, mode Lite) — la
 * première ligne d'emblée, puis une ligne de plus par image à l'heure (tv-core
 * `nextLineCount`, `createStagingPacer`) : « Films » ne monte plus ses trois
 * écrans d'affiches dans la même image. Une fois la grille montée entière,
 * elle suit ses données sans plus rien retenir. `done` : l'étalement est fini
 * (la page suivante du catalogue n'est demandée qu'ensuite — une grille à
 * moitié montée paraîtrait finir trop tôt).
 */
export function useStagedLines(total: number, staged: boolean): { shown: number; done: boolean } {
  const [shown, setShown] = useState(staged ? LINE_STAGING.initial : Number.POSITIVE_INFINITY);
  const finished = useRef(!staged);
  // Un seul rythme pour tout l'étalement : une image en retard fait attendre la ligne suivante.
  const pacer = useRef(createStagingPacer());
  const done = finished.current || (total > 0 && shown >= total);
  if (done) finished.current = true;
  useEffect(() => {
    if (done || total === 0) return undefined;
    let frame = requestAnimationFrame(function pump(now) {
      if (pacer.current.frame(now)) {
        setShown((current) => nextLineCount(current, total));
        return;
      }
      frame = requestAnimationFrame(pump);
    });
    return () => cancelAnimationFrame(frame);
  }, [done, total, shown]);
  return { shown: done ? total : shown, done };
}

/**
 * L'avance de la grille ÉLARGIE au premier pas hors de la première ligne
 * (mode Lite : `gridDrawDistance` à l'ouverture, `gridActiveDrawDistance`
 * dès qu'on la parcourt) : « Films » s'ouvre sur l'écran et une ligne à
 * peine, puis, quand le focus descend, la grille garde une ligne entière
 * d'avance — BAS tenu trouve toujours la suivante montée. Au niveau normal
 * (les deux distances égales), le gestionnaire du câblage, tel quel.
 * L'index des cartes se lit par référence : une page de plus ne redessine
 * pas la grille.
 */
export function useWidenOnMove<T, C>(
  list: RefObject<FlashList<T> | null>,
  cards: readonly C[],
  columns: number,
  onFocusCard: ((card: C) => void) | undefined,
): ((card: C) => void) | undefined {
  const { gridDrawDistance, gridActiveDrawDistance } = mountProfile();
  const latest = useRef({ cards, columns, onFocusCard });
  latest.current = { cards, columns, onFocusCard };
  const widen = useCallback(
    (card: C) => {
      const { cards: current, columns: perLine, onFocusCard: forward } = latest.current;
      if (current.indexOf(card) >= perLine) {
        const recycler = list.current?.recyclerlistview_unsafe;
        // `updateRenderAheadOffset` : l'avance de RecyclerListView, sous FlashList (1.x).
        if (recycler && recycler.getCurrentRenderAheadOffset() < gridActiveDrawDistance) recycler.updateRenderAheadOffset(gridActiveDrawDistance);
      }
      forward?.(card);
    },
    [list, gridActiveDrawDistance],
  );
  return gridActiveDrawDistance > gridDrawDistance ? widen : onFocusCard;
}
