import { useCallback, useMemo } from "react";
import { RecoSectionSwitch } from "@/components/reco/section/RecoSectionSwitch";
import { useRecoSection } from "@/components/reco/section/useRecoSection";
import { RecoFeedView } from "@/screens/forYou/RecoFeedView";
import { SwipeScreen } from "@/screens/SwipeScreen";

/**
 * L'onglet Pour vous, en deux sections sous un même segment : « Pour vous »
 * (les propositions) et « Affiner » (la pile de swipe qui les corrige). Seule
 * la section choisie est montée — la page de recommandations ne tient aucun
 * rendu pendant qu'on juge, et la pile ne charge rien tant qu'on ne l'ouvre pas.
 */
export function ForYouScreen() {
  const { section, setSection } = useRecoSection();
  const openRefine = useCallback(() => setSection("refine"), [setSection]);
  const sectionSwitch = useMemo(
    () => <RecoSectionSwitch section={section} onChange={setSection} />,
    [section, setSection],
  );

  return section === "refine" ? (
    <SwipeScreen sectionSwitch={sectionSwitch} />
  ) : (
    <RecoFeedView sectionSwitch={sectionSwitch} onOpenRefine={openRefine} />
  );
}
