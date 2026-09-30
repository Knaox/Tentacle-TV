import type { FocusStore } from "./focusStore";

/** Une restauration de tvOS arrive dans ce délai ; au-delà, c'est l'utilisateur. */
const RESTORE_WITHIN_MS = 900;

/**
 * Réclamer le focus pour `key`, et le réclamer DE NOUVEAU si tvOS le rend
 * ailleurs dans la foulée. Menu sur une page POUSSÉE dépile l'écran puis la
 * pile le réempile (`usePreventRemove`) : UIKit restaure alors sa dernière
 * cible APRÈS la réclamation — mesuré au simulateur, le focus retombait sur
 * la case où l'entrée annulée se trouvait, pas sur elle. Une seule reprise,
 * et seulement dans `RESTORE_WITHIN_MS` : un geste de l'utilisateur, plus
 * tard, n'est jamais contrarié.
 */
export function claimAfterRestore(focus: FocusStore, key: string): void {
  focus.claim(key);
  const until = Date.now() + RESTORE_WITHIN_MS;
  let unsubscribe: (() => void) | null = null;
  const stop = () => {
    unsubscribe?.();
    unsubscribe = null;
  };
  unsubscribe = focus.subscribe((focusedKey, focused) => {
    if (!focused || focusedKey === key) return;
    stop();
    if (Date.now() <= until) focus.claim(key);
  });
  setTimeout(stop, RESTORE_WITHIN_MS);
}
