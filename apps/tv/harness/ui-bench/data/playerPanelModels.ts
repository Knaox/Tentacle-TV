import {
  buildQualityLadder,
  extractSourceQuality,
  i18n,
  type MediaItem,
  type QualityKey,
} from "@tentacle-tv/shared";
import type { EpisodesPanelModel, TracksPanelModel } from "../../../src/redesign/screens/player/playerTypes";
// Le libellé d'une piste tel que l'app le calcule (`useTVTrackLists`), et les
// MÊMES projections que le lecteur Apple TV (`redesignWiring/player`) : le
// banc montre exactement ce que l'app montrera.
import { formatTrackLabel } from "../../../src/utils/playerHelpers";
import type { ImageUrl } from "../../../src/redesignWiring/player/playerArt";
import { buildEpisodesPanel, buildTracksPanel } from "../../../src/redesignWiring/player/playerPanelModels";
import type { BenchData } from "./benchData";
import { seasonEpisodes, t } from "./playerModels";

/**
 * Les deux panneaux du lecteur, sur les vraies données : les pistes d'un
 * élément (`MediaSources[0].MediaStreams`, `buildQualityLadder`,
 * `extractSourceQuality`) et les saisons/épisodes d'une série.
 */

export interface TrackChoice {
  /** Index Jellyfin de la piste audio ; défaut : la piste par défaut. */
  audio?: number;
  /** Index Jellyfin des sous-titres ; -1 : désactivés (défaut). */
  subtitle?: number;
  quality?: QualityKey;
  /** Le palier retenu vient du plafond automatique de débit. */
  auto?: boolean;
}

export function tracksOf(item: MediaItem, choice: TrackChoice = {}): TracksPanelModel {
  const source = item.MediaSources?.[0];
  const streams = source?.MediaStreams ?? [];
  const tracks = (type: "Audio" | "Subtitle") =>
    streams.filter((stream) => stream.Type === type).map((stream) => ({ index: stream.Index, label: formatTrackLabel(stream) }));
  const audioStreams = streams.filter((stream) => stream.Type === "Audio");
  const audioIndex = choice.audio ?? (audioStreams.find((stream) => stream.IsDefault) ?? audioStreams[0])?.Index ?? -1;
  return buildTracksPanel({
    audio: tracks("Audio"),
    subtitles: tracks("Subtitle"),
    audioIndex,
    subtitleIndex: choice.subtitle ?? -1,
    qualityKey: choice.quality ?? "original",
    qualityPresets: buildQualityLadder(source),
    source: extractSourceQuality(item),
    autoCap: choice.auto === true,
    t,
  });
}

const imageOf = (data: BenchData): ImageUrl => (id, type) => data.image(id, type);

/**
 * Le panneau des épisodes d'une série, ouvert sur la saison `seasonIndex`.
 * `forceWatchedSeason` : l'état « saison vue », qu'aucune série du compte de
 * test n'a — posé À LA MAIN pour montrer la coche (scène étiquetée).
 */
export function episodesPanelOf(
  data: BenchData,
  series: MediaItem,
  seasonIndex: number,
  options: { currentId?: string; loading?: boolean; forceWatchedSeason?: boolean } = {},
): EpisodesPanelModel {
  const seasonIds = data.snapshot.seasons[series.Id] ?? [];
  const current = options.currentId ? data.item(options.currentId) : undefined;
  const activeSeasonId = seasonIds[seasonIndex] ?? seasonIds[0] ?? "";
  const panel = buildEpisodesPanel({
    seriesTitle: series.Name ?? "",
    seasons: data.items(seasonIds),
    activeSeasonId,
    currentSeasonId: current?.SeasonId,
    episodes: seasonEpisodes(data, activeSeasonId),
    currentEpisodeId: options.currentId,
    loading: options.loading === true,
    image: imageOf(data),
    t,
    locale: i18n.language,
  });
  const forced = options.forceWatchedSeason === true;
  return {
    ...panel,
    // L'instantané n'a pas toujours le compte d'une saison : ses épisodes le donnent.
    seasons: panel.seasons.map((season) => ({
      ...season,
      count: season.count ?? data.snapshot.episodes[season.id]?.length,
      watched: season.watched || (forced && season.id === activeSeasonId),
    })),
    episodes: forced ? panel.episodes.map((row) => ({ ...row, watched: true, progress: undefined })) : panel.episodes,
  };
}
