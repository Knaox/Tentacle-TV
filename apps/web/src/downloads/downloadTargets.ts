/**
 * Construction des entrées d'enqueue à partir des DTOs Jellyfin (MediaItem).
 * Centralise : extension de conteneur, taille exacte/estimée, side-cars de
 * sous-titres texte (externes pour l'Original — les pistes internes sont déjà
 * dans le fichier ; TOUTES les pistes texte pour l'Allégé — le transcode ne
 * conserve pas les flux de sous-titres).
 */

import type { MediaItem } from "@tentacle-tv/shared";
import type { EnqueueItemInput, SubtitleSideCarInput } from "./api";
import { estimateLightSizeBytes, type LightPresetId } from "./presets";

interface MediaStreamLike {
  Type?: string;
  Index?: number;
  Codec?: string;
  Language?: string;
  IsExternal?: boolean;
  IsForced?: boolean;
  IsHearingImpaired?: boolean;
  DisplayTitle?: string;
}

const TEXT_SUB_CODECS = new Set(["srt", "subrip", "ass", "ssa", "vtt", "webvtt", "sub", "text", "mov_text"]);
const IMAGE_SUB_CODECS = new Set(["pgs", "pgssub", "hdmv_pgs_subtitle", "dvdsub", "dvd_subtitle", "vobsub"]);

export interface DownloadOptions {
  variant: "original" | "light";
  preset: LightPresetId;
  autoDeleteAfterWatch: boolean;
  audioStreamIndex?: number;
  burnSubtitleIndex?: number;
}

function primarySource(item: MediaItem) {
  return item.MediaSources?.[0];
}

export function containerExt(item: MediaItem): string {
  const container = primarySource(item)?.Container ?? "";
  const first = container.split(",")[0]?.trim().toLowerCase() ?? "";
  return /^[a-z0-9]{1,5}$/.test(first) ? first : "mkv";
}

function streams(item: MediaItem): MediaStreamLike[] {
  return (primarySource(item)?.MediaStreams ?? []) as MediaStreamLike[];
}

export function audioTracks(item: MediaItem): MediaStreamLike[] {
  return streams(item).filter((s) => s.Type === "Audio" && typeof s.Index === "number");
}

/** Sous-titres image (PGS/VobSub) — proposables en burn-in Allégé uniquement. */
export function imageSubtitleTracks(item: MediaItem): MediaStreamLike[] {
  return streams(item).filter(
    (s) =>
      s.Type === "Subtitle" &&
      typeof s.Index === "number" &&
      IMAGE_SUB_CODECS.has((s.Codec ?? "").toLowerCase()),
  );
}

function isTextSubtitle(stream: MediaStreamLike): boolean {
  return stream.Type === "Subtitle" && TEXT_SUB_CODECS.has((stream.Codec ?? "").toLowerCase());
}

function sideCarFormat(codec: string): SubtitleSideCarInput["format"] {
  const lower = codec.toLowerCase();
  if (lower === "ass" || lower === "ssa") return "ass";
  if (lower === "vtt" || lower === "webvtt") return "vtt";
  return "srt";
}

function langTag(stream: MediaStreamLike): string {
  const parts: string[] = [(stream.Language ?? "und").toLowerCase()];
  if (stream.IsForced) parts.push("forced");
  if (stream.IsHearingImpaired) parts.push("sdh");
  return parts.join("-").replace(/[^a-z0-9-]/g, "");
}

/** Side-cars texte : externes seulement (Original) ou toutes pistes texte (Allégé). */
export function subtitleSideCars(
  item: MediaItem,
  variant: "original" | "light",
): SubtitleSideCarInput[] {
  return streams(item)
    .filter(isTextSubtitle)
    .filter((s) => (variant === "original" ? s.IsExternal === true : true))
    .filter((s) => typeof s.Index === "number")
    .map((s) => ({
      index: s.Index as number,
      format: sideCarFormat(s.Codec ?? "srt"),
      langTag: langTag(s),
    }));
}

/** Entrée d'enqueue pour UN item (film ou épisode). */
export function buildEnqueueItem(item: MediaItem, options: DownloadOptions): EnqueueItemInput {
  const source = primarySource(item);
  const isEpisode = item.Type === "Episode";
  const exactSize = typeof source?.Size === "number" && source.Size > 0 ? source.Size : undefined;
  const base: EnqueueItemInput = {
    itemId: item.Id,
    mediaSourceId: source?.Id ?? item.Id,
    variant: options.variant,
    containerExt: options.variant === "original" ? containerExt(item) : "mp4",
    kind: isEpisode ? "episode" : "movie",
    seriesId: isEpisode ? item.SeriesId : undefined,
    seasonId: isEpisode ? item.SeasonId : undefined,
    libraryId: undefined,
    runtimeTicks: item.RunTimeTicks ?? undefined,
    title: item.Name ?? undefined,
    seriesName: isEpisode ? (item.SeriesName ?? undefined) : undefined,
    autoDeleteAfterWatch: options.autoDeleteAfterWatch,
    subtitles: subtitleSideCars(item, options.variant),
  };
  if (options.variant === "original") {
    base.expectedSize = exactSize;
    base.estimatedSize = exactSize;
  } else {
    base.preset = options.preset;
    base.estimatedSize = estimateLightSizeBytes(item.RunTimeTicks, options.preset) ?? undefined;
    if (options.audioStreamIndex !== undefined) base.audioStreamIndex = options.audioStreamIndex;
    if (options.burnSubtitleIndex !== undefined) base.burnSubtitleIndex = options.burnSubtitleIndex;
  }
  return base;
}

/** Taille affichée dans le dialogue pour un lot (somme connue, null si inconnue). */
export function batchSizeBytes(items: MediaItem[], options: DownloadOptions): number | null {
  let total = 0;
  let known = 0;
  for (const item of items) {
    const size =
      options.variant === "original"
        ? primarySource(item)?.Size ?? null
        : estimateLightSizeBytes(item.RunTimeTicks, options.preset);
    if (typeof size === "number" && size > 0) {
      total += size;
      known += 1;
    }
  }
  return known > 0 ? total : null;
}
