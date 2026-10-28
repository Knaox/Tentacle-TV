/**
 * Octave mobile — la tête de « Titres likés » : la tuile au dégradé d'Octave (violet → rose) et son cœur, à
 * la place d'une pochette ; le titre, le nombre de titres et la durée, Lecture et Aléatoire. Téléphone : la
 * tuile centrée au-dessus ; tablette : à côté du texte. La tuile grandit quand on tire la page, s'efface en
 * montant (transformations seules, fil d'interface).
 */

import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Heart, Shuffle } from "lucide-react-native";
import { GlassSurface } from "@/components/ui";
import { typography, useTheme, withAlpha } from "@/theme";
import { useOctaveColors } from "../../layout";
import { usePageMetrics } from "../../pages/ui/pageStyle";
import { OctavePlayButton } from "../../layout/OctavePlayButton";

interface Props {
  meta: string | null;
  canPlay: boolean;
  onPlay: () => void;
  onShuffle: () => void;
  scrollY: SharedValue<number>;
  /** À côté d'Aléatoire (« Garder hors ligne »). */
  extra?: ReactNode;
}

export const LikedHero = memo(function LikedHero({ meta, canPlay, onPlay, onShuffle, scrollY, extra }: Props) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const colors = useOctaveColors();
  const insets = useSafeAreaInsets();
  const { isTablet, gutter, contentWidth } = usePageMetrics();
  const art = isTablet ? 220 : Math.min(220, Math.round(contentWidth * 0.52));
  const artStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scrollY.value, [-160, 0], [1.18, 1], Extrapolation.CLAMP) }, { translateY: interpolate(scrollY.value, [0, art], [0, art * 0.35], Extrapolation.CLAMP) }],
    opacity: interpolate(scrollY.value, [0, art * 0.9], [1, 0.15], Extrapolation.CLAMP),
  }));
  return (
    <View style={{ paddingTop: insets.top + 56 }}>
      <LinearGradient colors={[withAlpha(colors.accent, 0.3, theme.colors.brand.soft), withAlpha(colors.accent, 0, "transparent")]} style={[StyleSheet.absoluteFill, { height: art + insets.top + 160 }]} />
      <View style={[isTablet ? styles.rowTablet : styles.colPhone, { paddingHorizontal: gutter }]}>
        <Animated.View style={[styles.shadow, artStyle]}>
          <LinearGradient colors={colors.gradient as unknown as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.tile, { width: art, height: art }]}>
            <Heart size={Math.round(art * 0.36)} color="#fff" fill="#fff" />
          </LinearGradient>
        </Animated.View>
        <View style={[styles.text, isTablet ? styles.textTablet : styles.textPhone]}>
          <Text style={[typography.small, { color: theme.colors.text.secondary, textTransform: "uppercase", letterSpacing: 1 }]}>{t("liked.kicker")}</Text>
          <Text accessibilityRole="header" style={[typography.hero, { color: theme.colors.text.primary, fontSize: isTablet ? 34 : 26, textAlign: isTablet ? "left" : "center" }]}>
            {t("liked.title")}
          </Text>
          {meta ? <Text style={[typography.caption, { color: theme.colors.text.secondary }]}>{meta}</Text> : <View style={styles.metaSpace} />}
          <View style={[styles.buttons, { justifyContent: isTablet ? "flex-start" : "center" }]}>
            <OctavePlayButton label={t("common.playAll")} onPress={onPlay} disabled={!canPlay} />
            <Pressable onPress={onShuffle} disabled={!canPlay} accessibilityRole="button" accessibilityLabel={t("common.shuffle")} style={{ opacity: canPlay ? 1 : 0.45 }}>
              <GlassSurface tier="subtle" tint="regular" radius={24} interactive style={styles.shuffle}>
                <Shuffle size={18} color={theme.colors.text.primary} />
                <Text style={[typography.bodyBold, { color: theme.colors.text.primary }]}>{t("common.shuffle")}</Text>
              </GlassSurface>
            </Pressable>
            {extra}
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  colPhone: { alignItems: "center", gap: 18 },
  rowTablet: { flexDirection: "row", alignItems: "flex-end", gap: 28 },
  shadow: { shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12, borderRadius: 18 },
  tile: { borderRadius: 18, alignItems: "center", justifyContent: "center" },
  text: { gap: 6 },
  textPhone: { alignItems: "center", alignSelf: "stretch" },
  textTablet: { flex: 1, minWidth: 0 },
  metaSpace: { height: 18 },
  buttons: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, marginBottom: 8 },
  shuffle: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 22 },
});
