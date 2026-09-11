import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { formatDuration } from "@tentacle-tv/shared";
import { groupWatchState, watchStateOf, type OfflineSeriesGroup } from "@tentacle-tv/offline-core";
import { RowHeader } from "@/components/RowHeader";
import { homeRowFadeDelay } from "@/components/home/homeRowFade";
import { Badge, FadeIn } from "@/components/ui";
import type { OfflineEntry } from "@/offline/engineApi";
import { spacing, type GridLayout } from "@/theme";
import { MOVIE_ART, SERIES_ART } from "./offlineArt";
import type { MediaItem } from "@tentacle-tv/shared";
import { OfflinePosterCard } from "./OfflinePosterCard";
import { useLocalSnapshotJson } from "@/hooks/offline/useLocalSnapshot";

interface Props {
  movies: readonly OfflineEntry[];
  series: readonly OfflineSeriesGroup[];
  layout: GridLayout;
  /** Rang de la première section dans la cascade d'entrée de la page. */
  fadeIndex: number;
  onMovie: (entry: OfflineEntry) => void;
  onMovieLongPress: (entry: OfflineEntry) => void;
  onSeries: (group: OfflineSeriesGroup) => void;
}

/**
 * Les sections Films et Séries du catalogue local : un en-tête de rangée avec
 * le compte, puis une GRILLE d'affiches (un catalogue fini se cherche et se
 * filtre en entier — une rangée cacherait tout ce qui dépasse).
 */
export function OfflineCatalogSections({ movies, series, layout, fadeIndex, onMovie, onMovieLongPress, onSeries }: Props) {
  const { t } = useTranslation(["offline", "downloads"]);
  const grid = [styles.grid, { gap: layout.gutter, paddingHorizontal: layout.padding }];

  return (
    <>
      {movies.length > 0 && (
        <FadeIn delay={homeRowFadeDelay(fadeIndex)}>
          <View style={styles.section}>
            <RowHeader title={t("downloads:sectionMovies")} accessory={<Badge label={String(movies.length)} variant="muted" />} />
            <View style={grid}>
              {movies.map((movie) => {
                const { watched, percent } = watchStateOf(movie);
                const title = movie.title ?? movie.itemId;
                return (
                  <MovieTile
                    key={movie.itemId}
                    itemId={movie.itemId}
                    title={title}
                    subtitle={formatDuration(movie.runtimeTicks)}
                    posterItemId={movie.itemId}
                    candidates={MOVIE_ART}
                    watched={watched}
                    percent={percent}
                    width={layout.itemWidth}
                    onPress={() => onMovie(movie)}
                    onLongPress={() => onMovieLongPress(movie)}
                    accessibilityLabel={percent !== null ? `${title}, ${Math.round(percent)} %` : title}
                  />
                );
              })}
            </View>
          </View>
        </FadeIn>
      )}

      {series.length > 0 && (
        <FadeIn delay={homeRowFadeDelay(fadeIndex + 1)}>
          <View style={styles.section}>
            <RowHeader title={t("downloads:sectionSeries")} accessory={<Badge label={String(series.length)} variant="muted" />} />
            <View style={grid}>
              {series.map((group) => {
                const { watched, percent } = groupWatchState(group.seasons.flatMap((season) => season.episodes));
                const subtitle = `${t("downloads:seasonsCount", { count: group.seasons.length })} · ${t("downloads:episodesCount", { count: group.episodeCount })}`;
                return (
                  <SeriesTile
                    key={group.key}
                    posterItemIdForRating={group.posterItemId}
                    title={group.seriesName}
                    subtitle={subtitle}
                    posterItemId={group.posterItemId}
                    candidates={SERIES_ART}
                    watched={watched}
                    percent={percent}
                    countBadge={t("offline:episodesShort", { count: group.episodeCount })}
                    width={layout.itemWidth}
                    onPress={() => onSeries(group)}
                    accessibilityLabel={`${group.seriesName}, ${subtitle}`}
                  />
                );
              })}
            </View>
          </View>
        </FadeIn>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xxl },
  grid: { flexDirection: "row", flexWrap: "wrap" },
});

/**
 * Une carte de film, plus sa note.
 *
 * Un composant plutôt qu'un appel en ligne dans le `.map()` : la note se lit
 * dans le snapshot du disque, donc par un hook, et un hook ne s'appelle pas
 * dans une boucle. Aucune requête réseau — le fichier est déjà là, le moteur
 * enregistre le DTO brut au téléchargement.
 */
function MovieTile({
  itemId,
  ...props
}: { itemId: string } & React.ComponentProps<typeof OfflinePosterCard>) {
  const { data } = useLocalSnapshotJson<MediaItem>(itemId, "item.json");
  return <OfflinePosterCard {...props} rating={data?.CommunityRating ?? null} />;
}

/** Idem pour un groupe de saisons — `series.json`, donc la note de la SÉRIE. */
function SeriesTile({
  posterItemIdForRating,
  ...props
}: { posterItemIdForRating: string } & React.ComponentProps<typeof OfflinePosterCard>) {
  const { data } = useLocalSnapshotJson<MediaItem>(posterItemIdForRating, "series.json");
  return <OfflinePosterCard {...props} rating={data?.CommunityRating ?? null} />;
}
