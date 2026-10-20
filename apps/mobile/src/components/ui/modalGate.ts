/**
 * Le portier des modales : une seule à la fois, prouvée — pas devinée.
 *
 * `Modal` de React Native s'appuie sur un contrôleur présenté (UIKit) ou une
 * Dialog (Android). En présenter une seconde pendant que la première se
 * retire coince la pile : la nouvelle ne s'affiche jamais, l'ancienne reste
 * montée avec son voile plein écran à `opacity: 0` — invisible mais tactile,
 * et l'écran paraît figé.
 *
 * Le garde-fou d'avant reposait sur `InteractionManager.runAfterInteractions`
 * plus un délai fixe. Il ne tenait pas : une animation `useNativeDriver: true`
 * ne crée AUCUN handle d'interaction (`Animation.js` :
 * `__isInteraction = config.isInteraction ?? !useNativeDriver`), donc le
 * rappel partait au tick suivant, bien avant la fin du ressort de sortie.
 *
 * Ici, chaque modale se déclare tant qu'elle est montée, et une ouverture qui
 * doit suivre une fermeture ATTEND que le compte retombe à zéro.
 */

/** Le temps laissé au natif pour retirer la modale précédente, une fois démontée. */
export const SETTLE_MS = 60;

let openCount = 0;
let waiting: Array<() => void> = [];
/** Avant cet instant, le natif retire encore la dernière modale démontée. */
let quietAt = 0;

/**
 * À appeler quand une modale se monte ; le retour la libère (idempotent).
 * `exitMs` : une modale dont le natif ANIME la sortie (`animationType`
 * « slide ») dit combien de temps UIKit la retire encore après son démontage
 * — présenter une autre vue pendant cette sortie coince la pile de même.
 */
export function retainModal(exitMs: number = SETTLE_MS): () => void {
  openCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openCount = Math.max(0, openCount - 1);
    quietAt = Math.max(quietAt, Date.now() + exitMs);
    if (openCount === 0) drain();
  };
}

/**
 * Au-delà, une modale montée que le natif n'a jamais présentée (`onShow`
 * jamais reçu) ne compte plus : iOS refuse de présenter depuis un contrôleur
 * qui présente déjà autre chose (le lecteur), et une telle modale retenait
 * le portier pour toujours — toute feuille gardée attendait sans fin (boîte
 * des invitations, banc du 21/10).
 */
export const PRESENT_TIMEOUT_MS = 1500;

export interface PresentedModalHold {
  /** Le natif l'a présentée (`onShow` de la `Modal`). */
  shown(): void;
  release(): void;
}

/** Comme `retainModal`, mais libérée d'elle-même si `shown` n'arrive pas à temps. */
export function holdPresentedModal(exitMs: number = SETTLE_MS): PresentedModalHold {
  const release = retainModal(exitMs);
  let timer: ReturnType<typeof setTimeout> | null = setTimeout(release, PRESENT_TIMEOUT_MS);
  const stop = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    shown: stop,
    release: () => { stop(); release(); },
  };
}

function drain(): void {
  if (waiting.length === 0) return;
  const pending = waiting;
  waiting = [];
  setTimeout(() => {
    // Une modale montée entre-temps : on attend aussi SA fermeture.
    for (const run of pending) whenNoModal(run);
  }, Math.max(0, quietAt - Date.now()));
}

/** Exécute `run` dès qu'aucune modale n'est montée ni ne se retire — au tick suivant si c'est déjà le cas. */
export function whenNoModal(run: () => void): void {
  if (openCount > 0) {
    waiting.push(run);
    return;
  }
  setTimeout(() => {
    if (openCount > 0) waiting.push(run);
    else if (quietAt > Date.now()) whenNoModal(run);
    else run();
  }, Math.max(0, quietAt - Date.now()));
}

/** Y a-t-il une modale à l'écran ? (diagnostic, tests) */
export function modalsOpen(): number {
  return openCount;
}
