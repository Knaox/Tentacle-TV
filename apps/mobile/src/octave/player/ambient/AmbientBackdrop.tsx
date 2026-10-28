/**
 * Octave (mobile) — le FOND VIVANT du lecteur plein écran : les couleurs de la pochette en grands calques
 * floutés qui dérivent lentement (`ambientMotion`), une touche du dégradé de la marque, des taches de couleur
 * tirées chacune d'une région de la pochette qui battent au tempo du titre (`AmbientBlobs`, `ambientBeat`), puis
 * le voile d'encre qui garde le texte lisible. Au changement de titre, la nouvelle disposition arrive en FONDU CROISÉ, par-dessus
 * l'ancienne restée pleine, une fois sa vignette décodée (jamais un passage par le noir).
 *
 * Coût : la vignette est floutée une fois au décodage ; à chaque image, seules des transformations changent,
 * sur le fil d'interface (Reanimated). L'horloge s'ARRÊTE (et le fond se fige où il est) dès que le lecteur
 * se referme, que l'app passe en arrière-plan ou que l'écran se verrouille, en pause, et sous mouvement réduit.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation, Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { withAlpha } from "@/theme";
import { usePlayerSelector } from "../OctavePlayerContext";
import { useArtworkUri } from "../PlayerArtwork";
import { useOctaveColors } from "../../theme/octaveColors";
import { useAppActive } from "./useAppActive";
import { AmbientBlobs } from "./AmbientBlobLayer";
import { BLOB_ARTWORK_SIZE } from "./ambientBlobs";
import { trackTempo } from "./ambientBeat";
import { useBeatClock, type BeatClock } from "./useBeatClock";
import {
  AMBIENT_BLUR, AMBIENT_BRAND_TINT, AMBIENT_CROSSFADE_MS, AMBIENT_CYCLE_S, AMBIENT_SCENE_DELAY_MS, ambientArtworkUrl,
  ambientLayers, ambientSeed, ambientShouldRun, layerSide, layerTransform, type AmbientLayer,
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

interface Scene {
  id: number;
  uri: string | null;
  /** La vignette des taches (plus petite) : du même titre que `uri`. */
  blobUri: string | null;
}

/** Au plus tant de dispositions montées à la fois (des « Suivant » en rafale) : les plus anciennes partent. */
const MAX_SCENES = 3;
/** Une image qui ne répond pas ne retient pas le fondu au-delà (ms). */
const LOAD_TIMEOUT_MS = 1500;

export const AmbientBackdrop = memo(function AmbientBackdrop({ open }: { open: boolean }) {
  const colors = useOctaveColors();
  const reduceMotion = useReducedMotion();
  const appActive = useAppActive();
  const playing = usePlayerSelector((s) => s.wantsPlay);
  const url = usePlayerSelector((s) => s.current?.artworkUrl ?? null);
  const uri = useArtworkUri(ambientArtworkUrl(url));
  const blobUri = useArtworkUri(ambientArtworkUrl(url, BLOB_ARTWORK_SIZE));
  const running = ambientShouldRun({ open, appActive, playing, reduceMotion });
  const clock = useAmbientClock(running);
  // Le battement : la position de lecture, au tempo du titre (`ambientBeat` dit pourquoi pas le son).
  const beat = useBeatClock(running);
  const bpm = trackTempo(usePlayerSelector((s) => s.current?.key ?? null));
  // Les dispositions empilées : la nouvelle arrive PAR-DESSUS l'ancienne, qui reste pleine dessous jusqu'à
  // ce que la nouvelle soit entière — jamais un passage par le noir.
  const [scenes, setScenes] = useState<Scene[]>(() => [{ id: 0, uri, blobUri }]);
  // La nouvelle disposition se monte APRÈS le geste (`AMBIENT_SCENE_DELAY_MS`) : jamais pendant que la pochette
  // sort et entre ; et d'une rafale de « Suivant », seule la dernière se monte.
  useEffect(() => {
    const timer = setTimeout(() => {
      setScenes((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.uri === uri) return prev;
        return [...prev, { id: (last?.id ?? 0) + 1, uri, blobUri }].slice(-MAX_SCENES);
      });
    }, AMBIENT_SCENE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [uri, blobUri]);
  const onShown = useCallback((id: number) => setScenes((prev) => prev.filter((scene) => scene.id >= id)), []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink }]} pointerEvents="none">
      {scenes.map((scene, i) => (
        <AmbientScene key={scene.id} scene={scene} clock={clock} beat={beat} bpm={bpm} first={i === 0 && scene.id === 0} onShown={onShown} />
      ))}
      <LinearGradient
        colors={[withAlpha(colors.ink, 0.2, colors.ink), withAlpha(colors.ink, 0.45, colors.ink), withAlpha(colors.ink, 0.88, colors.ink)]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

/**
 * Une disposition : pleine d'emblée à l'ouverture du lecteur (`first`), sinon invisible jusqu'à ce que sa
 * vignette soit décodée, puis un fondu vers le plein ; entière, elle congédie celles d'en dessous.
 */
interface SceneProps {
  scene: Scene;
  clock: SharedValue<number>;
  beat: BeatClock;
  bpm: number;
  first: boolean;
  onShown: (id: number) => void;
}

const AmbientScene = memo(function AmbientScene({ scene, clock, beat, bpm, first, onShown }: SceneProps) {
  const opacity = useSharedValue(first ? 1 : 0);
  const started = useRef(first);
  const reveal = useCallback(() => {
    if (started.current) return;
    started.current = true;
    opacity.value = withTiming(1, { duration: AMBIENT_CROSSFADE_MS, easing: Easing.inOut(Easing.quad) }, (done) => {
      if (done) runOnJS(onShown)(scene.id);
    });
  }, [opacity, onShown, scene.id]);
  useEffect(() => {
    if (first) return;
    if (scene.uri === null) {
      reveal();
      return;
    }
    const timer = setTimeout(reveal, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [first, scene.uri, reveal]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <AmbientLayers uri={scene.uri} clock={clock} imageTransition={first ? 250 : 0} onLoad={reveal} />
      {scene.blobUri !== null ? <AmbientBlobs uri={scene.blobUri} seedKey={scene.uri} clock={clock} beat={beat} bpm={bpm} /> : null}
    </Animated.View>
  );
});

interface LayersProps {
  uri: string | null;
  clock: SharedValue<number>;
  imageTransition: number;
  onLoad: () => void;
}

const AmbientLayers = memo(function AmbientLayers({ uri, clock, imageTransition, onLoad }: LayersProps) {
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
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={AMBIENT_BLUR}
              transition={imageTransition}
              cachePolicy="memory-disk"
              onLoad={i === 0 ? onLoad : undefined}
              onError={i === 0 ? onLoad : undefined}
              accessibilityIgnoresInvertColors
            />
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
