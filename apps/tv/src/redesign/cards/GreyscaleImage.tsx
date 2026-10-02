import { memo, useCallback } from "react";
import { Image, PixelRatio, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Defs, FeColorMatrix, Filter, Image as SvgImage } from "react-native-svg";
import { motionTo } from "../motion/motion";
import { NativeDesaturate } from "./nativeDesaturate";

/**
 * Une image en niveaux de gris — l'affiche d'un titre absent de la
 * bibliothèque.
 *
 * Sur Apple TV, l'image est une `Image` ordinaire (décodée hors du fil
 * principal), sous la vue native de désaturation (`NativeDesaturate`) : un
 * gris composé en « saturation » par le GPU, gratuit au montage comme au
 * focus. Mesuré au banc : le même gris par un filtre SVG retenait le fil
 * principal 50 à 75 ms par affiche à l'arrivée d'une fiche.
 *
 * Repli — un binaire sans la vue native (Android TV, build d'avant) : le
 * filtre SVG (`FeColorMatrix` saturation 0, Core Image), dessiné à UN pixel
 * par point puis agrandi par le GPU. L'ancienne architecture n'a ni `filter`
 * ni `mixBlendMode`.
 *
 * Elle paraît en fondu à son arrivée, sur `imageIn` — rien ne clignote.
 */

/** Le dessin à un pixel par point, quelle que soit l'échelle de l'écran. */
const K = Math.max(1, Math.round(PixelRatio.get()));

export const GreyscaleImage = memo(function GreyscaleImage({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  const shown = useSharedValue(0);
  const appear = useAnimatedStyle(() => ({ opacity: shown.value }));
  const onLoad = useCallback(() => {
    shown.value = motionTo(1, "imageIn");
  }, [shown]);
  if (NativeDesaturate) {
    return (
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, appear]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} onLoad={onLoad} />
        <NativeDesaturate pointerEvents="none" style={StyleSheet.absoluteFill} />
      </Animated.View>
    );
  }
  const w = width / K;
  const h = height / K;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, appear]}>
      <View style={[styles.drawing, { width: w, height: h, left: (width - w) / 2, top: (height - h) / 2, transform: [{ scale: K }] }]}>
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <Defs>
            <Filter id="grey" x={0} y={0} width={w} height={h} filterUnits="userSpaceOnUse">
              <FeColorMatrix type="saturate" values="0" />
            </Filter>
          </Defs>
          <SvgImage
            href={{ uri }}
            width={w}
            height={h}
            preserveAspectRatio="xMidYMid slice"
            filter="url(#grey)"
            onLoad={onLoad}
          />
        </Svg>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  drawing: { position: "absolute" },
});
