/**
 * Quelles variantes proposer pour GARDER un titre hors ligne, sur cette
 * plateforme, pour ce fichier — logique pure, testée.
 *
 * Hors ligne, personne ne transcode : le fichier doit se lire tel quel. Sur
 * iPhone, un MKV « Original » serait illisible ; d'où la variante `remux` —
 * la vidéo recopiée telle quelle dans un MP4 par le serveur (palier `pmax` du
 * mode Allégé), l'audio converti seulement s'il est incompatible. L'Allégé
 * reste le repli universel.
 *
 * Trois cartes possibles, dans cet ordre : `original`, `remux`, `light`. Ce
 * qui est exclu l'est avec sa raison : le dialogue peut l'expliquer.
 */

import type { MediaItem, MediaStream } from "@tentacle-tv/shared";
import type { DownloadCapabilities } from "../sync/capabilities";
import type { PlatformMediaSupport } from "./platformSupport";

/** Le palier « qualité d'origine en MP4 » côté serveur. */
export const REMUX_PRESET = "pmax";

export type OfflineVariantKind = "original" | "remux" | "light";

export type OfflineVariantReason =
  /** Original : lisible tel quel. */
  | "playable"
  /** Remux : le conteneur (mkv…) n'est pas lu, la vidéo est recopiée dans un MP4. */
  | "container"
  /** Remux : vidéo recopiée, audio incompatible converti. */
  | "audioCodec"
  /** Allégé : toujours disponible avec le droit de conversion. */
  | "fallback";

export type OfflineExclusionReason =
  | "container"
  | "videoCodec"
  | "audioCodec"
  | "dolbyVision"
  | "interlaced"
  | "serverPreset"
  | "right"
  /** Remux inutile : l'original est déjà entièrement lisible. */
  | "redundant";

export interface OfflineVariantCard {
  kind: OfflineVariantKind;
  reason: OfflineVariantReason;
  /** Pistes audio de la source lisibles / non lisibles ici (index Jellyfin). */
  audio: { playable: number[]; unplayable: number[] };
  /** Exacte (original), borne haute (remux = taille de la source), `null` pour l'Allégé. */
  sizeBytes: number | null;
  sizeIsEstimate: boolean;
}

export interface OfflineVariantPlan {
  cards: OfflineVariantCard[];
  excluded: Array<{ kind: OfflineVariantKind; reason: OfflineExclusionReason }>;
}

/** Même découpe que `containerExt` du dialogue : premier jeton, repli `mkv`. */
function firstContainer(container: string | undefined): string {
  const first = (container ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return /^[a-z0-9]{1,5}$/.test(first) ? first : "mkv";
}

function codecOf(stream: MediaStream | undefined): string {
  const codec = (stream?.Codec ?? "").toLowerCase();
  return codec === "h265" ? "hevc" : codec;
}

/**
 * Dolby Vision qu'aucun des deux lecteurs ne rend correctement dans un MP4 :
 * le profil 5 (couche de base IPT, couleurs fausses) et le profil 7 (double
 * couche). Un `VideoRangeType` textuel « DOVI » sans profil connu est traité
 * de même, par prudence. Les profils 8 (base HDR10/HLG/SDR) et 4 passent.
 */
function incompatibleDolbyVision(video: MediaStream): boolean {
  const profile = video.DvProfile;
  if (profile === 5 || profile === 7) return true;
  if (profile != null) return false;
  const range = typeof video.VideoRangeType === "string" ? video.VideoRangeType.toUpperCase() : "";
  return range.includes("DOVI") || range.includes("DOLBY");
}

export function offlineVariantsFor(
  item: MediaItem,
  platform: PlatformMediaSupport,
  capabilities: DownloadCapabilities,
): OfflineVariantPlan {
  // Invisibilité stricte : sans droit, pas même une raison.
  if (!capabilities.downloads) return { cards: [], excluded: [] };

  const source = item.MediaSources?.[0];
  const streams = source?.MediaStreams ?? [];
  const video = streams.find((s) => s.Type === "Video");
  const audios = streams.filter((s) => s.Type === "Audio");
  const container = firstContainer(source?.Container);
  const videoCodec = codecOf(video);
  const size = typeof source?.Size === "number" && source.Size > 0 ? source.Size : null;
  const audio = {
    playable: audios.filter((a) => platform.audioCodecs.has(codecOf(a))).map((a) => a.Index),
    unplayable: audios.filter((a) => !platform.audioCodecs.has(codecOf(a))).map((a) => a.Index),
  };
  const dolbyVision = video !== undefined && incompatibleDolbyVision(video);
  const interlaced = video?.IsInterlaced === true && !platform.deinterlaces;

  const plan: OfflineVariantPlan = { cards: [], excluded: [] };
  const exclude = (kind: OfflineVariantKind, reason: OfflineExclusionReason): void => {
    plan.excluded.push({ kind, reason });
  };
  const offer = (
    kind: OfflineVariantKind,
    reason: OfflineVariantReason,
    sizeBytes: number | null,
    sizeIsEstimate: boolean,
  ): void => {
    plan.cards.push({ kind, reason, audio, sizeBytes, sizeIsEstimate });
  };

  // Original : le fichier tel quel.
  if (dolbyVision) exclude("original", "dolbyVision");
  else if (interlaced) exclude("original", "interlaced");
  else if (!platform.containers.has(container)) exclude("original", "container");
  else if (!platform.videoCodecs.has(videoCodec)) exclude("original", "videoCodec");
  // Plusieurs pistes dont une seule lisible : l'original reste proposé, la
  // carte porte les pistes perdues pour que le dialogue prévienne.
  else if (audios.length > 0 && audio.playable.length === 0) exclude("original", "audioCodec");
  else offer("original", "playable", size, false);

  // Qualité d'origine en MP4 : seulement si elle apporte quelque chose.
  const remuxable = videoCodec === "h264" || videoCodec === "hevc";
  if (!capabilities.lightDownloads) exclude("remux", "right");
  else if (!capabilities.lightPresets.includes(REMUX_PRESET)) exclude("remux", "serverPreset");
  else if (dolbyVision) exclude("remux", "dolbyVision");
  else if (interlaced) exclude("remux", "interlaced");
  else if (!remuxable) exclude("remux", "videoCodec");
  else if (!platform.containers.has(container)) offer("remux", "container", size, true);
  else if (audio.unplayable.length > 0) offer("remux", "audioCodec", size, true);
  else exclude("remux", "redundant");

  // Allégé : le repli, dès que la conversion est permise.
  if (capabilities.lightDownloads) offer("light", "fallback", null, true);
  else exclude("light", "right");

  return plan;
}
