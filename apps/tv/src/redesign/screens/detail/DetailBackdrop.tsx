import { memo } from "react";
import { Image, StyleSheet } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { scrim } from "../../theme/tokens";

/**
 * Le fond de la fiche : l'image de l'œuvre bord à bord (1920 × 1080), FIXE,
 * sous ses voiles — une diagonale à gauche comme le bureau (le texte s'y
 * lit), un voile au pied (la section suivante y affleure), un léger en haut
 * (la marque). Quand on descend dans la page, l'image s'efface jusqu'à un
 * souvenir d'elle-même et laisse la place au fond vivant, teinté de ses
 * couleurs : seule son OPACITÉ suit le défilement.
 */

/** Le défilement au bout duquel l'image n'est plus qu'un souvenir. */
const FADE_DISTANCE = 620;
/** Ce qui reste de l'image, en bas de page. */
const RESTING_OPACITY = 0.2;

export const DetailBackdrop = memo(function DetailBackdrop({
  uri,
  scrollY,
}: {
  uri?: string;
  scrollY: SharedValue<number>;
}) {
  const fade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, FADE_DISTANCE], [1, RESTING_OPACITY], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fade]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
      <LinearGradient
        colors={[scrim(0.94), scrim(0.8), scrim(0.42), scrim(0.08), scrim(0)]}
        locations={[0, 0.28, 0.52, 0.72, 0.86]}
        start={{ x: 0, y: 0.35 }}
        end={{ x: 1, y: 0.62 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[scrim(0), scrim(0.5), scrim(0.92)]}
        locations={[0.5, 0.76, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient colors={[scrim(0.45), scrim(0)]} locations={[0, 0.22]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
});

/**
 * Le haut de l'écran, PAR-DESSUS la page : une fois qu'on est descendu, ce
 * qui passe au-dessus de la section ancrée s'y efface au lieu d'être coupé
 * net par le bord. Absent en haut de page (l'image y garde son ciel).
 */
export const DetailTopFade = memo(function DetailTopFade({ scrollY }: { scrollY: SharedValue<number> }) {
  const shown = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [120, 360], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.topFade, shown]}>
      <LinearGradient colors={[scrim(1), scrim(0.9), scrim(0)]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  // Plus court que l'ancrage (72) : le titre de la section ancrée reste entier.
  topFade: { position: "absolute", top: 0, left: 0, right: 0, height: 68 },
});
