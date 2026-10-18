import { memo, useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { introCameraPlan, introGeometry } from "@tentacle-tv/shared/brandIntro";
import { plateGates, sampleIntro, sampleIntroHold } from "@tentacle-tv/tv-core/boot";
import { partBoxes, type TentacleArt } from "./introArt";
import { IntroScreenPlane } from "./IntroScreenPlane";
import { IntroStageAbove, IntroStageBelow } from "./IntroStage";
import type { IntroClock } from "./introWorklets";

/**
 * L'encre du démarrage : le fond de l'écran de lancement de tvOS
 * (`LaunchScreen.storyboard`, sRGB .051 .043 .075) — la première image de
 * l'app, sur laquelle la lueur s'allume.
 */
export const BOOT_INK = "#0D0B13";

/** Tout ce que l'ouverture calcule une fois, pour une fenêtre et un logo. */
export function useIntroScene(art: TentacleArt, viewport: { width: number; height: number }) {
  return useMemo(() => {
    const geometry = introGeometry(art);
    const plan = introCameraPlan(viewport.width, viewport.height, geometry);
    const samples = sampleIntro(geometry, plan);
    return {
      geometry,
      plan,
      samples,
      hold: sampleIntroHold(geometry),
      boxes: partBoxes(geometry),
      gates: plateGates(samples, plan.from.zoom),
    };
  }, [art, viewport.width, viewport.height]);
}

export type IntroScene = ReturnType<typeof useIntroScene>;

export interface BootIntroViewProps {
  art: TentacleArt;
  scene: IntroScene;
  clock: IntroClock;
  viewport: { width: number; height: number };
  /** Arrivé (ou renoncé) : le décor se retire, l'écran reste l'app, à l'identité. */
  landed: boolean;
  /** Le rideau de l'encre (0 → 1) : le renoncement le monte, puis le baisse sur ce qui doit se voir. */
  curtain: SharedValue<number>;
  /** Le rideau n'existe que pendant le renoncement : une vue plein écran, même transparente, gênerait le focus. */
  curtainShown: boolean;
  screenColor: string;
  /** L'app : l'accueil se monte DANS l'écran du poulpe. */
  children: ReactNode;
}

/**
 * L'OUVERTURE du démarrage (Apple TV) : le poulpe s'assemble sur l'encre,
 * appuie sur lecture (« ta »), son écran s'allume (« dum ») — et cet écran
 * EST l'accueil, déjà prêt —, puis la caméra plonge jusqu'à l'échelle 1.
 * Une illustration d'état de démarrage, comme la mascotte qu'elle remplace :
 * la règle « aucun logo dans l'interface » le permet.
 *
 * Trois couches dans l'ordre du logo : ce qui est SOUS l'écran (nuit, bras
 * arrière, tête, cadre), l'écran (l'app elle-même), ce qui est SUR l'écran
 * (visage, bouton, chapeau, bras avant). Rien que des transformations et des
 * opacités, lues sur le fil d'interface.
 */
export const BootIntroView = memo(function BootIntroView({ art, scene, clock, viewport, landed, curtain, curtainShown, screenColor, children }: BootIntroViewProps) {
  const frame = useMemo(
    () => ({ center: { x: viewport.width / 2, y: viewport.height / 2 }, target: scene.geometry.target, zoom: scene.plan.from.zoom }),
    [viewport.width, viewport.height, scene],
  );
  const stage = { art, geometry: scene.geometry, boxes: scene.boxes, samples: scene.samples, hold: scene.hold, gates: scene.gates, frame, clock };
  const curtainStyle = useAnimatedStyle(() => ({ opacity: curtain.value }));
  return (
    <View style={styles.root}>
      {landed ? null : <View style={styles.night} />}
      {landed ? null : <IntroStageBelow {...stage} />}
      <IntroScreenPlane
        art={art}
        geometry={scene.geometry}
        boxes={scene.boxes}
        samples={scene.samples}
        clock={clock}
        viewport={viewport}
        finalZoom={scene.plan.to.zoom}
        screenColor={screenColor}
        landed={landed}
      >
        {children}
      </IntroScreenPlane>
      {landed ? null : <IntroStageAbove {...stage} />}
      {curtainShown ? <Animated.View style={[styles.curtain, curtainStyle]} pointerEvents="none" /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  night: { ...StyleSheet.absoluteFillObject, backgroundColor: BOOT_INK },
  curtain: { ...StyleSheet.absoluteFillObject, backgroundColor: BOOT_INK },
});
