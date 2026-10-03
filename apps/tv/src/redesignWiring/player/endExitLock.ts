import { useEffect, useState } from "react";
import { exitLocked } from "@tentacle-tv/tv-core";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";

/**
 * La croix d'un écran du lecteur n'est jamais son entrée : tant que l'entrée
 * (`entryKey`) n'a pas eu le focus depuis que l'écran est paru, elle reste
 * infocalisable — la règle de toutes les croix (`platform/tvos/back/backFocus`), ici dans
 * le lecteur. Mesuré au banc (scène câblée) : l'app revenue au premier plan
 * sur l'affiche de fin, tvOS posait le focus sur la croix, la cible la plus en
 * haut à gauche.
 */
export function useExitLocked(store: FocusStore, shown: boolean, entryKey: string): boolean {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!shown) setEntered(false);
  }, [shown]);
  useEffect(
    () =>
      store.subscribe((key, focused) => {
        if (focused && key === entryKey) setEntered(true);
      }),
    [store, entryKey],
  );
  return exitLocked(shown, entered);
}

/** La croix de l'affiche de fin (`end:leave`) : son entrée est « Lire maintenant » (`end:play`). */
export function useEndExitLocked(store: FocusStore, endShown: boolean): boolean {
  return useExitLocked(store, endShown, "end:play");
}

/** Ce que le port pose sur la croix verrouillée : l'applicateur tvOS. */
export { END_EXIT_LOCK } from "../../platform/tvos/player";
