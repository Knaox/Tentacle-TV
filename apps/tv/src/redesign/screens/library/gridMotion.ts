import { GRID_PREVIEW_SETTLE_MS, gridFocusOutrun, gridPreviewSettleDelay } from "@tentacle-tv/tv-core";

/**
 * Le MOUVEMENT d'une grille, pour l'aperçu au focus : son défilement
 * (`onScroll` de la liste) et ses focus. En défilement accéléré, tvOS ne
 * prévient l'app que d'un focus de temps en temps : c'est le défilement qui
 * dit que la grille bouge (tv-core `gridPreviewSettleDelay`,
 * `gridFocusOutrun`).
 *
 * - `onSettled` : la grille vient de se poser — la préparation des aperçus
 *   part alors, jamais pendant le mouvement ;
 * - `watchFocus` : la carte focalisée suit la page depuis son focus, et
 *   apprend si la page l'a dépassée — son aperçu ne se demande pas.
 *
 * Hors du rendu : un évènement de défilement ne redessine rien ; seule une
 * bascule prévient ceux qui écoutent.
 */
export interface GridMotion {
  /** La page a défilé jusqu'à `y`. */
  scrolled(y: number): void;
  /** Un focus est arrivé. */
  focused(): void;
  /** Rappelé chaque fois que la grille se pose. Rend l'arrêt. */
  onSettled(listener: () => void): () => void;
  /** Suit la page depuis maintenant (un focus) : `onOutrun` à chaque bascule. Rend l'arrêt. */
  watchFocus(lineStride: number, onOutrun: (outrun: boolean) => void): () => void;
  dispose(): void;
}

export function createGridMotion(now: () => number = Date.now): GridMotion {
  let lastMove: number | null = null;
  let y = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const settledListeners = new Set<() => void>();
  const scrollListeners = new Set<() => void>();

  const check = () => {
    timer = null;
    const delay = gridPreviewSettleDelay(lastMove, now());
    if (delay > 0) {
      timer = setTimeout(check, delay);
      return;
    }
    settledListeners.forEach((listener) => listener());
  };
  const moved = () => {
    lastMove = now();
    if (timer === null) timer = setTimeout(check, GRID_PREVIEW_SETTLE_MS);
  };

  return {
    scrolled(next) {
      y = next;
      moved();
      scrollListeners.forEach((listener) => listener());
    },
    focused: moved,
    onSettled(listener) {
      settledListeners.add(listener);
      return () => settledListeners.delete(listener);
    },
    watchFocus(lineStride, onOutrun) {
      let from = y;
      let outrun = false;
      const listener = () => {
        const next = gridFocusOutrun(from, y, lineStride);
        if (next === outrun) return;
        outrun = next;
        onOutrun(next);
      };
      // La grille posée, son focus est le vrai : un focus reçu pendant la fin
      // d'un défilement accéléré (la page file encore vers lui) ne reste pas
      // « dépassé » — sans quoi son aperçu ne viendrait jamais.
      const rebase = () => {
        from = y;
        if (!outrun) return;
        outrun = false;
        onOutrun(false);
      };
      scrollListeners.add(listener);
      settledListeners.add(rebase);
      return () => {
        scrollListeners.delete(listener);
        settledListeners.delete(rebase);
      };
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      settledListeners.clear();
      scrollListeners.clear();
    },
  };
}
