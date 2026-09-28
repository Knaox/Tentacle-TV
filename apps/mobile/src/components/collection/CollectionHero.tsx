import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { LIBRARY_HERO_HEIGHT } from "@/components/library/LibraryHero";
import { FONT_FAMILY, spacing, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

type FeatherName = keyof typeof Feather.glyphMap;

/**
 * L'en-tête de Ma liste et de Mes favoris : l'AMBIANCE de la Bibliothèque
 * (`LibraryHero`) — une image pleine largeur qui remonte sous la zone sûre et
 * se fond dans la page, surtitre 11 gras capitales avec son icône, titre
 * 40/46 extra-gras, résumé 14 semi-gras — puis les gestes de la page
 * (`actions` : Partager, Sélectionner).
 *
 * L'image est celle du premier titre de la collection qui en a une, déjà en
 * mémoire : zéro requête, et immobile — une liste qu'on a soi-même
 * constituée n'a pas de vitrine à faire tourner. Le retour flottant est posé
 * par l'écran, au-dessus de la liste (comme `LibraryCatalogScreen`).
 */
export const CollectionHero = memo(function CollectionHero({
  items, title, kicker, icon, subtitle, topInset, actions,
}: {
  items: MediaItem[] | undefined;
  title: string;
  kicker: string;
  icon: FeatherName;
  subtitle?: string;
  /** Ce que l'ambiance remonte sous le haut de l'écran (la zone sûre). */
  topInset: number;
  actions?: ReactNode;
}) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const featured = items?.find((i) => (i.BackdropImageTags?.length ?? 0) > 0);
  const url = featured ? client.getImageUrl(featured.Id, "Backdrop", { width: 1280, quality: 75, index: 0 }) : null;
  const bg = theme.colors.surface.s0;

  return (
    <View style={st.hero}>
      <View style={[st.ambient, { top: -topInset }]} pointerEvents="none">
        {url && <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} accessible={false} />}
        <LinearGradient
          colors={[withAlpha(bg, 0.55, bg), withAlpha(bg, 0.15, bg), withAlpha(bg, 0.7, bg), bg]}
          locations={[0, 0.35, 0.72, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={st.text}>
        <View style={st.kickerRow}>
          <Feather name={icon} size={12} color={theme.colors.brand.light} />
          <Text style={st.kicker}>{kicker}</Text>
        </View>
        <Text style={st.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={st.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        {actions ? <View style={st.actions}>{actions}</View> : null}
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    hero: { minHeight: LIBRARY_HERO_HEIGHT, justifyContent: "flex-end", paddingBottom: spacing.lg },
    ambient: { position: "absolute", left: 0, right: 0, bottom: 0 },
    text: { paddingHorizontal: spacing.screenPadding, gap: 2 },
    kickerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    kicker: {
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: "uppercase",
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
    subtitle: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary, fontVariant: ["tabular-nums"] },
    actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  });
