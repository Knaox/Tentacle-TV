import { memo } from "react";
import { StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import type { ArtworkPalette } from "../color/artworkPalette";
import { colors } from "../theme/tokens";

/**
 * Le fond vivant : le noir cinéma du bureau (#000 → #070710), et trois
 * lumières douces aux couleurs de l'œuvre qui a le focus — jamais un noir
 * pur, jamais une photo. Les lumières sont des dégradés radiaux (aucun flou
 * à calculer) ; quand l'œuvre change, les nouvelles apparaissent en fondu
 * par-dessus les anciennes.
 *
 * Bord à bord : ce fond ignore la marge de sécurité, seul le contenu la
 * respecte.
 */

export interface AmbientBackdropProps {
  palette: ArtworkPalette;
  /** 0 à 1 — la force des lumières (défaut 1). */
  intensity?: number;
}

const W = 1920;
const H = 1080;

function Lights({ palette, intensity }: { palette: ArtworkPalette; intensity: number }) {
  const [a, b, c] = palette.glows;
  const blobs = [
    { id: "l", cx: 180, cy: 470, rx: 760, ry: 640, color: a, alpha: 0.34 },
    { id: "r", cx: 1700, cy: 980, rx: 700, ry: 460, color: c, alpha: 0.2 },
    { id: "t", cx: 1080, cy: 60, rx: 820, ry: 360, color: b, alpha: 0.13 },
  ];
  return (
    <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
      <Defs>
        {blobs.map((blob) => (
          <RadialGradient key={blob.id} id={`ambient-${blob.id}`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={blob.color} stopOpacity={blob.alpha * intensity} />
            <Stop offset="0.45" stopColor={blob.color} stopOpacity={blob.alpha * intensity * 0.5} />
            <Stop offset="1" stopColor={blob.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {blobs.map((blob) => (
        <Ellipse key={blob.id} cx={blob.cx} cy={blob.cy} rx={blob.rx} ry={blob.ry} fill={`url(#ambient-${blob.id})`} />
      ))}
    </Svg>
  );
}

export const AmbientBackdrop = memo(function AmbientBackdrop({ palette, intensity = 1 }: AmbientBackdropProps) {
  const key = palette.glows.join("-");
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[colors.bgTop, colors.bgBottom]} style={StyleSheet.absoluteFill} />
      <Animated.View key={key} entering={FadeIn.duration(600)} exiting={FadeOut.duration(600)} style={StyleSheet.absoluteFill}>
        <Lights palette={palette} intensity={intensity} />
      </Animated.View>
    </View>
  );
});
