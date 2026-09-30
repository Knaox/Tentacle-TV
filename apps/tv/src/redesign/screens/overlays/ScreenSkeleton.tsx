import { memo } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { FadeIn } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../color/artworkPalette";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { white } from "../../theme/tokens";

/**
 * Un écran qui se charge (le repli de la frontière de chargement de chaque
 * écran paresseux) : la silhouette d'une page — titre, grand cadre, une
 * rangée de cartes — en verre éteint. Rien ne scintille : aucune animation
 * infinie ; la silhouette entre en fondu, et c'est tout. La navigation
 * reste (`nav`), pour que rien ne saute quand l'écran arrive.
 */

export interface ScreenSkeletonProps {
  nav?: NavRailProps;
  palette?: ArtworkPalette;
}

const LEFT = TV_STAGE.contentLeft;
const CONTENT_WIDTH = 1920 - LEFT - 56;
const CARD = TV_STAGE.card.landscape;

function Bone({ width, height, radius }: { width: DimensionValue; height: number; radius: number }) {
  return (
    <View style={[styles.bone, { width, height, borderRadius: radius }]}>
      <LinearGradient colors={[white(0.06), white(0)]} locations={[0, 0.8]} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />
    </View>
  );
}

export const ScreenSkeleton = memo(function ScreenSkeleton({ nav, palette = NEUTRAL_PALETTE }: ScreenSkeletonProps) {
  return (
    <View style={styles.root} accessibilityRole="progressbar">
      <AmbientBackdrop palette={palette} intensity={0.6} />
      <Animated.View entering={FadeIn.duration(400)} style={styles.page}>
        <Bone width={420} height={52} radius={16} />
        <View style={styles.hero}>
          <Bone width={CONTENT_WIDTH} height={560} radius={TV_STAGE.hero.radius} />
        </View>
        <Bone width={340} height={36} radius={12} />
        <View style={styles.row}>
          {[0, 1, 2, 3, 4].map((index) => (
            <Bone key={index} width={CARD.width} height={CARD.height} radius={CARD.radius} />
          ))}
        </View>
      </Animated.View>
      {nav ? <NavRail {...nav} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  page: { position: "absolute", left: LEFT, top: TV_STAGE.safe.y + 10, right: 0, bottom: 0 },
  hero: { marginTop: 34, marginBottom: 56 },
  row: { flexDirection: "row", gap: TV_STAGE.row.gap, marginTop: TV_STAGE.row.titleGap },
  bone: { overflow: "hidden", backgroundColor: white(0.05), borderWidth: 1, borderColor: white(0.07) },
});
