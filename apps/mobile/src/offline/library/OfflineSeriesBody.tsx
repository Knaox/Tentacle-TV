import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { keptBytes, localVersionOfGroup } from "@tentacle-tv/offline-core";
import type { MediaItem } from "@tentacle-tv/shared";
import { CastRow } from "@/components/CastRow";
import { DetailFacts } from "@/components/detail/DetailFacts";
import { SeasonPills } from "@/components/episodes/SeasonPills";
import { Badge } from "@/components/ui";
import type { OfflineEntry } from "@/offline/engineApi";
import { formatBytes } from "@/offline/formatBytes";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { makeMediaDetailStyles } from "@/screens/mediaDetailStyles";
import { spacing, CONTENT_MAX_WIDTH, useThemedStyles } from "@/theme";
import { OfflineDeviceCard, type DeviceFact } from "./OfflineDeviceCard";
import { OfflineEpisodeRow } from "./OfflineEpisodeRow";
import { OfflineOverview } from "./OfflineOverview";
import { addedOnText, versionText } from "./localText";

interface Props {
  seriesItem: MediaItem;
  /** Tous les épisodes gardés de la série — la carte « Sur cet appareil » les compte. */
  allEpisodes: readonly OfflineEntry[];
  seasonCount: number;
  genres: string[];
  overview: string;
  people: NonNullable<MediaItem["People"]>;
  seasonItems: MediaItem[];
  activeSeasonKey: string;
  onSelectSeason: (key: string) => void;
  /** Les épisodes de la saison affichée. */
  episodes: OfflineEntry[];
  currentEpisodeId?: string;
  onPlay: (entry: OfflineEntry) => void;
  onMore: (entry: OfflineEntry) => void;
}

/**
 * Le corps de la fiche locale d'une série — dans l'ordre de `DetailBody` :
 * genres, synopsis, « Saisons & Épisodes » (pilules de saison et lignes
 * d'épisodes gardés ici), la carte « Sur cet appareil » (version, place,
 * épisodes, dernier arrivé), le casting sans photo, puis « Informations ».
 */
export function OfflineSeriesBody({
  seriesItem, allEpisodes, seasonCount, genres, overview, people, seasonItems, activeSeasonKey, onSelectSeason,
  episodes, currentEpisodeId, onPlay, onMore,
}: Props) {
  const { t, i18n } = useTranslation(["common", "offline", "downloads"]);
  const st = useThemedStyles(makeMediaDetailStyles);
  const offline = useOfflineMode();
  const summary = [versionText(t, localVersionOfGroup(allEpisodes)), formatBytes(keptBytes(allEpisodes))].filter(Boolean).join(" · ");
  const newest = allEpisodes.reduce<OfflineEntry | null>((best, e) => (best === null || e.createdAt > best.createdAt ? e : best), null);
  const added = newest ? addedOnText(newest.createdAt, i18n.language || "fr") : null;
  const facts: DeviceFact[] = [
    {
      key: "episodes",
      label: t("offline:detailEpisodes"),
      value: `${t("downloads:episodesCount", { count: allEpisodes.length })} · ${t("common:seasonsCount", { count: seasonCount })}`,
    },
  ];
  if (added) facts.push({ key: "added", label: t("offline:detailLastAdded"), value: added });

  return (
    <View>
      {genres.length > 0 && (
        <View style={[st.genreRow, { maxWidth: CONTENT_MAX_WIDTH }]}>
          {genres.slice(0, 6).map((genre) => <Badge key={genre} label={genre} variant="muted" uppercase={false} />)}
        </View>
      )}
      <OfflineOverview text={overview} />

      <Text style={st.sectionTitle}>{t("common:seasonsEpisodes")}</Text>
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
          />
        ))}
      </View>

      <OfflineDeviceCard summary={summary} facts={facts} />
      {people.length > 0 && <CastRow people={people} readOnly={offline} />}
      <DetailFacts item={seriesItem} />
    </View>
  );
}
