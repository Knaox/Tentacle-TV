import { RESTORE_WITHIN_MS, restoreStep, watchRestore } from "@tentacle-tv/tv-core";
import type { FocusStore } from "./focusStore";

/**
 * Réclamer le focus pour `key`, et le réclamer DE NOUVEAU si tvOS le rend
 * ailleurs dans la foulée — la règle de tv-core (`focus/restoreClaim.ts`) :
 * Menu sur une page POUSSÉE dépile l'écran puis la pile le réempile, et UIKit
 * restaure sa dernière cible APRÈS la réclamation. Une seule reprise, et
 * seulement dans `RESTORE_WITHIN_MS` : un geste de l'utilisateur, plus tard,
 * n'est jamais contrarié.
 */
export function claimAfterRestore(focus: FocusStore, key: string): void {
  focus.claim(key);
  const watch = watchRestore(key, Date.now());
  let unsubscribe: (() => void) | null = null;
  const stop = () => {
    unsubscribe?.();
    unsubscribe = null;
  };
  unsubscribe = focus.subscribe((focusedKey, focused) => {
    const step = restoreStep(watch, focusedKey, focused, Date.now());
    if (step === "ignore") return;
    stop();
    if (step === "reclaim") focus.claim(key);
  });
  setTimeout(stop, RESTORE_WITHIN_MS);
}
