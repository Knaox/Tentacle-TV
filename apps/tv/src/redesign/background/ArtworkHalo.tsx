import { memo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Defs, FeGaussianBlur, Filter, LinearGradient, Rect, Stop } from "react-native-svg";
import { brandLight, type ArtworkPalette } from "../color/artworkPalette";

/**
 * Le halo d'une œuvre : sa lumière qui déborde tout autour de son cadre, aux
 * couleurs de la MARQUE nuancées par son image (`brandLight`) — un halo
 * orange ne disait pas l'app. Violet à gauche, rose à droite, sans retour au
 * violet : le dégradé de la marque, à dominante rose comme les lumières du
 * bureau (`--progress-glow`). Un rectangle arrondi dégradé, flouté UNE fois par
 * le SVG (le bitmap est ensuite réutilisé tel quel) ; rien ne s'anime dans le
 * flou — seule l'opacité entre en fondu quand l'œuvre change.
 *
 * Posé derrière le cadre, centré sur lui : `width`/`height` sont ceux du
 * cadre, `spread` ce que la lumière déborde avant le flou.
 */

export interface ArtworkHaloProps {
  width: number;
  height: number;
  radius: number;
  palette: ArtworkPalette;
  spread?: number;
  /** Force du halo, 0 à 1 (défaut 0,5 — celui du héros était « presque un
   *  peu trop agressif » à 0,7). */
  opacity?: number;
  blur?: number;
  style?: StyleProp<ViewStyle>;
}

export const ArtworkHalo = memo(function ArtworkHalo({
  width,
  height,
  radius,
  palette,
  spread = 26,
  opacity = 0.5,
  blur = 44,
  style,
}: ArtworkHaloProps) {
  // Le flou a besoin de place : trois écarts-types de chaque côté.
  const margin = spread + blur * 3;
  const w = width + margin * 2;
  const h = height + margin * 2;
  const light = brandLight(palette);
  const [a, b, c] = light.glows;
  const key = light.glows.join("-");
  return (
    <View pointerEvents="none" style={[{ position: "absolute", left: -margin, top: -margin, width: w, height: h }, style]}>
      <Animated.View key={key} entering={FadeIn.duration(700)} style={{ width: w, height: h, opacity }}>
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id="halo-fill" x1="0" y1="0" x2="1" y2="0.2">
              <Stop offset="0" stopColor={a} />
              <Stop offset="0.3" stopColor={b} />
              <Stop offset="0.62" stopColor={c} />
              <Stop offset="1" stopColor={c} />
            </LinearGradient>
            <Filter id="halo-blur" x="-20%" y="-30%" width="140%" height="160%">
              <FeGaussianBlur stdDeviation={blur} />
            </Filter>
          </Defs>
          <Rect
            x={margin - spread}
            y={margin - spread}
            width={width + spread * 2}
            height={height + spread * 2}
            rx={radius + spread}
            fill="url(#halo-fill)"
            filter="url(#halo-blur)"
          />
        </Svg>
      </Animated.View>
    </View>
  );
});
