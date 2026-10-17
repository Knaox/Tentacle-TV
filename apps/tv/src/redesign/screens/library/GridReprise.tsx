import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useCardMetrics } from "../../cards/cardSizeMode";
import type { CardModel } from "../../cards/cardTypes";
import { colors, fonts } from "../../theme/tokens";

/**
 * Une REPRISE d'une ligne de grille qui tourne (tv-core
 * `trailerPreviewGridLine.ts`) : une affiche du DÉBUT de la ligne, redessinée
 * après sa dernière pour remplir la place au bout quand une affiche passe en
 * tête. Atténuée, marquée ↺, et jamais focalisable : rien qu'une image et sa
 * légende, sans cible — DROITE s'arrête à la vraie dernière affiche.
 *
 * Elle paraît avec la grande carte (`shown`, sur le fil d'interface) : posée
 * d'avance au bout de la piste, elle ne se voit jamais avant l'aperçu.
 */

/** L'atténuation d'une reprise : présente, sans rivaliser avec la ligne. */
const REPRISE_OPACITY = 0.32;

export const GridReprise = memo(function GridReprise({ card, width, shown }: { card: CardModel; width: number; shown: SharedValue<number> }) {
  const radius = useCardMetrics().poster.radius;
  const height = Math.round(width * 1.5);
  const fade = useAnimatedStyle(() => ({ opacity: REPRISE_OPACITY * shown.value }));
  const uri = card.posterUri ?? card.landscapeUri;
  return (
    <Animated.View pointerEvents="none" style={[{ width }, fade]}>
      <View style={[styles.frame, { width, height, borderRadius: radius }]}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
        <Text style={styles.glyph}>↺</Text>
      </View>
      <View style={styles.caption}>
        <Text style={styles.title} numberOfLines={1}>{card.title}</Text>
        {card.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{card.subtitle}</Text> : null}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: colors.surface3 },
  glyph: { position: "absolute", top: 10, left: 14, ...fonts.bold, fontSize: 28, color: colors.text },
  caption: { marginTop: 14, gap: 2 },
  title: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
  subtitle: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
});
