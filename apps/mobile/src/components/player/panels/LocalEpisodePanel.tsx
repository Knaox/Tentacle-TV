import { useCallback, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { groupOfflineEntries, seasonLabel, watchStateOf } from "@tentacle-tv/offline-core";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import type { OfflineEntry } from "@/offline/engineApi";
import { OfflineLocalImage } from "@/offline/library/OfflineLocalImage";
import { EpisodePanelFrame } from "./EpisodePanelFrame";
import { EpisodeStrip } from "./EpisodeStrip";
import { EpisodeTile } from "./EpisodeTile";

interface Props {
  seriesId: string;
  currentEpisodeId: string;
  onClose: () => void;
}

const WATCHED: readonly ["watched"] = ["watched"];
const NONE: readonly [] = [];
const ARTWORK = ["primary.jpg", "series-primary.jpg"];

/**
 * Les épisodes d'une lecture LOCALE : ceux de la série gardés complets sur
 * l'appareil, par saison, vignette locale comprise — rien ne part sur le
 * réseau. Même panneau que la lecture en ligne.
 */
export function LocalEpisodePanel({ seriesId, currentEpisodeId, onClose }: Props) {
  const router = useRouter();
  const { t } = useTranslation(["player", "downloads"]);
  const userId = useUserId();
  const { data } = useOfflineList(userId);

  const seasons = useMemo(() => {
    const complete = (data ?? []).filter((entry) => entry.status === "complete" && entry.kind === "episode" && entry.seriesId === seriesId);
    return groupOfflineEntries(complete).seasons.map((season) => ({
      id: season.key,
      label: seasonLabel((key, options) => t(`downloads:${key.replace(/^downloads:/, "")}`, options), season.seasonNumber),
      episodes: season.episodes,
    }));
  }, [data, seriesId, t]);

  // La saison de l'épisode en cours d'abord, puis celle que l'on choisit.
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const activeId = chosen
    ?? seasons.find((season) => season.episodes.some((entry) => entry.itemId === currentEpisodeId))?.id
    ?? seasons[0]?.id;
  const episodes = seasons.find((season) => season.id === activeId)?.episodes ?? [];
  const currentIndex = episodes.findIndex((entry) => entry.itemId === currentEpisodeId);
  const play = useCallback((entry: OfflineEntry) => { onClose(); router.replace(`/watch/${entry.itemId}`); }, [onClose, router]);

  return (
    <EpisodePanelFrame
      seasons={seasons}
      activeSeasonId={activeId}
      onSelectSeason={setChosen}
      loading={data === undefined}
      empty={episodes.length === 0}
      onClose={onClose}
    >
      {({ horizontal, cardWidth }) => (
        <EpisodeStrip
          key={activeId}
          items={episodes}
          keyOf={(entry) => entry.itemId}
          horizontal={horizontal}
          cardWidth={cardWidth}
          currentIndex={currentIndex}
          renderTile={(entry) => {
            const watch = watchStateOf(entry);
            return (
              <EpisodeTile
                layout={horizontal ? "card" : "row"}
                width={cardWidth}
                onPress={() => play(entry)}
                artwork={<OfflineLocalImage itemId={entry.itemId} candidates={ARTWORK} style={StyleSheet.absoluteFill} />}
                model={{
                  id: entry.itemId,
                  numberLabel: entry.indexNumber != null ? t("player:episodeNumber", { number: entry.indexNumber }) : undefined,
                  title: entry.title ?? entry.itemId,
                  progress: watch.watched ? null : watch.percent,
                  statuses: watch.watched ? WATCHED : NONE,
                  current: entry.itemId === currentEpisodeId,
                }}
              />
            );
          }}
        />
      )}
    </EpisodePanelFrame>
  );
}
