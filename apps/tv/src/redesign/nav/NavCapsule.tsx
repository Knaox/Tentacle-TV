import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { GlassSurface } from "../glass/GlassSurface";
import { useNativeGlassBacking } from "../glass/glassBacking";
import { motionTo } from "../motion/motion";

/**
 * Les capsules de verre de la navigation et leur DÉPLIAGE (Apple TV) : la
 * capsule s'élargit vraiment — son bord droit, arrondi, avance sur le ressort
 * `unfold` pendant que le verre dense remplace le verre clair ; au repli, il
 * revient plus vite. Sans animer de largeur (ni de mise en page, que le moteur
 * de focus lit : elle reste celle de `navGeometry.ts`) : une fenêtre coupée
 * glisse, son contenu glisse en sens inverse — deux `translateX` —, et la
 * coupe n'existe que le temps du mouvement : au repos, aucun masque à
 * composer.
 */

const N = TV_STAGE.nav;

/**
 * L'ouverture de la barre, 0 → 1 : sur le ressort `unfold` à l'ouverture, plus
 * brève au repli. `moving` : vrai le temps du mouvement — la coupe des
 * capsules n'existe que pendant lui.
 */
export function useUnfold(expanded: boolean): { openness: SharedValue<number>; moving: boolean } {
  const reduced = useReducedMotion();
  const openness = useSharedValue(expanded ? 1 : 0);
  const [moving, setMoving] = useState(false);
  const generation = useRef(0);
  const settle = useCallback((gen: number) => {
    if (gen === generation.current) setMoving(false);
  }, []);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const gen = ++generation.current;
    setMoving(true);
    openness.value = motionTo(expanded ? 1 : 0, "unfold", reduced, (finished) => {
      "worklet";
      if (finished) runOnJS(settle)(gen);
    });
  }, [expanded, reduced, openness, settle]);
  return { openness, moving };
}

/** La largeur visible d'une capsule, pour une ouverture de 0 à 1. */
function revealedWidth(openness: number): number {
  "worklet";
  return N.collapsedWidth + (N.expandedWidth - N.collapsedWidth) * openness;
}

/**
 * Une capsule : le verre replié et le verre ouvert, en fondu l'un sur
 * l'autre — et, pendant le mouvement (`clip`), une fenêtre arrondie de la
 * largeur visible : la fenêtre (pleine largeur) glisse vers la gauche de ce
 * qui reste caché, son contenu glisse d'autant vers la droite — il ne bouge
 * pas à l'écran, seul le bord droit de la fenêtre avance.
 */
export function Capsule({ top, height, width, openness, clip, children }: {
  top: number;
  height: number;
  width: number;
  openness: SharedValue<number>;
  clip: boolean;
  children: ReactNode;
}) {
  const wide = useAnimatedStyle(() => ({ opacity: openness.value }));
  const narrow = useAnimatedStyle(() => ({ opacity: 1 - openness.value }));
  const windowShift = useAnimatedStyle(() => ({ transform: [{ translateX: revealedWidth(openness.value) - N.expandedWidth }] }));
  const contentShift = useAnimatedStyle(() => ({ transform: [{ translateX: N.expandedWidth - revealedWidth(openness.value) }] }));
  const openBacking = useNativeGlassBacking("strong");
  return (
    <View style={[styles.capsule, { top, height, width }]}>
      <Animated.View pointerEvents="box-none" style={[styles.window, { height }, clip && styles.clipped, windowShift]}>
        {/* Le contenu garde la largeur de la capsule (repliée ou ouverte) : la
            liste, son défilement et son indicateur se calent dessus, et rien
            ne déborde sur l'écran, sous le moteur de focus. */}
        <Animated.View pointerEvents="box-none" style={[styles.content, { width, height }, contentShift]}>
          <CapsuleBody height={height} narrow={narrow} wide={wide} openBacking={openBacking}>{children}</CapsuleBody>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function CapsuleBody({ height, narrow, wide, openBacking, children }: {
  height: number;
  narrow: ReturnType<typeof useAnimatedStyle>;
  wide: ReturnType<typeof useAnimatedStyle>;
  openBacking: ReturnType<typeof useNativeGlassBacking>;
  children: ReactNode;
}) {
  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, narrow]}>
        <GlassSurface radius={N.radius} style={[styles.glass, { width: N.collapsedWidth, height }]} elevated />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, wide]}>
        {/* Ouverte, la barre passe SUR le texte de l'écran : le verre
            dessiné ne floute rien, un fond dense garde les libellés
            lisibles. Le verre natif floute : il prend le fond commun. */}
        <View style={[styles.glass, styles.openBase, openBacking, { width: N.expandedWidth, height }]} />
        <GlassSurface radius={N.radius} tone="strong" style={[styles.glass, { width: N.expandedWidth, height }]} elevated />
      </Animated.View>
      {children}
    </>
  );
}

const styles = StyleSheet.create({
  capsule: { position: "absolute", left: N.left },
  // La fenêtre du dépliage, pleine largeur ; coupée pendant le mouvement.
  window: { position: "absolute", left: 0, top: 0, width: N.expandedWidth },
  clipped: { overflow: "hidden", borderRadius: N.radius },
  content: { position: "absolute", left: 0, top: 0 },
  glass: { position: "absolute", left: 0, top: 0 },
  openBase: { borderRadius: N.radius, backgroundColor: "rgba(10, 10, 14, 0.84)" },
});
