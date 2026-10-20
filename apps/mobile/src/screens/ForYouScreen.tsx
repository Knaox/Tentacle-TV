import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { RECO_SECTION_BAR_SPACE, RecoSectionBar } from "@/components/reco/section/RecoSectionBar";
import { useRecoSection } from "@/components/reco/section/useRecoSection";
import { RecoFeedView } from "@/screens/forYou/RecoFeedView";
import { SwipeScreen } from "@/screens/SwipeScreen";

/**
 * L'onglet Pour vous, en deux sections sous une même barre : « Pour vous »
 * (les propositions) et « Affiner » (la pile de swipe qui les corrige). Seule
 * la section choisie est montée — la page de recommandations ne tient aucun
 * rendu pendant qu'on juge, et la pile ne charge rien tant qu'on ne l'ouvre pas.
 * La barre, elle, reste posée par-dessus, fixée sous l'en-tête : changer de
 * section ne la démonte ni ne la déplace.
 */
export function ForYouScreen() {
  const { section, setSection } = useRecoSection();
  const openRefine = useCallback(() => setSection("refine"), [setSection]);

  return (
    <View style={styles.fill}>
      {section === "refine" ? (
        <SwipeScreen topInset={RECO_SECTION_BAR_SPACE} />
      ) : (
        <RecoFeedView topInset={RECO_SECTION_BAR_SPACE} onOpenRefine={openRefine} />
      )}
      <RecoSectionBar section={section} onChange={setSection} />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
