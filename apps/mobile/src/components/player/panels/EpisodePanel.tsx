import { memo, useCallback, useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { seasonTitle } from "@tentacle-tv/tv-core";
import { useJellyfinClient, useMediaItem, useSeasonBrowser } from "@tentacle-tv/api-client";
import { resolveCardMarkers, type MediaItem } from "@tentacle-tv/shared";
import { CardStatusMarkers } from "@/components/cards/CardStatusMarkers";
import { useCardDeviceState } from "@/hooks/offline/useDeviceState";
import { EpisodeThumb } from "../../episodes/EpisodeThumb";
import { EpisodeBrowser } from "../episodeBrowser/EpisodeBrowser";
import { toEpisodeEntry, toSeasonEntry, type EpisodeEntry } from "../../../player/episodes/episodeBrowserModel";
import { videoAspectOf, videoRect } from "../../../player/episodes/episodeBrowserLayout";

interface Props {
  seriesId: string;
  currentEpisodeId?: string;
  initialSeasonId?: string;
  onClose: () => void;
}

/** La vignette d'un épisode à la taille de la carte OUVERTE (jusqu'à 340 pt en @3x). */
const THUMB_WIDTH = 720;
const MARKERS_STYLE = { top: 6, right: 6 } as const;

/**
 * Les épisodes de la série, depuis le serveur, dans le lecteur — la carte qui
 * s'ouvre (`EpisodeBrowser`). La même mécanique que la fiche (`useSeasonBrowser` :
 * la saison de l'épisode en cours d'emblée, voisines préchargées). Choisir un
 * épisode relance le lecteur dessus ; en séance Watch Together, le lecteur qui
 * arrive sur un autre titre le lance pour toute la salle (`wt:setItem`, le filet
 * du moteur de synchronisation), et le serveur y applique les droits du titre.
 * L'épisode en cours referme seulement la liste.
 */
export function EpisodePanel({ seriesId, currentEpisodeId, initialSeasonId, onClose }: Props) {
  const router = useRouter();
  const client = useJellyfinClient();
  const { width, height } = useWindowDimensions();
  const { t } = useTranslation("requests");
  // Le titre en lecture est déjà en cache (le lecteur l'a lu) : son format pose la rangée sous l'image.
  const { data: current } = useMediaItem(currentEpisodeId);
  const browser = useSeasonBrowser({
    seriesId,
    preferredSeasonId: initialSeasonId,
    currentEpisodeSeasonId: currentEpisodeId ? initialSeasonId : undefined,
  });

  const items = useMemo(() => browser.episodes ?? [], [browser.episodes]);
  const byId = useMemo(() => new Map(items.map((item) => [item.Id, item])), [items]);
  const episodes = useMemo(() => items.map((item) => toEpisodeEntry(item, currentEpisodeId)), [items, currentEpisodeId]);
  const seasons = useMemo(
    () => (browser.seasons ?? []).map((season) => toSeasonEntry(
      season, browser.markedSeasonId, (number, name) => seasonTitle(t, number, name),
    )),
    [browser.seasons, browser.markedSeasonId, t],
  );

  const renderArtwork = useCallback((entry: EpisodeEntry) => {
    const item = byId.get(entry.id);
    return item ? <EpisodeThumb ep={item} seriesId={seriesId} client={client} width={THUMB_WIDTH} /> : null;
  }, [byId, seriesId, client]);
  const renderMarkers = useCallback((entry: EpisodeEntry) => {
    const item = byId.get(entry.id);
    return item ? <ServerEpisodeMarkers item={item} /> : null;
  }, [byId]);
  const play = useCallback((entry: EpisodeEntry) => {
    onClose();
    if (entry.id !== currentEpisodeId) router.replace(`/watch/${entry.id}`);
  }, [onClose, router, currentEpisodeId]);

  return (
    <EpisodeBrowser
      seriesTitle={current?.SeriesName ?? ""}
      seasons={seasons}
      activeSeasonId={browser.selectedSeasonId}
      onSelectSeason={browser.select}
      onSeasonIntent={browser.prefetch}
      episodes={episodes}
      loading={browser.seasonsLoading || (browser.episodesLoading && items.length === 0)}
      renderArtwork={renderArtwork}
      renderMarkers={renderMarkers}
      onPlay={play}
      onClose={onClose}
      video={videoRect(width, height, videoAspectOf(current))}
    />
  );
}

/** La pastille d'un épisode du serveur, par le modèle des cartes : « vu », puis « sur cet appareil ». */
const ServerEpisodeMarkers = memo(function ServerEpisodeMarkers({ item }: { item: MediaItem }) {
  const device = useCardDeviceState(item);
  const markers = resolveCardMarkers({ item, communityRating: null, inWatchlist: false, isFavorite: false, device });
  return <CardStatusMarkers statuses={markers.statuses} device={markers.device} style={MARKERS_STYLE} />;
});
