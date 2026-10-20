import { memo, useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import {
  fitIntroArt,
  introCameraPlan,
  introGeometry,
  plateSwapAt,
  sampleIntro,
  sampleIntroHold,
  type IntroSafeInsets,
} from "@tentacle-tv/shared/brandIntro";
import { partBoxes, type TentacleArt } from "./introArt";
import { IntroPrimitivesProvider, type IntroPrimitives } from "./introPrimitives";
import { IntroScreenPlane } from "./IntroScreenPlane";
import { IntroStageAbove, IntroStageBelow } from "./IntroStage";
import type { IntroClock } from "./introWorklets";

/**
 * L'encre du démarrage : le fond des écrans de lancement (tvOS
 * `LaunchScreen.storyboard`, iOS `SplashScreen.storyboard`, sRGB .051 .043
 * .075 ; Android `boot_ink`) — la première image de l'app, sur laquelle la
 * lueur s'allume.
 */
export const BOOT_INK = "#0D0B13";

export interface IntroSceneOptions {
  /**
   * L'écran du poulpe prend le rapport de la fenêtre (mobile, iPad :
   * `fitIntroArt`). Faux : l'écran de télévision du logo (la TV).
   */
  fitScreen?: boolean;
  /** La zone sûre (encoche, Dynamic Island) : le logo de départ s'y centre. */
  safe?: IntroSafeInsets;
}

/** Tout ce que l'ouverture calcule une fois, pour une fenêtre et un logo. */
export function useIntroScene(source: TentacleArt, viewport: { width: number; height: number }, options: IntroSceneOptions = {}) {
  const { fitScreen = false, safe } = options;
  // Les bords, un à un : un objet neuf aux mêmes bords ne recalcule rien.
  const top = safe?.top ?? 0;
  const right = safe?.right ?? 0;
  const bottom = safe?.bottom ?? 0;
  const left = safe?.left ?? 0;
  return useMemo(() => {
    const art = fitScreen ? fitIntroArt(source, viewport.width / viewport.height) : source;
    const geometry = introGeometry(art);
    const plan = introCameraPlan(viewport.width, viewport.height, geometry, { top, right, bottom, left });
    const samples = sampleIntro(geometry, plan);
    return {
      art,
      geometry,
      plan,
      samples,
      hold: sampleIntroHold(geometry),
      boxes: partBoxes(geometry),
      swapAt: plateSwapAt(samples, plan.from.zoom),
    };
  }, [source, viewport.width, viewport.height, fitScreen, top, right, bottom, left]);
}

export type IntroScene = ReturnType<typeof useIntroScene>;

export interface BootIntroViewProps {
  scene: IntroScene;
  /** Le dégradé linéaire et la découpe arrondie de l'app qui la monte. */
  primitives: IntroPrimitives;
  clock: IntroClock;
  viewport: { width: number; height: number };
  /** Arrivé : le décor se retire, l'écran reste l'app, à l'identité. */
  landed: boolean;
  screenColor: string;
  /** L'app : l'accueil se monte DANS l'écran du poulpe. */
  children: ReactNode;
}

/**
 * L'OUVERTURE du démarrage (Apple TV, Android TV, mobile, iPad) : le poulpe s'assemble sur l'encre,
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
export const BootIntroView = memo(function BootIntroView({ scene, primitives, clock, viewport, landed, screenColor, children }: BootIntroViewProps) {
  const { art } = scene;
  const frame = useMemo(
    () => ({ center: { x: viewport.width / 2, y: viewport.height / 2 }, target: scene.geometry.target, zoom: scene.plan.from.zoom }),
    [viewport.width, viewport.height, scene],
  );
  const stage = { art, geometry: scene.geometry, boxes: scene.boxes, samples: scene.samples, hold: scene.hold, swapAt: scene.swapAt, frame, clock };
  return (
    <IntroPrimitivesProvider primitives={primitives}>
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
      </View>
    </IntroPrimitivesProvider>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  night: { ...StyleSheet.absoluteFillObject, backgroundColor: BOOT_INK },
});
