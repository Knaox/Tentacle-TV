import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BOOT_SOUND_MOBILE_BRIDGE_MARGIN_MS, type IntroFrameReport } from "@tentacle-tv/shared/brandIntro";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { SplashScreen } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BootIntroView, bootIntroGate, useBootIntroRun, useIntroScene, type IntroWallTrace } from "@tentacle-tv/brand-intro-native";
// Le dessin du logo : ses constantes GÉNÉRÉES (brand/generate-svg.py), passées à la vue.
import * as TENTACLE_ART from "@/components/tentacleArt.generated";
import { MOBILE_INTRO_PRIMITIVES } from "./introPrimitives";
import { MOBILE_BOOT_SELF_REPORTING } from "./bootIntroRules";
import { BOOT_INTRO_STUCK_MS, recordBootIntroFrames, recordStuckBootIntro } from "./bootIntroFrames";
import { busyStartupOverlays } from "@/startup/startupOverlays";
import { markBoot } from "./bootTimeline";

export interface BootIntroHostProps {
  /** Le « ta-dum » l'accompagne (réglage « Son au démarrage »). */
  sound: boolean;
  /** Le fond de l'écran du poulpe autour de l'app (la surface du thème). */
  screenColor: string;
  children: ReactNode;
}

/**
 * L'OUVERTURE du démarrage sur le mobile (iPhone, iPad, Android) : la même que
 * la TV (`useBootIntroRun`), le logo INTACT (jamais étiré : mise à l'échelle
 * uniforme), une fenêtre allumée aux proportions de la fenêtre dans sa vitre
 * (portrait, paysage, iPad) et le logo de départ centré dans la zone
 * sûre (encoche, Dynamic Island, barre d'accueil). L'app (`children`) est
 * montée DANS cet écran dès le premier rendu et n'en change jamais d'arbre.
 * Fenêtre et zone sûre sont figées au montage : à l'arrivée, l'app suit la
 * fenêtre (un iPad qu'on tourne) sans rien remonter.
 */
export function BootIntroHost({ sound, screenColor, children }: BootIntroHostProps) {
  const [viewport] = useState(() => Dimensions.get("window"));
  markBoot("intro:host");
  const insets = useSafeAreaInsets();
  const [safe] = useState(() => ({ top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left }));
  const scene = useIntroScene(TENTACLE_ART, viewport, { deviceWindow: true, safe });
  const [soundWanted] = useState(() => Promise.resolve(sound));
  const onFrameReport = useCallback(
    (report: IntroFrameReport, trace: IntroWallTrace) => recordBootIntroFrames(report, trace, viewport),
    [viewport],
  );
  // Le son se demande assez tôt pour traverser le fil JavaScript du démarrage (Android), une fois préparé.
  const { clock, landed } = useBootIntroRun({
    soundWanted,
    selfReporting: MOBILE_BOOT_SELF_REPORTING,
    onFrameReport,
    waitForApp: true,
    // Android : l'accueil et les plaques se dessinent pendant l'encre, pas à l'allumage (iOS : déjà fluide).
    prewarmOnInk: Platform.OS === "android",
    soundBridgeMarginMs: BOOT_SOUND_MOBILE_BRIDGE_MARGIN_MS,
    waitForSound: true,
  });

  // Jamais arrivée au bout de 12 s : l'état est relevé pour le banc (rien ne part sinon).
  useEffect(() => {
    if (landed) return undefined;
    const timer = setTimeout(() => {
      const snapshot = {
        gate: bootIntroGate.snapshot(),
        clockState: clock.state.value,
        scene: Math.round(clock.scene.value),
        ready: clock.ready.value,
        appReady: clock.appReady.value,
        startupOverlays: busyStartupOverlays(),
      };
      recordStuckBootIntro(snapshot, clock.wallTrace.value, viewport);
    }, BOOT_INTRO_STUCK_MS);
    return () => clearTimeout(timer);
  }, [landed, clock, viewport]);

  // La première image de l'ouverture est l'encre de l'écran de lancement : on retire celui-ci dessous.
  const hideSplash = () => {
    SplashScreen.hideAsync().catch(() => {});
  };

  return (
    <View style={styles.root} onLayout={hideSplash}>
      {/* Sur l'encre, la barre d'état claire ; l'app reprend la sienne à l'arrivée. */}
      {landed ? null : <StatusBar style="light" />}
      <BootIntroView
        scene={scene}
        primitives={MOBILE_INTRO_PRIMITIVES}
        clock={clock}
        viewport={viewport}
        landed={landed}
        screenColor={screenColor}
      >
        {children}
      </BootIntroView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
