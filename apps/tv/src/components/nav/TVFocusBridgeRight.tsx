import { Platform, TVFocusGuideView } from "react-native";
import { useTVNav } from "../../context/TVNavContext";
import { RAIL_COLLAPSED } from "./TVSideRail";

/**
 * Pont de SORTIE du rail (tvOS uniquement).
 *
 * Sur l'Accueil, en appuyant à droite depuis le rail, le focus engine tvOS ne
 * trouvait aucune cible (pas d'alignement vertical) et on restait piégé.
 *
 * Quand le focus est dans le rail (`railFocused`), on pose une zone de focus à
 * DROITE du rail déployé qui redirige vers le nœud d'entrée du contenu publié par
 * l'écran (`contentFocusNode`, ex. bouton Lecture). N'est actif que s'il y a un
 * nœud publié → les écrans qui sortent déjà bien (grilles) ne sont pas affectés.
 */
export function TVFocusBridgeRight() {
  const { railFocused, contentFocusNode, lastContentNodeRef } = useTVNav();

  // Sortie du rail : revenir sur le DERNIER élément de contenu focalisé (mémoire),
  // sinon sur le nœud d'entrée publié par l'écran.
  const target = lastContentNodeRef.current ?? contentFocusNode;
  if (Platform.OS !== "ios" || !railFocused || !target) return null;

  return (
    <TVFocusGuideView
      destinations={[target]}
      // À droite du rail — sa largeur réelle, désormais constante. Le panneau
      // qui apparaît derrière déborde plus loin, mais il ne capte rien : partir
      // de sa largeur laissait une bande de contenu hors d'atteinte.
      style={{ position: "absolute", left: RAIL_COLLAPSED, right: 0, top: 0, bottom: 0 }}
    />
  );
}
