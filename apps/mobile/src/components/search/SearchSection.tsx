import { memo, type ReactNode } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { MediaItem, SearchItemHit, SearchMediaItem } from "@tentacle-tv/shared";
import { MobileMediaCard } from "@/components/MobileMediaCard";
import { FONT_FAMILY, spacing, useResponsive, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/** Largeur d'une affiche dans un rail de résultats (téléphone / tablette). */
export function useRailCardWidth(): number {
  const { isTablet } = useResponsive();
  return isTablet ? 140 : 112;
}

/** Un résultat de recherche est un `MediaItem` réduit : la carte n'en lit que ce qu'il porte. */
export const asMediaItem = (item: SearchMediaItem): MediaItem => item as unknown as MediaItem;

/** L'en-tête d'une section : son titre, son compte, et « Tout voir » s'il y a plus. */
export function SectionHeader({ title, count, onSeeAll }: { title: string; count?: number; onSeeAll?: () => void }) {
  const { t } = useTranslation("search");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.header}>
      <Text style={st.title} accessibilityRole="header">
        {title}
        {count !== undefined && count > 0 && <Text style={st.count}>{`  ${count}`}</Text>}
      </Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={10} accessibilityRole="button" style={st.seeAll}>
          <Text style={st.seeAllTxt}>{t("seeAll")}</Text>
          <Feather name="chevron-right" size={15} color={theme.colors.brand.light} />
        </Pressable>
      )}
    </View>
  );
}

/** Une section : son en-tête, puis son contenu. */
export function Section({ children, ...header }: { title: string; count?: number; onSeeAll?: () => void; children: ReactNode }) {
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.section}>
      <SectionHeader {...header} />
      {children}
    </View>
  );
}

/** Des affiches en rail horizontal — l'aperçu d'une catégorie dans « Tout ». */
export const PosterRail = memo(function PosterRail({ hits, onOpen }: { hits: SearchItemHit[]; onOpen: (id: string) => void }) {
  const width = useRailCardWidth();
  const st = useThemedStyles(makeStyles);
  return (
    <FlatList
      horizontal
      data={hits}
      keyExtractor={(hit) => hit.item.Id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.rail}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item: hit }) => (
        <MobileMediaCard item={asMediaItem(hit.item)} width={width} onPress={() => onOpen(hit.item.Id)} />
      )}
    />
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    section: { marginTop: spacing.lg },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: spacing.screenPadding,
      marginBottom: spacing.sm,
    },
    title: { fontSize: 17, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, letterSpacing: -0.2 },
    count: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    seeAll: { flexDirection: "row" as const, alignItems: "center" as const, gap: 2, minHeight: 32 },
    seeAllTxt: { fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    rail: { paddingHorizontal: spacing.screenPadding, gap: 12 },
  });
