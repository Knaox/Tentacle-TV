import { TVFocusGuideView, View } from "react-native";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { Colors } from "../../theme/colors";
import { RAIL_COLLAPSED } from "./TVSideRail";
import { TVFocusBridgeLeft } from "./TVFocusBridgeLeft";
import { TVFocusBridgeRight } from "./TVFocusBridgeRight";

/**
 * Cadre léger des pages top-level : réserve la marge gauche du rail replié et
 * le retrait d'overscan sur les trois autres bords (54 pt haut/bas, 96 pt à
 * droite — la LG le pose sur `#root`, ici c'est l'équivalent). Les écrans ne
 * doivent plus improviser leurs propres marges de bord.
 * Le rail lui-même est monté UNE SEULE FOIS par TVNavChrome (overlay au niveau
 * navigation).
 *
 * `contentFocusNode` (cible du pont droit et de la saisie de focus après
 * navigation) est publié par CHAQUE écran via `useTVContentEntry` sur son 1er
 * Focusable réel — un `setNativeProps` hasTVPreferredFocus n'a d'effet que sur
 * un Pressable, pas sur ce guide.
 *
 * # Pourquoi la marge est DEHORS et le guide DEDANS
 *
 * Le guide portait les retraits : sa boîte partait donc de l'abscisse zéro et
 * recouvrait le rail. Inoffensif tant qu'il n'était pas un vrai guide de focus,
 * piégeant sitôt `autoFocus` posé.
 *
 * Un `TVFocusGuideView` dont aucun enfant n'a le focus **se substitue à eux**
 * dans la recherche native : il s'ajoute lui-même à la liste des candidats et
 * masque toute sa descendance (`ReactViewGroup.addFocusables`). Depuis une
 * entrée du rail, DROITE cherchait donc une cible et n'en trouvait aucune — le
 * seul candidat restant étant un guide qui COMMENCE à gauche de la source, ce
 * que `FocusFinder` refuse pour un déplacement vers la droite. On ne sortait
 * plus du menu dans les bibliothèques.
 *
 * La marge vit donc sur une vue ordinaire, et le guide occupe exactement la
 * zone de contenu. Il redevient une cible légitime à la droite du rail, et sa
 * substitution joue alors en notre faveur : DROITE atteint le guide, qui rend
 * le focus là où on l'avait laissé. C'est la géométrie que l'accueil avait déjà
 * avec son propre guide intérieur — et la raison pour laquelle lui seul n'a
 * jamais souffert du défaut.
 *
 * `autoFocus` vaut pour les DEUX téléviseurs : côté Android il débloque en plus
 * la récupération de focus native, qui exige un guide ancêtre (`recoverFocus`)
 * — sans quoi le D-pad devient muet dès que la vue focalisée se démonte.
 */
export function TVScreenFrame({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
      <View
        style={{
          flex: 1,
          paddingLeft: RAIL_COLLAPSED,
          paddingRight: TV_OVERSCAN_PT.x,
          paddingTop: TV_OVERSCAN_PT.y,
          paddingBottom: TV_OVERSCAN_PT.y,
        }}
      >
        <TVFocusGuideView autoFocus style={{ flex: 1 }}>
          {children}
        </TVFocusGuideView>
      </View>
      {/* Ponts de focus tvOS : LEFT contenu → rail, RIGHT rail → contenu (no-op Android). */}
      <TVFocusBridgeLeft />
      <TVFocusBridgeRight />
    </View>
  );
}
