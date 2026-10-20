import { useState, type ReactNode } from "react";
import { Dimensions } from "react-native";
import { BootIntroView, useBootIntroRun, useIntroScene } from "@tentacle-tv/brand-intro-native";
// Le dessin du logo : ses constantes GÉNÉRÉES (brand/generate-svg.py), passées à la vue.
import * as TENTACLE_ART from "../../components/icons/tentacleArt.generated";
import { readBootSoundSetting } from "../../lib/bootSoundSetting";
import { Colors } from "../../theme/colors";
import { TV_INTRO_PRIMITIVES } from "./introPrimitives";

/**
 * L'OUVERTURE du démarrage, branchée (Apple TV, Android TV) : l'app
 * (`children`) se monte DANS l'écran du poulpe dès qu'elle est prête ; le
 * déroulé (attente du premier écran, ta-dum à l'heure de l'image, plongée) est
 * celui du paquet partagé (`useBootIntroRun`), le même que sur le mobile. La
 * décision de la jouer — une fois par processus — est prise avant (`bootPlan`).
 */
export function BootIntroHost({ children }: { children: ReactNode }) {
  const [viewport] = useState(() => Dimensions.get("window"));
  const scene = useIntroScene(TENTACLE_ART, viewport);
  // Le réglage « Son au démarrage », relu après le préchargement du stockage (Android TV).
  const [soundWanted] = useState(readBootSoundSetting);
  const { clock, landed } = useBootIntroRun({ soundWanted });

  return (
    <BootIntroView scene={scene} primitives={TV_INTRO_PRIMITIVES} clock={clock} viewport={viewport} landed={landed} screenColor={Colors.bgDeep}>
      {children}
    </BootIntroView>
  );
}
