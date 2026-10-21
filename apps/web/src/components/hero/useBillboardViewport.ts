import { useCallback } from "react";

import { useInViewport } from "../../hooks/useInViewport";

/**
 * Les deux seuils d'une bannière (accueil, « Pour vous », accueil hors ligne),
 * sur le même cadre — la règle est dans `billboardActivity` :
 *  - `near` : à 200 px de l'écran, le halo flouté est monté d'avance ;
 *  - `onScreen` : strictement à l'écran, la rotation tourne.
 * Les deux disent faux quand la fenêtre passe en arrière-plan.
 */
export function useBillboardViewport<T extends HTMLElement>() {
  const near = useInViewport<T>("200px");
  const onScreen = useInViewport<T>("0px");
  const { ref: nearRef } = near;
  const { ref: onScreenRef } = onScreen;
  const ref = useCallback(
    (el: T | null) => {
      nearRef(el);
      onScreenRef(el);
    },
    [nearRef, onScreenRef],
  );
  return { ref, near: near.visible, onScreen: onScreen.visible };
}
