import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { formatDuration } from "@tentacle-tv/shared";
import { groupWatchState, watchStateOf, type OfflineSeriesGroup } from "@tentacle-tv/offline-core";
import type { OfflineEntry } from "@/offline/engineApi";
import { SubtleBackground } from "@/components/ui";
import { SegmentedChoice } from "@/components/settings/SegmentedChoice";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { spacing, typography, FONT_FAMILY, RADIUS, useGrid, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { OfflinePosterCard } from "./OfflinePosterCard";
import { useOfflineCatalog, type OfflineCatalogFilter } from "./useOfflineCatalog";

/** Un film : sa propre affiche, sinon celle de sa « série » (collection). */
const MOVIE_ART = ["primary.jpg", "series-primary.jpg"] as const;
/** Une série : l'affiche de la série, sinon la vignette de l'épisode porteur. */
const SERIES_ART = ["series-primary.jpg", "primary.jpg"] as const;

/**
 * « Sur cet appareil » — l'accueil du mode hors ligne : ce qui se lit sans
 * réseau, et rien d'autre. Recherche sur l'appareil, filtre Tout / Films /
 * Séries, grille d'affiches 2:3 ; une série est UNE carte qui ouvre sa vue
 * locale, un film part en lecture.
 */
export function OfflineLibraryScreen() {
  const { t } = useTranslation(["offline", "downloads"]);
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const router = useRouter();
  const headerH = useHeaderHeight();
  const { itemWidth, gutter, padding } = useGrid({ phoneColumns: 3 });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<OfflineCatalogFilter>("all");
  const { movies, series, hasContent, ready } = useOfflineCatalog(search, filter);

  const filterOptions = useMemo(
    () => [
      { value: "all", label: t("downloads:filterAll") },
      { value: "movies", label: t("downloads:sectionMovies") },
      { value: "series", label: t("downloads:sectionSeries") },
    ],
    [t],
  );
  const noResult = ready && hasContent && movies.length === 0 && series.length === 0;

  const openMovie = (entry: OfflineEntry) => router.push(`/watch/${entry.itemId}` as never);
  const openSeries = (group: OfflineSeriesGroup) =>
    router.push(`/on-device/series/${encodeURIComponent(group.key)}` as never);

  return (
    <SubtleBackground ambient>
      <ScrollView
        style={st.wrap}
        contentContainerStyle={{ paddingTop: headerH + spacing.lg, paddingHorizontal: padding, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={st.title} accessibilityRole="header">{t("offline:tabOnDevice")}</Text>

        {ready && !hasContent ? (
          <View style={st.empty}>
            <Feather name="smartphone" size={40} color={theme.colors.text.quaternary} />
            <Text style={st.emptyTitle}>{t("offline:libraryEmptyTitle")}</Text>
            <Text style={st.emptyMessage}>{t("offline:libraryEmptyMessage")}</Text>
          </View>
        ) : null}

        {hasContent ? (
          <>
            <View style={st.searchBox}>
              <Feather name="search" size={16} color={theme.colors.text.tertiary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t("offline:searchPlaceholder")}
                placeholderTextColor={theme.colors.text.quaternary}
                style={st.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                accessibilityLabel={t("offline:searchPlaceholder")}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common:clear")}>
                  <Feather name="x" size={16} color={theme.colors.text.tertiary} />
                </Pressable>
              )}
            </View>
            <View style={st.filters}>
              <SegmentedChoice
                options={filterOptions}
                value={filter}
                onChange={(v) => setFilter(v as OfflineCatalogFilter)}
                accessibilityLabel={t("downloads:filterAll")}
              />
            </View>
          </>
        ) : null}

        {noResult && <Text style={st.noResult}>{t("offline:noResults")}</Text>}

        {movies.length > 0 && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>{t("downloads:sectionMovies")}</Text>
            <View style={[st.grid, { gap: gutter }]}>
              {movies.map((movie) => {
                const { watched, percent } = watchStateOf(movie);
                const title = movie.title ?? movie.itemId;
                return (
                  <OfflinePosterCard
                    key={movie.itemId}
                    title={title}
                    subtitle={formatDuration(movie.runtimeTicks)}
                    posterItemId={movie.itemId}
                    candidates={MOVIE_ART}
                    watched={watched}
                    percent={percent}
                    width={itemWidth}
                    onPress={() => openMovie(movie)}
                    accessibilityLabel={percent !== null ? `${title}, ${Math.round(percent)} %` : title}
                  />
                );
              })}
            </View>
          </View>
        )}

        {series.length > 0 && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>{t("downloads:sectionSeries")}</Text>
            <View style={[st.grid, { gap: gutter }]}>
              {series.map((group) => {
                const { watched, percent } = groupWatchState(group.seasons.flatMap((s) => s.episodes));
                const subtitle = `${t("downloads:seasonsCount", { count: group.seasons.length })} · ${t("downloads:episodesCount", { count: group.episodeCount })}`;
                return (
                  <OfflinePosterCard
                    key={group.key}
                    title={group.seriesName}
                    subtitle={subtitle}
                    posterItemId={group.posterItemId}
                    candidates={SERIES_ART}
                    watched={watched}
                    percent={percent}
                    width={itemWidth}
                    onPress={() => openSeries(group)}
                    accessibilityLabel={`${group.seriesName}, ${subtitle}`}
                  />
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { flex: 1 },
    title: { ...typography.title, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary, letterSpacing: -0.4 },
    empty: { alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingTop: 96, paddingHorizontal: spacing.xl },
    emptyTitle: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, textAlign: "center", marginTop: spacing.sm },
    emptyMessage: { ...typography.body, color: t.colors.text.tertiary, textAlign: "center", lineHeight: 20 },
    searchBox: {
      marginTop: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      borderRadius: RADIUS.xl,
      backgroundColor: t.colors.fill.subtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    searchInput: { flex: 1, ...typography.body, color: t.colors.text.primary, paddingVertical: 0 },
    filters: { marginTop: spacing.sm },
    noResult: { ...typography.body, color: t.colors.text.tertiary, textAlign: "center", marginTop: spacing.xl },
    section: { marginTop: spacing.lg },
    sectionTitle: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, marginBottom: spacing.sm },
    grid: { flexDirection: "row", flexWrap: "wrap" },
  });
