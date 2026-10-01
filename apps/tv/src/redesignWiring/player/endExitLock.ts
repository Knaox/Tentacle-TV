import { useEffect, useState } from "react";
import type { FocusExtras, FocusStore } from "../focus/focusStore";

/**
 * La croix de l'affiche de fin (`end:leave`) n'est jamais l'entrée : tant que
 * « Lire maintenant » (`end:play`) n'a pas eu le focus depuis que l'affiche
 * est parue, elle reste infocalisable — la règle de toutes les croix
 * (`focus/backFocus`), ici dans le lecteur. Mesuré au banc (scène câblée) :
 * l'app revenue au premier plan sur l'affiche, tvOS posait le focus sur la
 * croix, la cible la plus en haut à gauche.
 */
export function useEndExitLocked(store: FocusStore, endShown: boolean): boolean {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!endShown) setEntered(false);
  }, [endShown]);
  useEffect(
    () =>
      store.subscribe((key, focused) => {
        if (focused && key === "end:play") setEntered(true);
      }),
    [store],
  );
  return endShown && !entered;
}

/** Ce que le port pose sur la croix verrouillée (sur tvOS, `isTVSelectable` décide). */
export const END_EXIT_LOCK: FocusExtras = { native: { isTVSelectable: false } };
