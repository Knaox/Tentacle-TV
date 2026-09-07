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
  /**
   * Langue audio à embarquer, quand le choix porte sur un LOT : les index de
   * flux diffèrent d'un épisode à l'autre, la langue non. Résolue par item.
   * ⚠️ Code de langue Jellyfin (`fra`, `eng`…) : il traverse une API, il ne se
   * traduit ni ne se normalise.
   */
  audioLanguage?: string;
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

/** Les langues audio présentes dans ce lot, une seule fois chacune. */
export function audioLanguages(items: readonly MediaItem[]): Array<{ code: string; stream: MediaStream }> {
  const seen = new Map<string, MediaStream>();
  for (const item of items) {
    for (const stream of audioTracks(item)) {
      const code = (stream.Language ?? "").toLowerCase();
      if (code === "" || seen.has(code)) continue;
      seen.set(code, stream);
    }
  }
  return [...seen].map(([code, stream]) => ({ code, stream }));
}

/** L'index audio de CET item pour cette langue, `undefined` s'il ne l'a pas. */
function languageIndex(item: MediaItem, language: string | undefined): number | undefined {
  if (language === undefined) return undefined;
  return audioTracks(item).find((stream) => (stream.Language ?? "").toLowerCase() === language)?.Index;
}

/**
 * La piste audio qui sera RÉELLEMENT embarquée. Les paliers Allégé et remux
 * passent par le transcodage de Jellyfin, qui n'en sort jamais qu'une : sans
 * consigne, c'est celle que le fichier déclare par défaut. Sert à le DIRE
 * avant de lancer le transfert.
 */
export function keptAudioTrack(item: MediaItem, options: KeepOptions): MediaStream | null {
  const tracks = audioTracks(item);
  if (tracks.length === 0) return null;
  if (options.audioStreamIndex !== undefined) {
    return tracks.find((stream) => stream.Index === options.audioStreamIndex) ?? null;
  }
  const index = languageIndex(item, options.audioLanguage);
  if (index !== undefined) return tracks.find((stream) => stream.Index === index) ?? null;
  return tracks.find((stream) => stream.IsDefault) ?? tracks[0] ?? null;
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
    // L'index explicite (un seul titre) prime ; sinon la langue choisie pour
    // le lot est résolue dans CET item, dont les index lui sont propres.
    const audio = options.audioStreamIndex ?? languageIndex(item, options.audioLanguage);
    if (audio !== undefined) base.audioStreamIndex = audio;
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
