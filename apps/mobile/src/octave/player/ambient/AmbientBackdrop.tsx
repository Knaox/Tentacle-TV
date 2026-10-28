/**
 * Octave (mobile) — le FOND VIVANT du lecteur plein écran : les couleurs de la pochette en grands calques
 * floutés qui dérivent lentement (`ambientMotion`), une touche du dégradé de la marque, puis le voile d'encre
 * qui garde le texte lisible. Au changement de titre, la nouvelle disposition arrive en FONDU CROISÉ.
 *
 * Coût : la vignette est floutée une fois au décodage ; à chaque image, seules des transformations changent,
 * sur le fil d'interface (Reanimated). L'horloge s'ARRÊTE (et le fond se fige où il est) dès que le lecteur
 * se referme, que l'app passe en arrière-plan ou que l'écran se verrouille, en pause, et sous mouvement réduit.
 */

import { memo, useEffect, useMemo, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation, Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { withAlpha } from "@/theme";
import { usePlayerSelector } from "../OctavePlayerContext";
import { useArtworkUri } from "../PlayerArtwork";
import { useOctaveColors } from "../../theme/octaveColors";
import { useAppActive } from "./useAppActive";
import {
  AMBIENT_BLUR, AMBIENT_BRAND_TINT, AMBIENT_CROSSFADE_MS, AMBIENT_CYCLE_S, ambientArtworkUrl, ambientLayers, ambientSeed,
  ambientShouldRun, layerSide, layerTransform, type AmbientLayer,
} from "./ambientMotion";

const LINEAR = Easing.linear;

/** L'horloge du fond (secondes, bouclée sur le cycle) : elle avance seulement quand `running`. */
function useAmbientClock(running: boolean): SharedValue<number> {
  const clock = useSharedValue(0);
  useEffect(() => {
    if (!running) {
      // Figé où il est : la reprise repart de là, sans saut.
      cancelAnimation(clock);
      return;
    }
    const left = Math.max(0, AMBIENT_CYCLE_S - clock.value);
    clock.value = withSequence(
      withTiming(AMBIENT_CYCLE_S, { duration: left * 1000, easing: LINEAR }),
      withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(AMBIENT_CYCLE_S, { duration: AMBIENT_CYCLE_S * 1000, easing: LINEAR })), -1, false),
    );
    return () => cancelAnimation(clock);
  }, [running, clock]);
  return clock;
}

export const AmbientBackdrop = memo(function AmbientBackdrop({ open }: { open: boolean }) {
  const colors = useOctaveColors();
  const reduceMotion = useReducedMotion();
  const appActive = useAppActive();
  const playing = usePlayerSelector((s) => s.wantsPlay);
  const url = usePlayerSelector((s) => s.current?.artworkUrl ?? null);
  const uri = useArtworkUri(ambientArtworkUrl(url));
  const clock = useAmbientClock(ambientShouldRun({ open, appActive, playing, reduceMotion }));
  const fade = AMBIENT_CROSSFADE_MS;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink }]} pointerEvents="none">
      {/* La clé change avec la pochette : l'ancienne disposition s'efface pendant que la nouvelle arrive. */}
      <Animated.View key={uri ?? "none"} style={StyleSheet.absoluteFill} entering={FadeIn.duration(fade)} exiting={FadeOut.duration(fade)}>
        <AmbientLayers uri={uri} clock={clock} />
      </Animated.View>
      <LinearGradient
        colors={[withAlpha(colors.ink, 0.28, colors.ink), withAlpha(colors.ink, 0.55, colors.ink), withAlpha(colors.ink, 0.9, colors.ink)]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

const AmbientLayers = memo(function AmbientLayers({ uri, clock }: { uri: string | null; clock: SharedValue<number> }) {
  const colors = useOctaveColors();
  const layers = useMemo(() => ambientLayers(ambientSeed(uri)), [uri]);
  return (
    <>
      {layers.map((layer, i) => (
        <DriftingLayer key={i} layer={layer} clock={clock}>
          {uri === null ? (
            // Sans pochette : les couleurs de la marque, à la même place.
            <LinearGradient colors={i % 2 === 0 ? [colors.gradient[0], colors.gradient[1]] : [colors.gradient[1], colors.gradient[2]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          ) : (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={AMBIENT_BLUR} transition={400} cachePolicy="memory-disk" recyclingKey={`ambient:${uri}`} accessibilityIgnoresInvertColors />
          )}
        </DriftingLayer>
      ))}
      <DriftingLayer layer={AMBIENT_BRAND_TINT} clock={clock}>
        <LinearGradient colors={[colors.gradient[0], withAlpha(colors.gradient[1], 0, colors.ink), colors.gradient[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </DriftingLayer>
    </>
  );
});

const DriftingLayer = memo(function DriftingLayer({ layer, clock, children }: { layer: AmbientLayer; clock: SharedValue<number>; children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const side = layerSide(width, height, layer);
  const style = useAnimatedStyle(() => {
    const t = layerTransform(layer, clock.value, width, height);
    return {
      transform: [
        { translateX: t.translateX },
        { translateY: t.translateY },
        { rotate: `${t.rotateDeg}deg` },
        { scale: t.scale },
        { scaleX: layer.mirrored ? -1 : 1 },
      ],
    };
  }, [layer, width, height]);
  return (
    <Animated.View
      style={[styles.layer, { width: side, height: side, left: (width - side) / 2, top: (height - side) / 2, opacity: layer.opacity }, style]}
    >
      {children}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  layer: { position: "absolute" },
});
