import { Platform, TVFocusGuideView } from "react-native";
import { useTVNav } from "../../context/TVNavContext";
import { RAIL_COLLAPSED } from "./TVSideRail";

/**
 * Pont de focus Apple TV (tvOS uniquement).
 *
 * Le rail latéral est un overlay sibling du navigateur (cf. TVNavChrome). Sur
 * tvOS, react-native-screens cloisonne le focus au view controller de l'écran
 * actif → la flèche GAUCHE depuis le contenu ne « voit » jamais le rail. On pose
 * donc une bande invisible sur le bord gauche du contenu (dans la marge réservée
 * par TVScreenFrame, derrière le rail) : un TVFocusGuideView qui REDIRIGE le
 * focus entrant vers l'item actif du rail (`railActiveNode`, publié par
 * TVSideRail dans TVNavContext).
 *
 * Android n'en a pas besoin (focus engine global) — le composant ne monte rien
 * hors tvOS : zéro impact sur Android TV.
 */
export function TVFocusBridgeLeft() {
  const { railActiveNode, railFocused } = useTVNav();

  // Désactivé quand le focus est déjà dans le rail : sinon cette bande (qui
  // chevauche les items) recapte chaque déplacement et le redirige vers l'item
  // actif → focus piégé (impossible de naviguer dans le rail ou d'en sortir).
  // Le pont ne sert QU'À entrer depuis le contenu.
  if (Platform.OS !== "ios" || !railActiveNode || railFocused) return null;

  return (
    // @ts-ignore — props TVFocusGuideView (react-native-tvos)
    <TVFocusGuideView
      destinations={[railActiveNode]}
      // Bande non nulle pleine hauteur, sinon iOS ignore le guide. Largeur =
      // marge du rail replié ; position absolue → n'affecte pas le layout.
      style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: RAIL_COLLAPSED }}
    />
  );
}
