import type { MediaStream } from "../types/media";
import { hardwareDecoder, type DeviceMediaProfile, type VideoDecoderCaps } from "./deviceMediaProfile";

/**
 * L'image d'un fichier se décode-t-elle en MATÉRIEL sur cet appareil ? — la
 * moitié vidéo du verdict (`devicePlaybackVerdict.ts`).
 *
 * Ce qui décide : le décodeur du codec, son profil, sa profondeur (10 bits), la
 * définition et la cadence (le test de Media3 : points de performance, sinon
 * `areSizeAndRateSupported`), et pour le Dolby Vision le profil. Le NIVEAU ne
 * décide pas : relevé dans le profil, il refuserait à tort des fichiers que le
 * décodeur lit (un H.264 de niveau 5.1 en 1080p, courant) — la taille et la
 * cadence sont le vrai test.
 */

export type DeviceVideoSource = Pick<
  MediaStream,
  "Codec" | "Profile" | "BitDepth" | "Width" | "Height" | "RealFrameRate" | "AverageFrameRate"
  | "VideoRangeType" | "DvProfile" | "DvBlSignalCompatibilityId"
>;

/** Pourquoi l'image doit être convertie, avec les mots de Jellyfin (`TranscodeReason`). */
export type VideoReason =
  | "VideoCodecNotSupported" | "VideoProfileNotSupported" | "VideoBitDepthNotSupported"
  | "VideoResolutionNotSupported" | "VideoFramerateNotSupported" | "VideoRangeTypeNotSupported";

/** Le nom de codec de Jellyfin, quelle que soit l'étiquette du conteneur. */
export function normalizeVideoCodec(codec: string | null | undefined): string {
  const c = (codec ?? "").toLowerCase();
  if (c === "avc" || c === "h.264" || c === "avc1") return "h264";
  if (c === "h265" || c === "h.265" || c === "hvc1" || c === "hev1" || c === "dvhe" || c === "dvh1") return "hevc";
  if (c === "av01") return "av1";
  if (c === "mpeg2" || c === "mpeg2video") return "mpeg2video";
  if (c === "wvc1" || c === "vc-1") return "vc1";
  return c;
}

/**
 * Les profils de décodeur qui lisent un profil de source, par codec. Un profil
 * de source absent de cette table ne se contrôle pas (jamais de refus sur un
 * nom inconnu).
 */
const READ_BY: Record<string, Record<string, readonly string[]>> = {
  h264: {
    "constrained baseline": ["constrained baseline", "baseline", "main", "high"],
    baseline: ["baseline", "main", "high"],
    main: ["main", "high"],
    high: ["high"],
    "high 10": ["high 10"],
    "high 4:2:2": ["high 4:2:2"],
    "high 4:4:4 predictive": ["high 4:4:4 predictive"],
  },
  hevc: {
    main: ["main", "main 10"],
    "main still picture": ["main still picture", "main", "main 10"],
    "main 10": ["main 10"],
    rext: ["rext"],
  },
  vp9: {
    "profile 0": ["profile 0", "profile 2"],
    "profile 1": ["profile 1", "profile 3"],
    "profile 2": ["profile 2"],
    "profile 3": ["profile 3"],
  },
  av1: { main: ["main"], high: ["high"], professional: ["professional"] },
  mpeg2video: { simple: ["simple", "main", "high"], main: ["main", "high"], high: ["high"] },
};

function profileReadable(decoder: VideoDecoderCaps, codec: string, sourceProfile: string | undefined): boolean {
  const wanted = sourceProfile?.trim().toLowerCase();
  if (!wanted || decoder.profiles.length === 0) return true;
  const readers = READ_BY[codec]?.[wanted];
  if (!readers) return true;
  const declared = decoder.profiles.map((p) => p.toLowerCase());
  return readers.some((reader) => declared.includes(reader));
}

/** La cadence du fichier : la réelle, sinon la moyenne ; `null` inconnue. */
export function sourceFrameRate(video: Pick<DeviceVideoSource, "RealFrameRate" | "AverageFrameRate">): number | null {
  const fps = video.RealFrameRate || video.AverageFrameRate;
  return fps && fps > 0 ? fps : null;
}

/**
 * La cadence la plus haute que le décodeur tient à cette définition : le plus
 * petit point testé qui la couvre (en surface), sinon le plus grand si la
 * définition reste dans ce que le décodeur annonce (4096 × 2160, 1920 × 1088).
 * `null` : aucun point relevé — seule la définition annoncée compte alors.
 */
function maxFrameRateAt(decoder: VideoDecoderCaps, width: number, height: number): number | null {
  if (decoder.sizes.length === 0) return null;
  const sorted = [...decoder.sizes].sort((a, b) => a.width * a.height - b.width * b.height);
  const covering = sorted.find((point) => point.width * point.height >= width * height);
  return (covering ?? sorted[sorted.length - 1]).maxFrameRate;
}

/** Profil Dolby Vision de la source (5, 7, 8…), ou `null` : pas de Dolby Vision. */
export function dolbyVisionProfile(video: DeviceVideoSource): number | null {
  if (typeof video.DvProfile === "number" && video.DvProfile > 0) return video.DvProfile;
  const range = typeof video.VideoRangeType === "string" ? video.VideoRangeType.toUpperCase() : "";
  // « DOVI » nu : aucune base lisible autrement — le profil 5.
  return range === "DOVI" ? 5 : null;
}

/**
 * Le Dolby Vision se lit-il ? Le profil 5 exige son décodeur (aucune base
 * HDR10 ni SDR à lire autrement : sans lui, des couleurs vertes et violettes).
 * Les profils 7 (réécrit en 8.1 par `DvCompatRenderer`) et 8 se lisent par le
 * décodeur Dolby Vision s'il existe, sinon par leur base HEVC (Media3) : ils
 * suivent la règle du HEVC.
 */
function dolbyVisionReadable(profile: DeviceMediaProfile, video: DeviceVideoSource): boolean {
  const dv = dolbyVisionProfile(video);
  const baseless = dv === 5 || (dv !== null && video.DvBlSignalCompatibilityId === 0);
  return !baseless || profile.hdr.dolbyVisionProfiles.includes(5);
}

/** `null` : l'image se décode en matériel telle quelle ; sinon pourquoi pas. */
export function videoUnsupportedReason(profile: DeviceMediaProfile, video: DeviceVideoSource): VideoReason | null {
  const codec = normalizeVideoCodec(video.Codec);
  const decoder = hardwareDecoder(profile, codec);
  if (!decoder) return "VideoCodecNotSupported";
  if (!profileReadable(decoder, codec, video.Profile)) return "VideoProfileNotSupported";
  if ((video.BitDepth ?? 8) > 8 && !decoder.tenBit) return "VideoBitDepthNotSupported";
  const width = video.Width ?? 0;
  const height = video.Height ?? 0;
  if ((decoder.maxWidth > 0 && width > decoder.maxWidth) || (decoder.maxHeight > 0 && height > decoder.maxHeight)) {
    return "VideoResolutionNotSupported";
  }
  if (width > 0 && height > 0) {
    const maxFps = maxFrameRateAt(decoder, width, height);
    if (maxFps === 0) return "VideoResolutionNotSupported";
    const fps = sourceFrameRate(video);
    if (maxFps !== null && fps !== null && fps > maxFps + 0.5) return "VideoFramerateNotSupported";
  }
  if (!dolbyVisionReadable(profile, video)) return "VideoRangeTypeNotSupported";
  return null;
}

/**
 * La définition la plus haute qu'un TRANSCODAGE doit viser : celle de la
 * sortie (un 4K converti pour un écran 1080p ne coûte que du serveur), bornée
 * par ce que le décodeur H.264 tient à cette cadence — la sortie que Jellyfin
 * produit toujours, le HEVC n'étant permis que par l'administrateur.
 * `null` : la définition de la source passe.
 */
export function transcodeMaxHeight(profile: DeviceMediaProfile, video: DeviceVideoSource): number | null {
  const height = video.Height ?? 0;
  if (height <= 0) return null;
  const fps = sourceFrameRate(video) ?? 24;
  const h264 = hardwareDecoder(profile, "h264");
  const decodable = h264?.sizes.filter((point) => point.maxFrameRate + 0.5 >= fps).map((point) => point.height) ?? [];
  const decoderCap = decodable.length > 0 ? Math.max(...decodable) : 1080;
  const displayCap = profile.display.height > 0 ? profile.display.height : decoderCap;
  const cap = Math.min(decoderCap, displayCap);
  return height > cap ? cap : null;
}
