/**
 * Construction des entrées de mise en file à partir des DTO Jellyfin — la
 * version mobile de `downloadTargets.ts` du web, avec deux différences :
 * la variante « qualité d'origine (MP4) » (= Allégé, palier `pmax`) et les
 * side-cars : TOUTES les pistes texte, en VTT, pour TOUTES les variantes,
 * Original compris — le lecteur mobile dessine lui-même ses sous-titres depuis
 * du VTT, et les pistes internes d'un MP4 seraient perdues sinon.
 */

import { Platform } from "react-native";
import type { MediaItem, MediaStream } from "@tentacle-tv/shared";
import {
  ANDROID_LOCAL_SUPPORT,
  IOS_LOCAL_SUPPORT,
  REMUX_PRESET,
  estimateLightSizeBytes,
  type EnqueueItemInput,
  type LightPresetId,
  type OfflineVariantKind,
  type PlatformMediaSupport,
  type SubtitleSideCarInput,
} from "@tentacle-tv/offline-core";

const TEXT_SUB_CODECS = new Set(["srt", "subrip", "ass", "ssa", "vtt", "webvtt", "sub", "text", "mov_text"]);
const IMAGE_SUB_CODECS = new Set(["pgs", "pgssub", "hdmv_pgs_subtitle", "dvdsub", "dvd_subtitle", "vobsub"]);

export interface KeepOptions {
  kind: OfflineVariantKind;
  preset: LightPresetId;
  autoDeleteAfterWatch: boolean;
  /** Délai d'auto-suppression après visionnage (minutes, 0 = immédiat). */
  autoDeleteDelayMinutes: number;
  audioStreamIndex?: number;
  burnSubtitleIndex?: number;
}

/** Ce que CET appareil lit tel quel. */
export const LOCAL_PLATFORM_SUPPORT: PlatformMediaSupport =
  Platform.OS === "ios" ? IOS_LOCAL_SUPPORT : ANDROID_LOCAL_SUPPORT;

function primarySource(item: MediaItem) {
  return item.MediaSources?.[0];
}

export function containerExt(item: MediaItem): string {
  const container = primarySource(item)?.Container ?? "";
  const first = container.split(",")[0]?.trim().toLowerCase() ?? "";
  return /^[a-z0-9]{1,5}$/.test(first) ? first : "mkv";
}

function streams(item: MediaItem): MediaStream[] {
  return primarySource(item)?.MediaStreams ?? [];
}

export function audioTracks(item: MediaItem): MediaStream[] {
  return streams(item).filter((s) => s.Type === "Audio" && typeof s.Index === "number");
}

/** Sous-titres image (PGS/VobSub) — proposables en incrustation Allégé seulement. */
export function imageSubtitleTracks(item: MediaItem): MediaStream[] {
  return streams(item).filter(
    (s) => s.Type === "Subtitle" && typeof s.Index === "number" && IMAGE_SUB_CODECS.has((s.Codec ?? "").toLowerCase()),
  );
}

function langTag(stream: MediaStream & { IsHearingImpaired?: boolean }): string {
  const parts: string[] = [(stream.Language ?? "und").toLowerCase()];
  if (stream.IsForced) parts.push("forced");
  if (stream.IsHearingImpaired) parts.push("sdh");
  return parts.join("-").replace(/[^a-z0-9-]/g, "");
}

/** Toutes les pistes texte, en VTT, quelle que soit la variante. */
export function subtitleSideCars(item: MediaItem): SubtitleSideCarInput[] {
  return streams(item)
    .filter((s) => s.Type === "Subtitle" && TEXT_SUB_CODECS.has((s.Codec ?? "").toLowerCase()))
    .map((s) => ({ index: s.Index, format: "vtt" as const, langTag: langTag(s) }));
}

/** Taille annoncée pour UN titre : exacte (original), borne haute (remux), estimée (allégé). */
export function sizeFor(item: MediaItem, kind: OfflineVariantKind, preset: LightPresetId): number | null {
  const source = primarySource(item);
  const exact = typeof source?.Size === "number" && source.Size > 0 ? source.Size : null;
  if (kind === "light") return estimateLightSizeBytes(item.RunTimeTicks, preset);
  return exact;
}

/** Entrée de mise en file pour UN titre (film ou épisode). */
export function buildKeepItem(item: MediaItem, options: KeepOptions): EnqueueItemInput {
  const source = primarySource(item);
  const isEpisode = item.Type === "Episode";
  const size = sizeFor(item, options.kind, options.preset);
  const original = options.kind === "original";
  const base: EnqueueItemInput = {
    itemId: item.Id,
    mediaSourceId: source?.Id ?? item.Id,
    variant: original ? "original" : "light",
    containerExt: original ? containerExt(item) : "mp4",
    kind: isEpisode ? "episode" : "movie",
    seriesId: isEpisode ? item.SeriesId : undefined,
    seasonId: isEpisode ? item.SeasonId : undefined,
    runtimeTicks: item.RunTimeTicks ?? undefined,
    title: item.Name ?? undefined,
    seriesName: isEpisode ? (item.SeriesName ?? undefined) : undefined,
    indexNumber: isEpisode ? (item.IndexNumber ?? undefined) : undefined,
    parentIndexNumber: isEpisode ? (item.ParentIndexNumber ?? undefined) : undefined,
    autoDeleteAfterWatch: options.autoDeleteAfterWatch,
    autoDeleteDelayMinutes: options.autoDeleteDelayMinutes,
    subtitles: subtitleSideCars(item),
    estimatedSize: size ?? undefined,
  };
  if (original) {
    base.expectedSize = size ?? undefined;
  } else {
    base.preset = options.kind === "remux" ? REMUX_PRESET : options.preset;
    if (options.audioStreamIndex !== undefined) base.audioStreamIndex = options.audioStreamIndex;
    if (options.kind === "light" && options.burnSubtitleIndex !== undefined) base.burnSubtitleIndex = options.burnSubtitleIndex;
  }
  return base;
}

/** Taille d'un lot : somme de ce qui est connu, `null` si rien ne l'est. */
export function batchSizeBytes(items: readonly MediaItem[], kind: OfflineVariantKind, preset: LightPresetId): { total: number | null; estimate: boolean } {
  let total = 0;
  let known = 0;
  for (const item of items) {
    const size = sizeFor(item, kind, preset);
    if (typeof size === "number" && size > 0) {
      total += size;
      known += 1;
    }
  }
  return { total: known > 0 ? total : null, estimate: kind !== "original" };
}
