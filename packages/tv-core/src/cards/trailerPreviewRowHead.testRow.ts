import {
  INITIAL_ROW_HEAD,
  reduceRowHead,
  type RowHeadContext,
  type RowHeadEvent,
  type RowHeadOptions,
  type RowHeadState,
} from "./trailerPreviewRowHead";

/**
 * Le banc des tests de `trailerPreviewRowHead` : une rangée simulée sur la
 * scène de l'accueil, dont chaque défilement demandé est aussitôt atteint.
 */

// La scène de l'accueil : vignettes 380 (pas de 416), retrait 176, marge 96, grande carte 806.
export const SCENE = { cardWidth: 380, gap: 36, inset: 176, viewportWidth: 1920, rightMargin: 96 };
export const TILE = 806;
export const STOP: RowHeadOptions = { end: "stop", release: "stay" };
export const OVER: RowHeadOptions = { end: "overscroll", release: "stay" };

/** Une rangée simulée : chaque défilement demandé est aussitôt atteint. */
export function row(cardCount: number, options: RowHeadOptions, geometry: Partial<typeof SCENE> = {}) {
  let state: RowHeadState = INITIAL_ROW_HEAD;
  let scrollX = 0;
  const moves: number[] = [];
  const send = (event: RowHeadEvent) => {
    const context: RowHeadContext = { ...SCENE, ...geometry, cardCount, ...options, scrollX };
    const step = reduceRowHead(state, event, context);
    state = step.state;
    if (step.scrollTo !== null) {
      moves.push(step.scrollTo);
      scrollX = step.scrollTo;
    }
    return step.scrollTo;
  };
  return {
    send,
    get state() { return state; },
    get scrollX() { return scrollX; },
    set scrollX(x: number) { scrollX = x; },
    moves,
    /** Le focus sur la carte, puis son aperçu qui démarre. */
    preview(index: number, at = 0, tileWidth = TILE) {
      send({ type: "focus", index, at });
      return send({ type: "expand", index, tileWidth, at: at + 900 });
    },
    /** Où la carte se trouve à l'écran (son bord gauche). */
    screenLeft(index: number) {
      return (geometry.inset ?? SCENE.inset) + index * ((geometry.cardWidth ?? SCENE.cardWidth) + SCENE.gap) - scrollX;
    },
  };
}
