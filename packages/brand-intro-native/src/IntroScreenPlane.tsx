import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { IntroGeometry } from "@tentacle-tv/shared/brandIntro";
import type { IntroSamples } from "@tentacle-tv/shared/brandIntro";
import type { PartBoxes, TentacleArt } from "./introArt";
import { CameraLayer, IntroGroup, IntroPart, type StageFrame } from "./IntroPart";
import { FLASH_STOPS, SoftDiscSvg } from "./IntroSvgs";
import { useIntroPrimitives } from "./introPrimitives";
import { sampleAt, type IntroClock } from "./introWorklets";

/** Le cercle qui ouvre la vitre ne part jamais de zéro (une échelle nulle n'a pas d'inverse). */
const IRIS_MIN = 0.004;
/** L'éclair est une lumière douce : dessiné petit, agrandi d'autant. */
const FLASH_RASTER = 1 / 16;

export interface IntroScreenPlaneProps {
  art: TentacleArt;
  geometry: IntroGeometry;
  boxes: PartBoxes;
  samples: IntroSamples;
  clock: IntroClock;
  /** La fenêtre (points). */
  viewport: { width: number; height: number };
  /** Le zoom d'arrivée : l'écran du poulpe recouvre la fenêtre, l'accueil à l'échelle 1. */
  finalZoom: number;
  /** Le fond de l'écran autour de l'accueil (ses bandes, tant que l'écran est plus haut que lui). */
  screenColor: string;
  /** Arrivé : plus de découpe — l'écran EST l'accueil, à sa place. */
  landed: boolean;
  children: ReactNode;
}

/**
 * L'ÉCRAN du poulpe, qui montre l'app elle-même : l'accueil, monté pendant
 * l'ouverture, réduit derrière la vitre, découvert par un cercle parti du
 * bouton lecture (« dum »), puis la caméra plonge jusqu'à l'échelle 1 — il n'y
 * a pas de transition, c'est l'accueil. Les vues de l'app ne bougent jamais
 * d'arbre : à l'arrivée, chaque transformation vaut l'identité et la découpe
 * se retire (`landed`), sans rien remonter.
 *
 * Le cercle est une vue ronde agrandie (`scale`), son contenu réduit d'autant
 * (l'inverse, sur le même pivot) : rien que des transformations.
 */
export const IntroScreenPlane = memo(function IntroScreenPlane(props: IntroScreenPlaneProps) {
  const { art, geometry, boxes, samples, clock, viewport, finalZoom, screenColor, landed, children } = props;
  const { step } = samples;
  const { LinearGradient, RoundClip } = useIntroPrimitives();
  const center = { x: viewport.width / 2, y: viewport.height / 2 };
  const frame: StageFrame = { center, target: geometry.target, zoom: finalZoom };
  const { inner, play, reach } = geometry;
  // L'intérieur de l'écran, à l'arrivée : plus grand que la fenêtre, centré sur elle.
  const clip = {
    left: center.x + (inner.x - geometry.target.x) * finalZoom,
    top: center.y + (inner.y - geometry.target.y) * finalZoom,
    width: inner.width * finalZoom,
    height: inner.height * finalZoom,
  };
  const playAt = { x: center.x + (play.x - geometry.target.x) * finalZoom, y: center.y + (play.y - geometry.target.y) * finalZoom };
  const radius = reach * finalZoom;
  const inClip: StageFrame = { center: { x: center.x - clip.left, y: center.y - clip.top }, target: geometry.target, zoom: finalZoom };

  const irisStyle = useAnimatedStyle(() => ({
    transform: [{ scale: clock.landed.value ? 1 : Math.max(IRIS_MIN, sampleAt(samples.reveal, step, clock.scene.value)) }],
  }));
  const counterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: clock.landed.value ? 1 : 1 / Math.max(IRIS_MIN, sampleAt(samples.reveal, step, clock.scene.value)) }],
  }));
  // La vitre paraît avec le corps, et s'efface une fois le cercle au bout : il recouvre tout l'écran.
  const bodyOpacity = samples.parts.body.opacity;
  const glassStyle = useAnimatedStyle(() => {
    const t = clock.scene.value;
    return { opacity: sampleAt(samples.reveal, step, t) >= 1 ? 0 : sampleAt(bodyOpacity, step, t) };
  });
  const glass = art.LOGO_GRADIENTS.gT;

  return (
    <CameraLayer camera={samples.camera} baseZoom={finalZoom} clock={clock} step={step}>
      <IntroGroup frame={frame} pivot={{ x: 120, y: 132 }} channels={samples.parts.body} clock={clock} step={step} opacity={false}>
        <RoundClip style={[styles.clip, clip]} radius={inner.rx * finalZoom} clip={!landed}>
          {landed ? null : (
            <Animated.View style={[StyleSheet.absoluteFill, glassStyle]}>
              <LinearGradient
                style={StyleSheet.absoluteFill}
                colors={glass.stops.map((stop) => stop.color)}
                locations={glass.stops.map((stop) => stop.offset)}
                start={{ x: 0.5, y: (glass.y1 - inner.y) / inner.height }}
                end={{ x: 0.5, y: (glass.y2 - inner.y) / inner.height }}
              />
            </Animated.View>
          )}
          <Animated.View
            style={[
              styles.iris,
              { left: playAt.x - radius - clip.left, top: playAt.y - radius - clip.top, width: radius * 2, height: radius * 2 },
              landed ? styles.open : { borderRadius: radius },
              irisStyle,
            ]}
          >
            <Animated.View
              style={[
                styles.counter,
                { left: radius - playAt.x, top: radius - playAt.y, width: viewport.width, height: viewport.height },
                { transformOrigin: [playAt.x, playAt.y, 0] },
                counterStyle,
              ]}
            >
              {landed ? null : <View style={[styles.bars, { left: clip.left, top: clip.top, width: clip.width, height: clip.height, backgroundColor: screenColor }]} />}
              {children}
            </Animated.View>
          </Animated.View>
          {landed ? null : (
            <IntroPart frame={inClip} box={boxes.flash} pivot={play} clock={clock} channels={samples.parts.flash} step={step} raster={FLASH_RASTER}>
              {(size) => <SoftDiscSvg size={size.width} stops={FLASH_STOPS} />}
            </IntroPart>
          )}
        </RoundClip>
      </IntroGroup>
    </CameraLayer>
  );
});

const styles = StyleSheet.create({
  clip: { position: "absolute" },
  open: { overflow: "visible", borderRadius: 0 },
  iris: { position: "absolute", overflow: "hidden" },
  counter: { position: "absolute" },
  bars: { position: "absolute" },
});
