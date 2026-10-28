/**
 * Octave (mobile) — les TACHES de couleur du fond (`ambientBlobs`) : chacune une région de la pochette, floutée
 * et fondue en disque doux. Le dessin (SVG : la vignette, un flou en copies décalées, un masque radial) est fait
 * UNE fois par pochette, PETIT puis agrandi (`BLOB_RASTER_SIDE`) ; à chaque image ne changent que la
 * transformation et l'opacité de sa vue, sur le fil d'interface — la dérive de l'horloge du fond, et le
 * battement (`ambientBeat`). Jamais un filtre SVG ici : react-native-svg le calcule par Core Image, de façon
 * synchrone, sur le fil principal (le balayage du lecteur « laggait », 28/10).
 */

import { memo, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, G, Image as SvgImage, Mask, RadialGradient, Rect, Stop, Use } from "react-native-svg";
import { ambientSeed, layerTransform } from "./ambientMotion";
import { ambientBlobs, blobBlurTaps, blobImageFrame, blobRasterScale, BLOB_RASTER_SIDE, type AmbientBlob } from "./ambientBlobs";
import { beatPulse } from "./ambientBeat";
import type { BeatClock } from "./useBeatClock";

interface Props {
  /** La vignette des taches (déjà résolue : jeton, copie de l'appareil). */
  uri: string;
  /** La clé de disposition (l'adresse de la pochette) : la même que celle des calques. */
  seedKey: string | null;
  clock: SharedValue<number>;
  beat: BeatClock;
  bpm: number;
}

export const AmbientBlobs = memo(function AmbientBlobs({ uri, seedKey, clock, beat, bpm }: Props) {
  const blobs = useMemo(() => ambientBlobs(ambientSeed(seedKey)), [seedKey]);
  return (
    <>
      {blobs.map((blob, i) => (
        <BlobView key={i} id={i} blob={blob} uri={uri} clock={clock} beat={beat} bpm={bpm} />
      ))}
    </>
  );
});

interface BlobProps {
  id: number;
  blob: AmbientBlob;
  uri: string;
  clock: SharedValue<number>;
  beat: BeatClock;
  bpm: number;
}

const BlobView = memo(function BlobView({ id, blob, uri, clock, beat, bpm }: BlobProps) {
  const { width, height } = useWindowDimensions();
  const side = Math.round(blob.size * Math.max(width, height));
  const { time, on } = beat;
  const style = useAnimatedStyle(() => {
    const t = layerTransform(blob.drift, clock.value, width, height);
    const pulse = beatPulse(time.value, bpm) * on.value;
    return {
      opacity: blob.opacity * (0.82 + 0.18 * pulse),
      transform: [
        { translateX: t.translateX },
        { translateY: t.translateY },
        { rotate: `${t.rotateDeg}deg` },
        { scale: t.scale * (1 + blob.pulseScale * pulse) },
      ],
    };
  }, [blob, width, height, bpm]);
  return (
    <Animated.View style={[styles.blob, { width: side, height: side, left: blob.anchorX * width - side / 2, top: blob.anchorY * height - side / 2 }, style]}>
      {/* Dessinée petite, agrandie par le compositeur : le dessin ne coûte presque rien au fil principal. */}
      <View style={[styles.raster, { left: (side - BLOB_RASTER_SIDE) / 2, top: (side - BLOB_RASTER_SIDE) / 2, transform: [{ scale: blobRasterScale(side) }] }]}>
        <BlobArt id={id} side={BLOB_RASTER_SIDE} uri={uri} focusX={blob.focusX} focusY={blob.focusY} />
      </View>
    </Animated.View>
  );
});

/** Le dessin d'une tache, à `BLOB_RASTER_SIDE` : peint une fois (les props ne changent qu'avec la pochette). */
const BlobArt = memo(function BlobArt({ id, side, uri, focusX, focusY }: { id: number; side: number; uri: string; focusX: number; focusY: number }) {
  const frame = blobImageFrame(side, focusX, focusY);
  const taps = useMemo(() => blobBlurTaps(side), [side]);
  const gradient = `blobFade${id}`;
  const mask = `blobMask${id}`;
  const image = `blobImage${id}`;
  return (
    <Svg width={side} height={side}>
      <Defs>
        <RadialGradient id={gradient} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#fff" stopOpacity="1" />
          <Stop offset="0.45" stopColor="#fff" stopOpacity="0.85" />
          <Stop offset="1" stopColor="#fff" stopOpacity="0" />
        </RadialGradient>
        <Mask id={mask}>
          <Rect x="0" y="0" width={side} height={side} fill={`url(#${gradient})`} />
        </Mask>
        <SvgImage id={image} href={{ uri }} x={frame.x} y={frame.y} width={frame.size} height={frame.size} preserveAspectRatio="xMidYMid slice" />
      </Defs>
      {/* Le flou : la même image (chargée une fois) posée en copies décalées, qui se moyennent (`blobBlurTaps`). */}
      <G mask={`url(#${mask})`}>
        {taps.map((tap, i) => (
          <Use key={i} href={`#${image}`} x={tap.dx} y={tap.dy} opacity={tap.opacity} />
        ))}
      </G>
    </Svg>
  );
});

const styles = StyleSheet.create({
  blob: { position: "absolute" },
  raster: { position: "absolute", width: BLOB_RASTER_SIDE, height: BLOB_RASTER_SIDE },
});
