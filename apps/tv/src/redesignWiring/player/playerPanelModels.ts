import {
  formatBitrateMbps,
  formatDuration,
  type MediaItem,
  type QualityKey,
  type QualityPreset,
  type SourceQuality,
} from "@tentacle-tv/shared";
import type { Translate } from "../../redesign/screens/player/playerLabels";
import type {
  EpisodeRowModel,
  EpisodesPanelModel,
  TrackOptionModel,
  TracksPanelModel,
} from "../../redesign/screens/player/playerTypes";
import { splitTrackLabel } from "../../redesign/screens/player/trackLabel";
import { plainText, type ImageUrl } from "./playerArt";

/**
 * Les deux panneaux du lecteur, projetés dans le contrat de la vue : les
 * pistes (celles que `useTVTrackLists` propose, les paliers de
 * `buildQualityLadder`) et les épisodes d'une saison (`useSeasonBrowser`).
 */

interface Track {
  index: number;
  label: string;
}

/** Les sous-titres éteints : une option comme les autres, clé « -1 ». */
export const SUBTITLES_OFF_KEY = "-1";

export function buildTracksPanel(args: {
  audio: readonly Track[];
  subtitles: readonly Track[];
  audioIndex: number;
  subtitleIndex: number;
  qualityKey: QualityKey;
  qualityPresets: readonly QualityPreset[];
  source: SourceQuality | undefined;
  /** Le palier retenu vient du plafond automatique de débit : « Auto ». */
  autoCap: boolean;
  t: Translate;
}): TracksPanelModel {
  const { source, t } = args;
  const option = (track: Track, selected: boolean): TrackOptionModel => ({
    key: String(track.index),
    ...splitTrackLabel(track.label),
    selected,
  });
  const quality = args.qualityPresets.map((preset): TrackOptionModel => {
    const original = preset.key === "original";
    const selected = preset.key === args.qualityKey;
    const badges = original && source
      ? [source.isDolbyVision ? "DV" : null, source.isHDR ? "HDR" : null, source.isDolbyAtmos ? "Atmos" : null]
        .filter((badge): badge is string => badge !== null)
      : [];
    return {
      key: preset.key,
      label: t(`player:${preset.key}`),
      detail: original ? (source?.resolution ?? undefined) : formatBitrateMbps(preset.bitrate) || undefined,
      badges,
      selected,
      auto: selected && args.autoCap,
    };
  });
  return {
    audio: args.audio.map((track) => option(track, track.index === args.audioIndex)),
    subtitles: [
      { key: SUBTITLES_OFF_KEY, label: t("player:subtitlesDisabled"), selected: args.subtitleIndex === -1 },
      ...args.subtitles.map((track) => option(track, track.index === args.subtitleIndex)),
    ],
    quality,
  };
}

function premiereOf(item: MediaItem, locale: string): string | null {
  if (!item.PremiereDate) return null;
  const date = new Date(item.PremiereDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

/** 0 à 1, ou rien s'il n'y a rien à reprendre. */
function progressOf(item: MediaItem): number | undefined {
  const percent = item.UserData?.PlayedPercentage ?? 0;
  return item.UserData?.Played || percent <= 0 ? undefined : percent / 100;
}

/** « Épisode 3 · 58min · 23 nov. 1999 » — l'épisode en cours laisse sa date à sa pastille. */
export function buildEpisodeRow(
  episode: MediaItem,
  context: { current: boolean; image: ImageUrl; t: Translate; locale: string },
): EpisodeRowModel {
  const { current, t } = context;
  const parts = [t("player:episodeNumber", { number: episode.IndexNumber ?? "?" }), formatDuration(episode.RunTimeTicks)];
  if (!current) parts.push(premiereOf(episode, context.locale));
  const watched = episode.UserData?.Played === true;
  return {
    id: episode.Id,
    kicker: parts.filter((part): part is string => !!part).join(" · "),
    title: episode.Name ?? "",
    overview: plainText(episode.Overview),
    // La vignette à deux fois sa largeur en points : l'Apple TV 4K rend à ×2.
    imageUri: context.image(episode.Id, "Primary", { width: 512, quality: 80 }),
    progress: watched ? undefined : progressOf(episode),
    watched,
    current,
  };
}

export function buildEpisodesPanel(args: {
  seriesTitle: string;
  seasons: readonly MediaItem[] | undefined;
  activeSeasonId: string | undefined;
  /** La saison de l'épisode en cours de lecture. */
  currentSeasonId: string | undefined;
  episodes: readonly MediaItem[] | undefined;
  currentEpisodeId: string | undefined;
  loading: boolean;
  image: ImageUrl;
  t: Translate;
  locale: string;
}): EpisodesPanelModel {
  const { t } = args;
  return {
    seriesTitle: args.seriesTitle,
    activeSeasonId: args.activeSeasonId ?? "",
    loading: args.loading || !args.episodes,
    seasons: (args.seasons ?? []).map((season) => ({
      id: season.Id,
      label: season.Name ?? "",
      count: season.ChildCount ?? undefined,
      current: season.Id === args.currentSeasonId,
      watched: season.UserData?.Played === true,
    })),
    episodes: (args.episodes ?? []).map((episode) =>
      buildEpisodeRow(episode, { current: episode.Id === args.currentEpisodeId, image: args.image, t, locale: args.locale }),
    ),
  };
}
