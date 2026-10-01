import { memo, useCallback } from "react";
import { PixelRatio, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Defs, FeColorMatrix, Filter, Image as SvgImage } from "react-native-svg";
import { motionTo } from "../motion/motion";

/**
 * Une image en niveaux de gris — l'affiche d'un titre absent de la
 * bibliothèque. L'ancienne architecture de React Native n'a ni `filter` ni
 * `mixBlendMode` (sans effet hors du nouveau moteur de rendu) : le gris passe
 * par un filtre SVG (`FeColorMatrix` saturation 0, Core Image), comme le halo
 * du héros historique.
 *
 * Ce qui se dessine sur le processeur se paie au montage, sur le fil
 * principal, quatre fois plus sur une Apple TV 4K (échelle 2) : l'image est
 * dessinée à UN pixel par point, puis agrandie par le GPU (`k`). Grisée et
 * assombrie, l'affiche n'a pas besoin de plus de finesse ; le simulateur 1080p
 * (échelle 1) la dessine à sa taille.
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
