import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import { useBootIntroLanded } from "@tentacle-tv/brand-intro-native";

/**
 * Vrai une fois l'écran interactif — pour ce qui est cher à monter et que
 * personne n'attend. Copie de `apps/tv/src/hooks/useDeferredMount.ts` (les
 * clients natifs ne partagent pas encore de package de hooks).
 *
 * Le cas qui l'a motivé : le halo de bannière est un flou gaussien SVG
 * (`HeroAmbilightFilter`). Monté avec le reste, il ajoute une passe de
 * rastérisation logicielle pile dans l'instant où l'on veut voir l'accueil
 * arriver. Or il entre de toute façon en fondu sur 1,4 s : le décaler d'un
 * battement ne se voit pas, et rend cet instant-là au contenu.
 *
 * `runAfterInteractions` et non un délai : on ne devine pas une durée, on
 * attend que les animations et les gestes en cours aient rendu la main.
 *
 * Et APRÈS l'ouverture du démarrage (`useBootIntroLanded`) : l'accueil y est
 * monté dans l'écran du poulpe, et le premier dessin du flou — CoreImage sur
 * le fil principal, 350 à 400 ms au simulateur (Time Profiler, 20/10) —
 * tombait au départ de l'animation : 20 à 23 images perdues. Les animations
 * Reanimated ne passent pas par `InteractionManager` : l'ouverture se dit
 * elle-même.
 */
export function useDeferredMount(): boolean {
  const [mounted, setMounted] = useState(false);
  const introLanded = useBootIntroLanded();

  useEffect(() => {
    if (!introLanded) return undefined;
    const task = InteractionManager.runAfterInteractions(() => setMounted(true));
    return () => task.cancel();
  }, [introLanded]);

  return mounted;
}
