import { useCallback, useMemo, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { groupOfflineEntries, groupWatchState, seasonLabel, watchStateOf } from "@tentacle-tv/offline-core";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { OfflineLocalImage } from "@/offline/library/OfflineLocalImage";
import { EpisodeBrowser } from "../episodeBrowser/EpisodeBrowser";
import { toLocalEpisodeEntry, type EpisodeEntry, type SeasonEntry } from "../../../player/episodes/episodeBrowserModel";
import { videoRect } from "../../../player/episodes/episodeBrowserLayout";

interface Props {
  seriesId: string;
  currentEpisodeId: string;
  onClose: () => void;
}

const ARTWORK = ["primary.jpg", "series-primary.jpg"];

/**
 * Les épisodes d'une lecture LOCALE : ceux de la série gardés complets sur
 * l'appareil, par saison, vignette locale comprise — rien ne part sur le
 * réseau. La même carte qui s'ouvre que la lecture en ligne.
 */
export function LocalEpisodePanel({ seriesId, currentEpisodeId, onClose }: Props) {
  const router = useRouter();
  const { t } = useTranslation(["player", "downloads"]);
  const userId = useUserId();
  const { data } = useOfflineList(userId);
  const { width, height } = useWindowDimensions();

  const groups = useMemo(() => {
    const complete = (data ?? []).filter((entry) => entry.status === "complete" && entry.kind === "episode" && entry.seriesId === seriesId);
    return groupOfflineEntries(complete).seasons;
  }, [data, seriesId]);
  const playingSeason = groups.find((season) => season.episodes.some((entry) => entry.itemId === currentEpisodeId))?.key;

  // La saison de l'épisode en cours d'abord, puis celle que l'on choisit.
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const activeId = chosen ?? playingSeason ?? groups[0]?.key;
  const seasons = useMemo<SeasonEntry[]>(() => groups.map((season) => ({
    id: season.key,
    label: seasonLabel((key, options) => t(`downloads:${key.replace(/^downloads:/, "")}`, options), season.seasonNumber),
    count: season.episodes.length,
    watched: groupWatchState(season.episodes).watched,
    current: season.key === playingSeason,
  })), [groups, playingSeason, t]);
  const episodes = useMemo(
    () => (groups.find((season) => season.key === activeId)?.episodes ?? [])
      .map((entry) => toLocalEpisodeEntry(entry, watchStateOf(entry), currentEpisodeId)),
    [groups, activeId, currentEpisodeId],
  );

  const renderArtwork = useCallback((entry: EpisodeEntry) => (
    <OfflineLocalImage itemId={entry.id} candidates={ARTWORK} style={StyleSheet.absoluteFill} />
  ), []);
  const play = useCallback((entry: EpisodeEntry) => {
    onClose();
    if (entry.id !== currentEpisodeId) router.replace(`/watch/${entry.id}`);
  }, [onClose, router, currentEpisodeId]);

  return (
    <EpisodeBrowser
      seriesTitle={groups[0]?.seriesName ?? ""}
      seasons={seasons}
      activeSeasonId={activeId}
      onSelectSeason={setChosen}
      episodes={episodes}
      loading={data === undefined}
      renderArtwork={renderArtwork}
      onPlay={play}
      onClose={onClose}
      // Hors ligne, le format du fichier n'est pas relu : 16:9, le cas courant.
      video={videoRect(width, height)}
    />
  );
}
