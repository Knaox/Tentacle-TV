import { TVFocusGuideView, Platform, View } from "react-native";
import { Colors } from "../../theme/colors";
import { RAIL_COLLAPSED } from "./TVSideRail";
import { TVFocusBridgeLeft } from "./TVFocusBridgeLeft";
import { TVFocusBridgeRight } from "./TVFocusBridgeRight";

/**
 * Cadre léger des pages top-level : réserve la marge gauche du rail replié.
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
        autoFocus={Platform.OS === "ios"}
        style={{ flex: 1, paddingLeft: RAIL_COLLAPSED }}
      >
        {children}
      </TVFocusGuideView>
      {/* Ponts de focus tvOS : LEFT contenu → rail, RIGHT rail → contenu (no-op Android). */}
      <TVFocusBridgeLeft />
      <TVFocusBridgeRight />
    </View>
  );
}
