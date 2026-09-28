import { memo, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useRestoreWatchlistItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { ctlGradient, spacing, FONT_FAMILY, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

/** Liste vide : ce que l'écran promet, et deux chemins pour la remplir. */
export const WatchlistEmptyState = memo(function WatchlistEmptyState() {
  const { t } = useTranslation("watchlist");
  const { t: tc } = useTranslation("common");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const gradient = ctlGradient(colors.brand);

  return (
    <View style={styles.empty}>
      <View style={styles.badge}>
        <LinearGradient {...gradient} style={StyleSheet.absoluteFill} />
        <Feather name="bookmark" size={30} color="#FFFFFF" />
      </View>
      <Text style={styles.emptyTitle} accessibilityRole="header">{tc("emptyWatchlist")}</Text>
      <Text style={styles.emptyBody}>{t("emptyBody")}</Text>
      <Pressable
        onPress={() => router.push("/")}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
      >
        <LinearGradient {...gradient} style={StyleSheet.absoluteFill} />
        <Feather name="compass" size={18} color="#FFFFFF" />
        <Text style={styles.ctaText}>{t("emptyExplore")}</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push("/search")}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cta, styles.ctaGhost, pressed && styles.pressed]}
      >
        <Feather name="search" size={18} color={colors.text.secondary} />
        <Text style={[styles.ctaText, { color: colors.text.secondary }]}>{t("emptySearch")}</Text>
      </Pressable>
    </View>
  );
});

/**
 * « Titre a quitté Ma liste — Annuler », posé en bas au-dessus de la zone
 * sûre. Monté seulement quand il a quelque chose à dire ; disparaît en 6 s.
 * L'annulation rend le titre TEL QU'IL ÉTAIT (`useRestoreWatchlistItem`).
 */
export function UndoBar({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const { t } = useTranslation("watchlist");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const restore = useRestoreWatchlistItem(item);

  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [item, onClose]);

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(150)}
      style={[styles.undoWrap, { bottom: Math.max(insets.bottom, spacing.md) }]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.undo}>
        <Text style={styles.undoText} numberOfLines={1}>{t("removed", { title: item.Name })}</Text>
        <Pressable
          onPress={() => { restore.mutate(); onClose(); }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.undoBtn, pressed && styles.pressed]}
          hitSlop={6}
        >
          <Feather name="rotate-ccw" size={15} color={colors.brand.light} />
          <Text style={styles.undoBtnText}>{t("undo")}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    empty: { alignItems: "center", paddingTop: 64, paddingHorizontal: spacing.xl, gap: spacing.sm },
    badge: {
      width: 72,
      height: 72,
      borderRadius: 22,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
      shadowColor: t.colors.brand.violet,
      shadowOpacity: 0.4,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
    },
    emptyTitle: { fontFamily: FONT_FAMILY.bold, fontSize: 20, letterSpacing: -0.4, color: t.colors.text.primary },
    emptyBody: {
      fontFamily: FONT_FAMILY.regular,
      fontSize: 14,
      lineHeight: 21,
      color: t.colors.text.tertiary,
      textAlign: "center",
      maxWidth: 300,
      marginBottom: spacing.lg,
    },
    cta: {
      width: "100%",
      maxWidth: 300,
      height: 48,
      borderRadius: 24,
      overflow: "hidden",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    ctaGhost: { backgroundColor: t.colors.fill.subtle, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle },
    ctaText: { fontFamily: FONT_FAMILY.bold, fontSize: 15, color: "#FFFFFF" },
    undoWrap: { position: "absolute", left: spacing.md, right: spacing.md, alignItems: "center" },
    undo: {
      width: "100%",
      maxWidth: 520,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingLeft: spacing.lg,
      paddingRight: 6,
      paddingVertical: 6,
      borderRadius: 18,
      backgroundColor: t.colors.surface.s1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.strong,
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    undoText: { flex: 1, fontFamily: FONT_FAMILY.medium, fontSize: 14, color: t.colors.text.primary },
    undoBtn: {
      height: 44,
      paddingHorizontal: spacing.md,
      borderRadius: 22,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: withAlpha(t.colors.brand.violet, 0.14, t.colors.brand.ghost),
    },
    undoBtnText: { fontFamily: FONT_FAMILY.bold, fontSize: 14, color: t.colors.brand.light },
    pressed: { opacity: 0.7 },
  });
