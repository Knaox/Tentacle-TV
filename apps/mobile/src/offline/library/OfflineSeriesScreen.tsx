import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { groupOfflineEntries, groupSeasonsBySeries, seasonLabel } from "@tentacle-tv/offline-core";
import { SubtleBackground } from "@/components/ui";
import { SeasonPills } from "@/components/episodes/SeasonPills";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { useLocalSnapshotJson } from "@/hooks/offline/useLocalSnapshot";
import type { OfflineEntry } from "@/offline/engineApi";
import { backOrHome } from "@/utils/backOrHome";
import { spacing, typography, FONT_FAMILY, useGrid, useResponsive, useThemedStyles, type AppTheme } from "@/theme";
import { OfflineLocalImage } from "./OfflineLocalImage";
import { OfflineEpisodeCard } from "./OfflineEpisodeCard";

/** La bannière de la série, sinon son affiche. */
const BANNER_ART = ["backdrop.jpg", "series-primary.jpg"] as const;

/**
 * La vue d'une série gardée sur l'appareil : bannière locale, synopsis du
 * snapshot, pilules de saison, cartes 16:9 des épisodes. Tout vient des
 * fichiers du snapshot — cet écran ne touche jamais le réseau.
 */
export function OfflineSeriesScreen() {
  const { seriesKey } = useLocalSearchParams<{ seriesKey: string }>();
  const { t } = useTranslation(["offline", "downloads", "common"]);
  const st = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useResponsive();
  const { itemWidth, gutter, padding } = useGrid({ phoneColumns: 1, targetTablet: 320, maxColumns: 3 });
  const userId = useUserId();
  const { data, isFetched } = useOfflineList(userId);
  const [seasonKey, setSeasonKey] = useState<string | null>(null);

  const series = useMemo(() => {
    const complete = (data ?? []).filter((e) => e.status === "complete");
    const { seasons } = groupOfflineEntries(complete);
    return groupSeasonsBySeries(seasons).find((s) => s.key === seriesKey) ?? null;
  }, [data, seriesKey]);

  // La saison choisie peut disparaître (dernier épisode retiré) : on retombe
  // sur la première plutôt que sur une page vide.
  const season = series?.seasons.find((s) => s.key === seasonKey) ?? series?.seasons[0] ?? null;

  // La saison porte le synopsis le plus pertinent ; la série prend le relais.
  const { data: seasonSnapshot } = useLocalSnapshotJson<{ Overview?: string }>(season?.posterItemId, "season.json");
  const { data: seriesSnapshot } = useLocalSnapshotJson<{ Overview?: string }>(series?.posterItemId, "series.json");
  const overview = (seasonSnapshot?.Overview ?? seriesSnapshot?.Overview ?? "").replace(/<[^>]+>/g, "").trim();

  // Le dernier épisode retiré fait disparaître la série : retour au catalogue.
  useEffect(() => {
    if (isFetched && !series) backOrHome(router);
  }, [isFetched, series, router]);

  const seasonItems = useMemo<MediaItem[]>(
    () => (series?.seasons ?? []).map((s) => ({ Id: s.key, Name: seasonLabel(t, s.seasonNumber), Type: "Season" }) as MediaItem),
    [series, t],
  );

  const play = (entry: OfflineEntry) => router.push(`/watch/${entry.itemId}` as never);

  if (!series || !season) return <SubtleBackground ambient><View style={st.wrap} /></SubtleBackground>;

  const meta = [
    series.seasons.length > 1
      ? t("downloads:seasonsCount", { count: series.seasons.length })
      : seasonLabel(t, season.seasonNumber),
    t("downloads:episodesCount", { count: series.episodeCount }),
  ].join(" · ");
  const bannerHeight = Math.min(Math.round(width * 9 / 16), 360);

  return (
    <SubtleBackground ambient>
      <ScrollView style={st.wrap} contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        <View style={[st.banner, { height: bannerHeight + insets.top }]}>
          <OfflineLocalImage itemId={series.posterItemId} candidates={BANNER_ART} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0)", "rgba(0,0,0,0.85)"]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
          <Pressable
            onPress={() => backOrHome(router)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("common:back")}
            style={[st.back, { top: insets.top + 8, left: padding }]}
          >
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <View style={[st.bannerText, { paddingHorizontal: padding }]}>
            <Text style={st.title} accessibilityRole="header" numberOfLines={2}>{series.seriesName}</Text>
            <Text style={st.meta}>{meta}</Text>
          </View>
        </View>

        {overview.length > 0 && (
          <Text style={[st.overview, { paddingHorizontal: padding }]} numberOfLines={4}>{overview}</Text>
        )}

        <View style={{ marginTop: spacing.lg }}>
          {seasonItems.length > 1 && (
            <SeasonPills seasons={seasonItems} activeSeasonId={season.key} onSelect={setSeasonKey} />
          )}
          <View style={[st.grid, { paddingHorizontal: padding, gap: gutter }]}>
            {season.episodes.map((episode) => (
              <OfflineEpisodeCard key={episode.itemId} entry={episode} width={itemWidth} onSelect={play} onPlay={play} />
            ))}
          </View>
        </View>
      </ScrollView>
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { flex: 1 },
    banner: { backgroundColor: t.colors.surface.s2, justifyContent: "flex-end" },
    back: {
      position: "absolute",
      zIndex: 2,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    bannerText: { paddingBottom: spacing.md, gap: 4 },
    title: {
      ...typography.title,
      fontFamily: FONT_FAMILY.extrabold,
      color: "#fff",
      letterSpacing: -0.4,
      textShadowColor: "rgba(0,0,0,0.7)",
      textShadowRadius: 10,
    },
    meta: { ...typography.small, color: "rgba(255,255,255,0.78)" },
    overview: { ...typography.body, color: t.colors.text.secondary, lineHeight: 21, marginTop: spacing.md },
    grid: { flexDirection: "row", flexWrap: "wrap" },
  });
