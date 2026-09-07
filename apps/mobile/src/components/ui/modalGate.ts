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
const SETTLE_MS = 60;

let openCount = 0;
let waiting: Array<() => void> = [];

/** À appeler quand une modale se monte ; le retour la libère (idempotent). */
export function retainModal(): () => void {
  openCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) drain();
  };
}

function drain(): void {
  if (waiting.length === 0) return;
  const pending = waiting;
  waiting = [];
  setTimeout(() => {
    for (const run of pending) run();
  }, SETTLE_MS);
}

/** Exécute `run` dès qu'aucune modale n'est montée — tout de suite si c'est déjà le cas. */
export function whenNoModal(run: () => void): void {
  if (openCount === 0) {
    setTimeout(run, 0);
    return;
  }
  waiting.push(run);
}

/** Y a-t-il une modale à l'écran ? (diagnostic, tests) */
export function modalsOpen(): number {
  return openCount;
}
