/**
 * Octave mobile — la tête d'une collection (album, artiste, ambiance) : la
 * grande image, la nature (« Album », « Artiste »), le nom, une ligne de méta,
 * puis Lecture et Aléatoire — en verre sur iOS 26, au dégradé d'Octave
 * ailleurs. Téléphone : l'image centrée au-dessus ; tablette : à côté du texte.
 * L'image grandit quand on tire la page vers le bas, s'efface en montant
 * (`scrollY`, transformations seules, fil d'interface).
 */

import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Shuffle } from "lucide-react-native";
import { GlassSurface } from "@/components/ui";
import { typography, useTheme, withAlpha } from "@/theme";
import { Artwork } from "../ui/Artwork";
import { usePageMetrics } from "../ui/pageStyle";
import { OctavePlayButton } from "../../layout/OctavePlayButton";

interface CollectionHeaderProps {
  kicker: string;
  title: string;
  artworkUrl: string | null;
  round?: boolean;
  meta?: ReactNode;
  canPlay: boolean;
  onPlay: () => void;
  onShuffle: () => void;
  scrollY: SharedValue<number>;
  /** Une teinte de fond (ambiance) ; par défaut, la marque. */
  tint?: string;
  extra?: ReactNode;
  /** Une image composée (la jaquette d'une playlist, d'un mix) à la place d'`artworkUrl`, à la taille donnée. */
  renderArt?: (size: number) => ReactNode;
}

export const CollectionHeader = memo(function CollectionHeader(props: CollectionHeaderProps) {
  const { kicker, title, artworkUrl, round, meta, canPlay, onPlay, onShuffle, scrollY, tint, extra, renderArt } = props;
  const { t } = useTranslation("music");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet, gutter, contentWidth } = usePageMetrics();
  const art = isTablet ? 240 : Math.min(260, Math.round(contentWidth * 0.62));
  const artStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scrollY.value, [-160, 0], [1.18, 1], Extrapolation.CLAMP) }, { translateY: interpolate(scrollY.value, [0, art], [0, art * 0.35], Extrapolation.CLAMP) }],
    opacity: interpolate(scrollY.value, [0, art * 0.9], [1, 0.15], Extrapolation.CLAMP),
  }));
  const veil = tint ?? theme.colors.brand.accent;
  return (
    <View style={{ paddingTop: insets.top + 56 }}>
      <LinearGradient colors={[withAlpha(veil, 0.32, theme.colors.brand.soft), withAlpha(veil, 0, "transparent")]} style={[StyleSheet.absoluteFill, { height: art + insets.top + 160 }]} />
      <View style={[isTablet ? styles.rowTablet : styles.colPhone, { paddingHorizontal: gutter }]}>
        <Animated.View style={[styles.shadow, artStyle]}>
          {renderArt ? renderArt(art) : <Artwork url={artworkUrl} size={art} round={round} radius={14} kind={round ? "artist" : "album"} />}
        </Animated.View>
        <View style={[styles.text, isTablet ? styles.textTablet : styles.textPhone]}>
          <Text style={[typography.small, { color: theme.colors.text.secondary, textTransform: "uppercase", letterSpacing: 1 }]}>{kicker}</Text>
          <Text accessibilityRole="header" numberOfLines={3} style={[typography.hero, { color: theme.colors.text.primary, textAlign: isTablet ? "left" : "center", fontSize: isTablet ? 34 : 26 }]}>
            {title}
          </Text>
          {meta ? <View style={[styles.meta, { justifyContent: isTablet ? "flex-start" : "center" }]}>{meta}</View> : null}
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

/** Une ligne de méta : des morceaux séparés par « · ». */
export function MetaLine({ parts }: { parts: readonly (string | null | undefined | false)[] }) {
  const theme = useTheme();
  return <Text style={[typography.caption, { color: theme.colors.text.secondary, textAlign: "center" }]}>{parts.filter(Boolean).join(" · ")}</Text>;
}

const styles = StyleSheet.create({
  colPhone: { alignItems: "center", gap: 18 },
  rowTablet: { flexDirection: "row", alignItems: "flex-end", gap: 28 },
  shadow: { shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  text: { gap: 6 },
  textPhone: { alignItems: "center", alignSelf: "stretch" },
  textTablet: { flex: 1, minWidth: 0 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  buttons: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, marginBottom: 8 },
  shuffle: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 22 },
});
