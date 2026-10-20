import { memo, useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useSeasonBrowser } from "@tentacle-tv/api-client";
import { resolveCardMarkers, type MediaItem } from "@tentacle-tv/shared";
import { cardProgress } from "@/components/cards/cardProgress";
import { useCardDeviceState } from "@/hooks/offline/useDeviceState";
import { EpisodeThumb } from "../../episodes/EpisodeThumb";
import { EpisodePanelFrame } from "./EpisodePanelFrame";
import { EpisodeStrip } from "./EpisodeStrip";
import { EpisodeTile } from "./EpisodeTile";

interface Props {
  seriesId: string;
  currentEpisodeId?: string;
  initialSeasonId?: string;
  onClose: () => void;
}

/**
 * Les épisodes de la série, depuis le serveur, dans le lecteur : la même
 * mécanique que la fiche (`useSeasonBrowser` : la saison en cours d'emblée,
 * voisines préchargées), rendue comme l'app TV d'Apple. Choisir un épisode
 * relance le lecteur dessus.
 */
export function EpisodePanel({ seriesId, currentEpisodeId, initialSeasonId, onClose }: Props) {
  const router = useRouter();
  const browser = useSeasonBrowser({
    seriesId,
    preferredSeasonId: initialSeasonId,
    currentEpisodeSeasonId: currentEpisodeId ? initialSeasonId : undefined,
  });
  const tabs = useMemo(
    () => (browser.seasons ?? []).map((season) => ({ id: season.Id, label: season.Name ?? "" })),
    [browser.seasons],
  );
  const episodes = browser.episodes ?? [];
  const currentIndex = currentEpisodeId ? episodes.findIndex((ep) => ep.Id === currentEpisodeId) : -1;
  const play = useCallback((ep: MediaItem) => { onClose(); router.replace(`/watch/${ep.Id}`); }, [onClose, router]);

  return (
    <EpisodePanelFrame
      seasons={tabs}
      activeSeasonId={browser.selectedSeasonId}
      onSelectSeason={browser.select}
      onSeasonIntent={browser.prefetch}
      loading={browser.seasonsLoading || (browser.episodesLoading && episodes.length === 0)}
      empty={episodes.length === 0}
      onClose={onClose}
    >
      {({ horizontal, cardWidth }) => (
        <EpisodeStrip
          // Changer de saison repart du début (ou de l'épisode en cours).
          key={browser.selectedSeasonId}
          items={episodes}
          keyOf={(ep) => ep.Id}
          horizontal={horizontal}
          cardWidth={cardWidth}
          currentIndex={currentIndex}
          renderTile={(ep) => (
            <ServerEpisodeTile ep={ep} seriesId={seriesId} current={ep.Id === currentEpisodeId} horizontal={horizontal} cardWidth={cardWidth} onPlay={play} />
          )}
        />
      )}
    </EpisodePanelFrame>
  );
}

interface TileProps {
  ep: MediaItem;
  seriesId: string;
  current: boolean;
  horizontal: boolean;
  cardWidth: number;
  onPlay: (ep: MediaItem) => void;
}

/** Un épisode du serveur : son état par le modèle des cartes (vu, sur cet appareil), sa barre commune. */
const ServerEpisodeTile = memo(function ServerEpisodeTile({ ep, seriesId, current, horizontal, cardWidth, onPlay }: TileProps) {
  const { t } = useTranslation(["player", "common"]);
  const client = useJellyfinClient();
  const device = useCardDeviceState(ep);
  const markers = resolveCardMarkers({ item: ep, communityRating: null, inWatchlist: false, isFavorite: false, device });
  const minutes = ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / 600_000_000) : 0;
  return (
    <EpisodeTile
      layout={horizontal ? "card" : "row"}
      width={cardWidth}
      onPress={() => onPlay(ep)}
      artwork={<EpisodeThumb ep={ep} seriesId={seriesId} client={client} />}
      model={{
        id: ep.Id,
        numberLabel: ep.IndexNumber != null ? t("player:episodeNumber", { number: ep.IndexNumber }) : undefined,
        durationLabel: minutes > 0 ? t("common:minutesShort", { count: minutes }) : undefined,
        title: ep.Name ?? "",
        overview: ep.Overview ?? undefined,
        progress: cardProgress(ep),
        statuses: markers.statuses,
        device: markers.device,
        current,
      }}
    />
  );
});
