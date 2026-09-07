import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { CastRow } from "@/components/CastRow";
import { SeasonPills } from "@/components/episodes/SeasonPills";
import { Badge } from "@/components/ui";
import type { OfflineEntry } from "@/offline/engineApi";
import { makeMediaDetailStyles } from "@/screens/mediaDetailStyles";
import { spacing, CONTENT_MAX_WIDTH, useThemedStyles } from "@/theme";
import { OfflineEpisodeRow } from "./OfflineEpisodeRow";
import { OfflineOverview } from "./OfflineOverview";

interface Props {
  genres: string[];
  overview: string;
  people: NonNullable<MediaItem["People"]>;
  seasonItems: MediaItem[];
  activeSeasonKey: string;
  onSelectSeason: (key: string) => void;
  episodes: OfflineEntry[];
  currentEpisodeId?: string;
  onPlay: (entry: OfflineEntry) => void;
  onMore: (entry: OfflineEntry) => void;
  onToggleWatched: (entry: OfflineEntry, played: boolean) => void;
}

/**
 * Le corps de la vue série locale — le jumeau de `DetailBody` : genres,
 * synopsis, casting (initiales, zéro réseau), puis « Saisons & Épisodes » :
 * pilules de saison et lignes d'épisodes de la saison choisie.
 */
export function OfflineSeriesBody({
  genres, overview, people, seasonItems, activeSeasonKey, onSelectSeason, episodes, currentEpisodeId, onPlay, onMore, onToggleWatched,
}: Props) {
  const { t } = useTranslation("common");
  const st = useThemedStyles(makeMediaDetailStyles);
  return (
    <View>
      {genres.length > 0 && (
        <View style={[st.genreRow, { maxWidth: CONTENT_MAX_WIDTH }]}>
          {genres.slice(0, 6).map((genre) => <Badge key={genre} label={genre} variant="muted" uppercase={false} />)}
        </View>
      )}
      <OfflineOverview text={overview} />
      {people.length > 0 && <CastRow people={people} />}

      <Text style={st.sectionTitle}>{t("seasonsEpisodes")}</Text>
      {seasonItems.length > 1 && (
        <SeasonPills seasons={seasonItems} activeSeasonId={activeSeasonKey} onSelect={onSelectSeason} />
      )}
      <View style={{ paddingHorizontal: spacing.screenPadding, gap: 8, maxWidth: CONTENT_MAX_WIDTH, marginTop: seasonItems.length > 1 ? 0 : spacing.sm }}>
        {episodes.map((entry) => (
          <OfflineEpisodeRow
            key={entry.itemId}
            entry={entry}
            isCurrent={entry.itemId === currentEpisodeId}
            onPlay={onPlay}
            onMore={onMore}
            onToggleWatched={onToggleWatched}
          />
        ))}
      </View>
    </View>
  );
}
