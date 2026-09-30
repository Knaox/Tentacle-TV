import { useEffect, useReducer } from "react";
import { Platform, StyleSheet, TVFocusGuideView } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { navKeyOf } from "../nav/useRailState";
import type { RedesignScreenModel } from "./useRedesignScreen";

/**
 * Les ponts de focus entre la navigation et le contenu (tvOS).
 *
 * Le moteur de focus de tvOS ne déplace le focus que vers une cible ALIGNÉE
 * dans la direction du geste. Or les entrées de la navigation sont peu
 * nombreuses, en haut et en bas de la barre : depuis une carte à mi-hauteur,
 * GAUCHE ne trouvait rien, et depuis « Accueil », DROITE non plus. D'où deux
 * guides invisibles, jamais montés ensemble :
 *
 * - contenu focalisé : une bande à gauche du contenu, sur toute la hauteur,
 *   qui mène à l'entrée ACTIVE de la navigation (comme la barre latérale de
 *   l'app TV d'Apple) ;
 * - navigation focalisée : la zone à droite de la barre OUVERTE, qui rend le
 *   focus au dernier élément de contenu qui l'avait (sinon à l'entrée).
 *
 * Chacun n'existe que pendant que le focus est de l'autre côté : posé sur la
 * navigation elle-même, le premier capterait ses HAUT et BAS.
 */

const N = TV_STAGE.nav;

export function RailBridges({ screen }: { screen: RedesignScreenModel }) {
  const { focus, railFocused, railKey, contentKey } = screen;
  // Un guide vise un nœud : se redessiner quand l'entrée active arrive ou part.
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const watched = new Set([navKeyOf(railKey), navKeyOf("Home")]);
    refresh();
    return focus.subscribeNodes((key) => {
      if (watched.has(key)) refresh();
    });
  }, [focus, railKey]);

  if (Platform.OS !== "ios") return null;

  if (railFocused) {
    const key = contentKey();
    const target = key ? focus.node(key) : null;
    return target ? <TVFocusGuideView destinations={[target]} style={styles.exit} /> : null;
  }
  const entry = focus.node(navKeyOf(railKey)) ?? focus.node(navKeyOf("Home"));
  return entry ? <TVFocusGuideView destinations={[entry]} style={styles.enter} /> : null;
}

const styles = StyleSheet.create({
  // Jusqu'au bord du contenu (`contentLeft`), sur toute la hauteur.
  enter: { position: "absolute", left: 0, top: 0, bottom: 0, width: TV_STAGE.contentLeft - 20 },
  // Après les entrées de la barre ouverte : jamais par-dessus elles.
  exit: { position: "absolute", left: N.left + N.expandedWidth + 12, right: 0, top: 0, bottom: 0 },
});
