import { Platform, TVFocusGuideView } from "react-native";
import { borneDroiteEntreesDeployees } from "@tentacle-tv/tv-core";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { useTVNav } from "../../context/TVNavContext";

/** Le pont n'est monté que le rail focus, donc déployé : sa bande commence
 *  après les ENTRÉES déployées (396), pas après le rail replié (186) — sinon
 *  elle chevauche les entrées et capte des HAUT/BAS de navigation interne. */
const BORD_GAUCHE_PONT = borneDroiteEntreesDeployees(TV_OVERSCAN_PT.x);

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
      // À droite des entrées DÉPLOYÉES : le pont ne vit que rail focus, où
      // les entrées s'étendent jusqu'à 396 pt. Posé plus à gauche (largeur
      // repliée), il chevauchait les entrées et le moteur de focus pouvait le
      // préférer à l'entrée suivante sur un simple HAUT/BAS dans le rail.
      style={{ position: "absolute", left: BORD_GAUCHE_PONT, right: 0, top: 0, bottom: 0 }}
    />
  );
}
