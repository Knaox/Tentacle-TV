import { useMemo } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { ProgressBar } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, RADIUS, SHADOW_RN, useResponsive, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * Carrousel « Ma liste » de l'accueil — déduplique les entrées personnelles.
 * Extrait de HomeScreen (règle des 300 lignes) ; la progression hérite du
 * dégradé de marque via ProgressBar.
 */

interface CarouselItem {
  key: string;
  jellyfinId: string;
  name: string;
  year?: number;
  played?: boolean;
  progress?: number;
}

interface Props {
  personalItems: MediaItem[];
  onSeeAll: () => void;
  onItemPress: (jellyfinId: string) => void;
  onItemLongPress: (jellyfinId: string) => void;
}

export function MyListRow({ personalItems, onSeeAll, onItemPress, onItemLongPress }: Props) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const mlst = useThemedStyles(makeMyListStyles);
  const client = useJellyfinClient();
  const { isTablet } = useResponsive();
  const cardW = isTablet ? 168 : 130;

  const merged = useMemo<CarouselItem[]>(() => {
    const seen = new Set<string>();
    const result: CarouselItem[] = [];
    for (const item of personalItems) {
      if (!seen.has(item.Id)) {
        seen.add(item.Id);
        result.push({
          key: item.Id, jellyfinId: item.Id, name: item.Name, year: item.ProductionYear,
          played: item.UserData?.Played === true,
          progress: item.UserData?.PlayedPercentage ?? undefined,
        });
      }
    }
    return result;
  }, [personalItems]);

  if (merged.length === 0) return null;

  const renderItem = ({ item }: { item: CarouselItem }) => {
    const poster = client.getImageUrl(item.jellyfinId, "Primary", { width: 300, quality: 80 });
    const hasProgress = item.progress != null && item.progress > 0 && item.progress < 100;
    return (
      <Pressable
        onPress={() => onItemPress(item.jellyfinId)}
        onLongPress={() => onItemLongPress(item.jellyfinId)}
        style={[mlst.card, { width: cardW }]}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={mlst.posterWrap}>
          <Image source={{ uri: poster }} style={[mlst.poster, { width: cardW }]} contentFit="cover" transition={250} />
          {item.played && (
            <View style={mlst.watchedBadge}>
              <Feather name="check" size={11} color={theme.colors.cta.primaryFg} />
            </View>
          )}
          {hasProgress && (
            <View style={mlst.progWrap}>
              <ProgressBar progress={(item.progress ?? 0) / 100} height={3} />
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={mlst.cardName}>{item.name}</Text>
        {item.year ? <Text style={mlst.cardYear}>{item.year}</Text> : null}
      </Pressable>
    );
  };

  return (
    <View style={mlst.root}>
      <View style={mlst.header}>
        <Text style={mlst.title}>{t("toWatch")}</Text>
        <Pressable onPress={onSeeAll} hitSlop={10} style={mlst.seeAllBtn} accessibilityRole="button" accessibilityLabel={t("seeAll")}>
          <Text style={mlst.seeAll}>{t("seeAll")}</Text>
          <Feather name="chevron-right" size={14} color={theme.colors.brand.light} />
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={merged}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={mlst.list}
        decelerationRate="fast"
      />
    </View>
  );
}

const makeMyListStyles = (t: AppTheme) => StyleSheet.create({
  root: { marginTop: spacing.xxl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.screenPadding, marginBottom: 14 },
  title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, fontSize: 18, color: t.colors.text.primary, letterSpacing: -0.3 },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAll: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
  list: { paddingHorizontal: spacing.screenPadding, gap: 14 },
  card: { width: 130 },
  posterWrap: { borderRadius: RADIUS.lg, overflow: "hidden", ...SHADOW_RN.elev2 },
  poster: { width: 130, aspectRatio: 2 / 3, backgroundColor: t.colors.surface.s2 },
  cardName: { ...typography.small, fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, marginTop: 8, letterSpacing: -0.1 },
  cardYear: { ...typography.badge, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, marginTop: 2 },
  watchedBadge: { position: "absolute" as const, top: 7, right: 7, width: 22, height: 22, borderRadius: 11, backgroundColor: t.colors.cta.primaryBg, alignItems: "center" as const, justifyContent: "center" as const, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 4 }, // R11 watched unifié (cf PosterCard.tsx:90)
  progWrap: { position: "absolute" as const, bottom: 0, left: 0, right: 0, paddingHorizontal: 6, paddingBottom: 6 },
});
