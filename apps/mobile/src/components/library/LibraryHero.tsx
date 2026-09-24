import { memo, useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { LibraryView } from "@tentacle-tv/shared";
import { FONT_FAMILY, motion, spacing, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

/** Hauteur visible du héros, sous l'en-tête flottant. */
export const LIBRARY_HERO_HEIGHT = 230;
/** Une autre image de la bibliothèque toutes les douze secondes, en fondu. */
const ROTATE_MS = 12_000;
const CROSSFADE_MS = 900;

interface RandomItem {
  id: string;
  hasBackdrop: boolean;
  hasPrimary: boolean;
}

export function collectionIcon(type?: string): "film" | "tv" | "layers" {
  switch (type?.toLowerCase()) {
    case "movies": return "film";
    case "tvshows": return "tv";
    default: return "layers";
  }
}

/**
 * L'ambiance d'une bibliothèque : une de ses images, pleine largeur, qui
 * passe sous l'en-tête de verre et se fond dans la page — et son nom en grand.
 * Changer de bibliothèque change l'ambiance en fondu (`transition`
 * d'expo-image : une seule image en mémoire, pas de calque en plus).
 *
 * L'image tourne lentement tant que l'onglet est devant et que le mouvement
 * n'est pas réduit ; derrière un autre écran, plus rien ne tourne.
 */
export const LibraryHero = memo(function LibraryHero({ library, topInset }: { library: LibraryView; topInset: number }) {
  const { t } = useTranslation("common");
  const { t: tn } = useTranslation("nav");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const items: RandomItem[] = (library as LibraryView & { _randomItems?: RandomItem[] })._randomItems ?? [];
  const [turn, setTurn] = useState(0);

  useFocusEffect(useCallback(() => {
    if (items.length <= 1 || motion.isReducedMotion()) return;
    const timer = setInterval(() => setTurn((n) => n + 1), ROTATE_MS);
    return () => clearInterval(timer);
  }, [items.length]));

  const item = items.length > 0 ? items[turn % items.length] : undefined;
  const url = item?.hasBackdrop
    ? client.getImageUrl(item.id, "Backdrop", { width: 1280, quality: 75, index: 0 })
    : item?.hasPrimary ? client.getImageUrl(item.id, "Primary", { width: 900, quality: 75 }) : null;
  const bg = theme.colors.surface.s0;
  const count = library.RecursiveItemCount ?? library.ChildCount;

  return (
    <View style={st.hero}>
      <View style={[st.ambient, { top: -topInset }]} pointerEvents="none">
        {url && (
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={CROSSFADE_MS} accessible={false} />
        )}
        <LinearGradient
          colors={[withAlpha(bg, 0.55, bg), withAlpha(bg, 0.15, bg), withAlpha(bg, 0.7, bg), bg]}
          locations={[0, 0.35, 0.72, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={st.text}>
        <View style={st.kickerRow}>
          <Feather name={collectionIcon(library.CollectionType)} size={12} color={theme.colors.brand.light} />
          <Text style={st.kicker}>{tn("library")}</Text>
        </View>
        <Text style={st.title} numberOfLines={1} accessibilityRole="header">{library.Name}</Text>
        {count !== undefined && <Text style={st.count}>{t("libraryTitles", { count })}</Text>}
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    hero: { height: LIBRARY_HERO_HEIGHT, justifyContent: "flex-end" as const, paddingBottom: spacing.lg },
    ambient: { position: "absolute" as const, left: 0, right: 0, bottom: 0 },
    text: { paddingHorizontal: spacing.screenPadding, gap: 2 },
    kickerRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
    kicker: {
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: "uppercase" as const,
      fontFamily: FONT_FAMILY.bold,
      color: t.colors.brand.light,
    },
    title: {
      fontSize: 40,
      lineHeight: 46,
      fontFamily: FONT_FAMILY.extrabold,
      letterSpacing: -1,
      color: t.colors.text.primary,
      // L'ombre détache le titre de l'image en sombre ; en clair, elle salirait.
      textShadowColor: t.isDark ? "rgba(0, 0, 0, 0.35)" : "transparent",
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 12,
    },
    count: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary, fontVariant: ["tabular-nums"] },
  });
