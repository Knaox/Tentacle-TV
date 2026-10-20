import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { IntroPoint } from "@tentacle-tv/shared/brandIntro";
import type { IntroChannels, IntroLoopSamples } from "@tentacle-tv/shared/brandIntro";
import type { PartBox } from "./introArt";
import { loopStyleAt, partStyleAt, sampleAt, type IntroClock } from "./introWorklets";

/**
 * Le repère de la SCÈNE : la vue plein écran qui porte la caméra. Un point du
 * logo `u` s'y pose en `center + (u − target) × zoom` — le centre de l'écran
 * du poulpe au centre de la fenêtre, avant que la caméra ne le décale.
 */
export interface StageFrame {
  center: IntroPoint;
  target: IntroPoint;
  zoom: number;
}

const placeOf = (frame: StageFrame, box: PartBox) => ({
  left: frame.center.x + (box.x - frame.target.x) * frame.zoom,
  top: frame.center.y + (box.y - frame.target.y) * frame.zoom,
  width: box.width * frame.zoom,
  height: box.height * frame.zoom,
});

export interface IntroPartProps {
  frame: StageFrame;
  box: PartBox;
  pivot: IntroPoint;
  clock: IntroClock;
  /** La piste de la pièce (absente : une pièce immobile). */
  channels?: IntroChannels;
  step: number;
  /** La boucle de l'attente qui s'ajoute à la piste (le bouton qui bat, l'œil qui cligne). */
  loop?: IntroLoopSamples;
  /** La pièce ne vaut que dans cette fenêtre de la chorégraphie (ms) : la plaque nette qui prend le relais pendant la plongée. */
  visibleFrom?: number;
  visibleUntil?: number;
  /**
   * Le dessin est rastérisé `raster` fois plus grand que sa place, puis
   * réduit : il reste net quand la caméra l'agrandit. 2 suffit à la scène ;
   * au-delà, la réduction crénèle (filtre linéaire de Core Animation).
   */
  raster?: number;
  children: (size: { width: number; height: number }) => ReactNode;
}

/**
 * Une pièce de la scène : une vue posée sur son encombrement, qui tourne et
 * grandit autour de son PIVOT — rien d'autre ne bouge que sa transformation et
 * son opacité, lues image par image sur le fil d'interface.
 */
export const IntroPart = memo(function IntroPart(props: IntroPartProps) {
  const { frame, box, pivot, clock, channels, step, loop, raster = 2, children } = props;
  const from = props.visibleFrom ?? Number.NEGATIVE_INFINITY;
  const until = props.visibleUntil ?? Number.POSITIVE_INFINITY;
  const place = placeOf(frame, box);
  const origin = [(pivot.x - box.x) * frame.zoom, (pivot.y - box.y) * frame.zoom, 0];
  const zoom = frame.zoom;
  const main = useAnimatedStyle(() => {
    const t = clock.scene.value;
    const pose = channels ? partStyleAt(channels, step, t, zoom) : { opacity: 1, transform: [] };
    const opacity = clock.landed.value || t < from || t >= until ? 0 : pose.opacity;
    return { opacity, transform: pose.transform };
  });
  const idle = useAnimatedStyle(() => (loop ? loopStyleAt(loop, clock.idle.value, clock.idleWeight.value, zoom) : {}));
  const inner = { width: place.width * raster, height: place.height * raster };
  return (
    <Animated.View style={[styles.part, place, { transformOrigin: origin }, main]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin }, loop ? idle : null]}>
        <View
          style={[
            styles.raster,
            inner,
            { left: (place.width - inner.width) / 2, top: (place.height - inner.height) / 2, transform: [{ scale: 1 / raster }] },
          ]}
        >
          {children(inner)}
        </View>
      </Animated.View>
    </Animated.View>
  );
});

/**
 * Un calque de la scène qui suit la CAMÉRA : plein écran, sa transformation
 * part du centre de la fenêtre — le décalage de l'écran, puis le zoom rapporté
 * à celui de la mise en page (`baseZoom`).
 */
export const CameraLayer = memo(function CameraLayer({
  camera,
  baseZoom,
  clock,
  step,
  children,
}: {
  camera: { zoom: readonly number[]; offsetX: readonly number[]; offsetY: readonly number[] };
  baseZoom: number;
  clock: IntroClock;
  step: number;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const t = clock.scene.value;
    if (clock.landed.value) return { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
    return {
      transform: [
        { translateX: sampleAt(camera.offsetX, step, t) },
        { translateY: sampleAt(camera.offsetY, step, t) },
        { scale: sampleAt(camera.zoom, step, t) / baseZoom },
      ],
    };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="box-none">
      {children}
    </Animated.View>
  );
});

/**
 * Un GROUPE de pièces qui bouge d'un bloc (le corps du poulpe : son écran, son
 * visage, son bouton) : plein écran, la piste appliquée autour du pivot posé
 * dans le repère de la scène.
 */
export const IntroGroup = memo(function IntroGroup({
  frame,
  pivot,
  channels,
  clock,
  step,
  opacity = true,
  children,
}: {
  frame: StageFrame;
  pivot: IntroPoint;
  channels: IntroChannels;
  clock: IntroClock;
  step: number;
  /** Faux : le groupe ne prend que la transformation (l'opacité se pose sur une pièce dedans). */
  opacity?: boolean;
  children: ReactNode;
}) {
  const origin = [frame.center.x + (pivot.x - frame.target.x) * frame.zoom, frame.center.y + (pivot.y - frame.target.y) * frame.zoom, 0];
  const zoom = frame.zoom;
  const style = useAnimatedStyle(() => {
    if (clock.landed.value) return { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] };
    const pose = partStyleAt(channels, step, clock.scene.value, zoom);
    return { opacity: opacity ? pose.opacity : 1, transform: pose.transform };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin }, style]} pointerEvents="box-none">
      {children}
    </Animated.View>
  );
});


const styles = StyleSheet.create({
  part: { position: "absolute" },
  raster: { position: "absolute" },
});
