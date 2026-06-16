import { useEffect, useRef } from "react";
import { TVFocusGuideView, Platform, View } from "react-native";
import { Colors } from "../../theme/colors";
import { RAIL_COLLAPSED } from "./TVSideRail";
import { TVFocusBridgeLeft } from "./TVFocusBridgeLeft";
import { TVFocusBridgeRight } from "./TVFocusBridgeRight";
import { useTVNav } from "../../context/TVNavContext";

/**
 * Cadre léger des pages top-level : réserve la marge gauche du rail replié.
 * Le rail lui-même est monté UNE SEULE FOIS par TVNavChrome (overlay au niveau
 * navigation).
 *
 * Sur Apple TV, le contenu est enveloppé dans un TVFocusGuideView `autoFocus` qui
 * est publié comme `contentFocusNode` : le pont droit (TVFocusBridgeRight) y
 * redirige le focus pour SORTIR du rail vers le contenu, de façon fiable sur TOUS
 * les écrans (sinon, ex. Préférences/À propos/Accueil, on reste piégé dans le rail
 * car les focusables sont sous le rail déployé / mal alignés). `autoFocus` fait
 * atterrir sur le dernier focusable utilisé (ou le premier). No-op sur Android.
 */
export function TVScreenFrame({ children }: { children: React.ReactNode }) {
  // Ref du TVFocusGuideView (type natif spécifique → `any`). On publie le nœud
  // comme contentFocusNode (View) pour le pont droit.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guideRef = useRef<any>(null);
  const { setContentFocusNode } = useTVNav();

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    setContentFocusNode(guideRef.current);
    return () => setContentFocusNode(null);
  }, [setContentFocusNode]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
      {/* @ts-ignore — TVFocusGuideView props (react-native-tvos) */}
      <TVFocusGuideView
        ref={guideRef}
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
