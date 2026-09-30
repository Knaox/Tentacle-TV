import {
  buildQualityLadder,
  extractSourceQuality,
  formatBitrateMbps,
  formatDuration,
  i18n,
  type MediaItem,
  type QualityKey,
} from "@tentacle-tv/shared";
import type {
  EpisodeRowModel,
  EpisodesPanelModel,
  TrackOptionModel,
  TracksPanelModel,
} from "../../../src/redesign/screens/player/playerTypes";
import { splitTrackLabel } from "../../../src/redesign/screens/player/trackLabel";
// Le libellé d'une piste tel que l'app le calcule (`useTVTrackLists`) : même
// fonction, pour que le banc montre exactement ce que l'app montrera.
import { formatTrackLabel } from "../../../src/utils/playerHelpers";
import type { BenchData } from "./benchData";
import { progressOf } from "./models";
import { plainText, seasonEpisodes, t } from "./playerModels";

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
  const audioStreams = streams.filter((stream) => stream.Type === "Audio");
  const subtitleStreams = streams.filter((stream) => stream.Type === "Subtitle");
  const audioIndex = choice.audio ?? (audioStreams.find((stream) => stream.IsDefault) ?? audioStreams[0])?.Index;
  const subtitleIndex = choice.subtitle ?? -1;
  const audio: TrackOptionModel[] = audioStreams.map((stream) => ({
    key: String(stream.Index),
    ...splitTrackLabel(formatTrackLabel(stream)),
    selected: stream.Index === audioIndex,
  }));
  const subtitles: TrackOptionModel[] = [
    { key: "-1", label: t("player:subtitlesDisabled"), selected: subtitleIndex === -1 },
    ...subtitleStreams.map((stream) => ({
      key: String(stream.Index),
      ...splitTrackLabel(formatTrackLabel(stream)),
      selected: stream.Index === subtitleIndex,
    })),
  ];
  const quality = extractSourceQuality(item);
  const qualityKey = choice.quality ?? "original";
  const ladder: TrackOptionModel[] = buildQualityLadder(source).map((preset) => {
    const original = preset.key === "original";
    const badges = original
      ? [quality.isDolbyVision ? "DV" : null, quality.isHDR ? "HDR" : null, quality.isDolbyAtmos ? "Atmos" : null].filter((b): b is string => !!b)
      : [];
    return {
      key: preset.key,
      label: t(`player:${preset.key}`),
      detail: original ? quality.resolution ?? undefined : formatBitrateMbps(preset.bitrate),
      badges,
      selected: preset.key === qualityKey,
      auto: preset.key === qualityKey && choice.auto === true,
    };
  });
  return { audio, subtitles, quality: ladder };
}

function premiere(item: MediaItem): string | null {
  if (!item.PremiereDate) return null;
  const date = new Date(item.PremiereDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" });
}

export function episodeRowOf(data: BenchData, episode: MediaItem, current: boolean, forceWatched = false): EpisodeRowModel {
  const parts = [t("player:episodeNumber", { number: episode.IndexNumber ?? "?" })];
  const duration = formatDuration(episode.RunTimeTicks);
  if (duration) parts.push(duration);
  // L'épisode en cours porte sa pastille : la date lui laisse la place.
  const date = current ? null : premiere(episode);
  if (date) parts.push(date);
  const watched = forceWatched || episode.UserData?.Played === true;
  return {
    id: episode.Id,
    kicker: parts.join(" · "),
    title: episode.Name ?? "",
    overview: plainText(episode.Overview),
    imageUri: data.image(episode.Id, "Primary"),
    progress: watched ? undefined : progressOf(episode),
    watched,
    current,
  };
}

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
  const forced = options.forceWatchedSeason ? activeSeasonId : null;
  return {
    seriesTitle: series.Name ?? "",
    activeSeasonId,
    loading: options.loading,
    seasons: seasonIds.map((id) => {
      const season = data.item(id);
      return {
        id,
        label: season?.Name ?? "",
        count: season?.ChildCount ?? data.snapshot.episodes[id]?.length,
        current: current?.SeasonId === id,
        watched: id === forced || season?.UserData?.Played === true,
      };
    }),
    episodes: seasonEpisodes(data, activeSeasonId).map((episode) =>
      episodeRowOf(data, episode, episode.Id === options.currentId, activeSeasonId === forced),
    ),
  };
}
