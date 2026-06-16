import { Platform, TVFocusGuideView } from "react-native";
import { useTVNav } from "../../context/TVNavContext";
import { RAIL_EXPANDED } from "./TVSideRail";

/**
 * Pont de SORTIE du rail (tvOS uniquement).
 *
 * Sur l'Accueil, les focusables du contenu (boutons du hero) sont SOUS le rail
 * déployé (256px) → en appuyant à droite depuis le rail, le focus engine tvOS ne
 * trouve aucune cible (occlusion + pas d'alignement vertical) et on reste piégé.
 *
 * Quand le focus est dans le rail (`railFocused`), on pose une zone de focus à
 * DROITE du rail déployé qui redirige vers le nœud d'entrée du contenu publié par
 * l'écran (`contentFocusNode`, ex. bouton Lecture). N'est actif que s'il y a un
 * nœud publié → les écrans qui sortent déjà bien (grilles) ne sont pas affectés.
 */
export function TVFocusBridgeRight() {
  const { railFocused, contentFocusNode } = useTVNav();

  if (Platform.OS !== "ios" || !railFocused || !contentFocusNode) return null;

  return (
    // @ts-ignore — props TVFocusGuideView (react-native-tvos)
    <TVFocusGuideView
      destinations={[contentFocusNode]}
      // À droite du rail déployé (ne chevauche pas les items → n'interfère pas
      // avec la nav interne haut/bas).
      style={{ position: "absolute", left: RAIL_EXPANDED, right: 0, top: 0, bottom: 0 }}
    />
  );
}
