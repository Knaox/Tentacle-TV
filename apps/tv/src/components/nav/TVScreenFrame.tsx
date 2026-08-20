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
 * Sur Apple TV, le contenu est enveloppé dans un TVFocusGuideView `autoFocus`
 * (aimant de focus pour l'entrée depuis le rail). `contentFocusNode` (cible du
 * pont droit + de l'auto-collapse) est désormais publié par CHAQUE écran via
 * `useTVContentEntry` sur son 1er Focusable réel — un `setNativeProps`
 * hasTVPreferredFocus n'a d'effet que sur un Pressable, pas sur ce guide.
 */
export function TVScreenFrame({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
      <TVFocusGuideView
        autoFocus
        style={{
          flex: 1,
          paddingLeft: RAIL_COLLAPSED,
          paddingRight: TV_OVERSCAN_PT.x,
          paddingTop: TV_OVERSCAN_PT.y,
          paddingBottom: TV_OVERSCAN_PT.y,
        }}
      >
        {children}
      </TVFocusGuideView>
      {/* Ponts de focus tvOS : LEFT contenu → rail, RIGHT rail → contenu (no-op Android). */}
      <TVFocusBridgeLeft />
      <TVFocusBridgeRight />
    </View>
  );
}
