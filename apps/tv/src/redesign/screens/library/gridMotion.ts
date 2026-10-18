import { GRID_PREVIEW_SETTLE_MS, GRID_SLOW_SPEED, gridFocusOutrun, gridPreviewSettleDelay, gridScrollSpeed, type GridScrollSample } from "@tentacle-tv/tv-core";

/**
 * Le MOUVEMENT d'une grille, pour l'aperçu au focus : son défilement
 * (`onScroll` de la liste) et ses focus. En défilement accéléré, tvOS ne
 * prévient l'app que d'un focus de temps en temps : c'est le défilement qui
 * dit que la grille bouge (tv-core `gridPreviewSettleDelay`,
 * `gridFocusOutrun`).
 *
 * - `onSettled` : la grille vient de se poser — la préparation des aperçus
 *   part alors, jamais pendant le mouvement ;
 * - `onSlowed` : la page RALENTIT au bout d'un défilement rapide (sous
 *   `GRID_SLOW_SPEED`, une fois par mouvement) — la colonne tenue s'y rend
 *   sans attendre l'immobilité (tv-core `gridColumnHold`) ;
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
  /** Rappelé quand la page ralentit au bout d'un défilement rapide. Rend l'arrêt. */
  onSlowed(listener: () => void): () => void;
  /** Le défilement de la page, au dernier relevé. */
  position(): number;
  /** Suit la page depuis maintenant (un focus) : `onOutrun` à chaque bascule. Rend l'arrêt. */
  watchFocus(lineStride: number, onOutrun: (outrun: boolean) => void): () => void;
  dispose(): void;
}

export function createGridMotion(now: () => number = Date.now): GridMotion {
  let lastMove: number | null = null;
  let y = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const settledListeners = new Set<() => void>();
  const slowedListeners = new Set<() => void>();
  const scrollListeners = new Set<() => void>();
  // Le dernier relevé, et l'état du ralenti : la page a filé depuis le dernier, il n'est pas encore dit.
  let sample: GridScrollSample | null = null;
  let fast = false;

  const check = () => {
    timer = null;
    const delay = gridPreviewSettleDelay(lastMove, now());
    if (delay > 0) {
      timer = setTimeout(check, delay);
      return;
    }
    sample = null;
    fast = false;
    settledListeners.forEach((listener) => listener());
  };
  const moved = () => {
    lastMove = now();
    if (timer === null) timer = setTimeout(check, GRID_PREVIEW_SETTLE_MS);
  };

  return {
    scrolled(next) {
      y = next;
      const at = now();
      const speed = gridScrollSpeed(sample, { y: next, at });
      if (speed !== null) {
        sample = { y: next, at };
        if (speed >= GRID_SLOW_SPEED) fast = true;
        else if (fast) {
          fast = false;
          slowedListeners.forEach((listener) => listener());
        }
      } else if (sample === null) sample = { y: next, at };
      moved();
      scrollListeners.forEach((listener) => listener());
    },
    focused: moved,
    onSettled(listener) {
      settledListeners.add(listener);
      return () => settledListeners.delete(listener);
    },
    onSlowed(listener) {
      slowedListeners.add(listener);
      return () => slowedListeners.delete(listener);
    },
    position: () => y,
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
      slowedListeners.clear();
      scrollListeners.clear();
    },
  };
}
