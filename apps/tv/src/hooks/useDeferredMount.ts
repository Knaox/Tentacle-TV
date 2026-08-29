import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

/**
 * Vrai une fois l'écran interactif — pour ce qui est cher à monter et que
 * personne n'attend.
 *
 * Le cas qui l'a motivé : le halo de bannière est un flou gaussien SVG
 * (`TVHeroAmbilightFilter`). Monté avec le reste, il ajoute une passe de
 * rastérisation logicielle pile dans l'instant où l'on veut voir la
 * bibliothèque arriver. Or il entre de toute façon en fondu sur 1,4 s : le
 * décaler d'un battement ne se voit pas, et rend cet instant-là au contenu.
 *
 * `runAfterInteractions` et non un délai : on ne devine pas une durée, on
 * attend que les animations et les gestes en cours aient rendu la main.
 */
export function useDeferredMount(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setMounted(true));
    return () => task.cancel();
  }, []);

  return mounted;
}
