import { BURN_IN_SUBTITLE_CODECS } from "../constants";
import type { MediaStream } from "../types/media";
import { hardwareDecoder, type DeviceMediaProfile, type PassthroughEncoding } from "./deviceMediaProfile";
import { normalizeVideoCodec, transcodeMaxHeight, videoUnsupportedReason, type DeviceVideoSource } from "./deviceVideoSupport";

/**
 * Comment un fichier se lit sur CET appareil Android TV, par ExoPlayer — le
 * lecteur qui lit d'abord (mpv ne prend la main qu'après une erreur d'Exo).
 * Une règle pure, sans appareil : le profil relevé (ou simulé) et les pistes
 * de la fiche suffisent.
 *
 * - `DirectPlay` : le fichier tel quel ; l'image décodée en MATÉRIEL, le son
 *   reçu par la sortie (passthrough) ou décodé par l'appareil.
 * - `DirectStream` : Jellyfin COPIE l'image et ne convertit que le son (aucun
 *   décodeur, aucune sortie pour lui).
 * - `Transcode` : Jellyfin RÉENCODE l'image — codec sans décodeur matériel
 *   (l'AV1 d'une box qui n'en a pas : décision du 07/10, le serveur convertit
 *   en HEVC, ou en H.264 si l'administrateur ne l'a pas permis), profil,
 *   10 bits, définition ou cadence hors de portée, Dolby Vision 5 sans son
 *   décodeur, sous-titre image à incruster dans un flux déjà servi.
 * - `Refuse` : rien que l'appareil décode ne peut sortir du serveur (aucun
 *   décodeur H.264 ni HEVC) — jamais rencontré, dit plutôt que tenté.
 *
 * Jamais le décodage logiciel d'une image : l'extension FFmpeg du lecteur
 * sait décoder H.264 et HEVC sur le processeur, et un Cortex-A53 ne le tient
 * pas. Le son, lui, se décode (coût modeste, mesuré plus tard sur la box).
 */

export type DevicePlayMethod = "DirectPlay" | "DirectStream" | "Transcode" | "Refuse";

/** Le chemin du son : tel quel vers l'ampli, décodé ici, converti par le serveur. */
export type AudioPath = "passthrough" | "decoded" | "converted" | "none";

/**
 * Le chemin des sous-titres : rendus par le lecteur (`native`), livrés en
 * texte simple par le serveur (`text` : un ASS y perd ses styles), incrustés
 * dans l'image (`burnIn`).
 */
export type SubtitlePath = "native" | "text" | "burnIn" | "none";

/** Ce qu'on dit au spectateur, discrètement (clés `player:deviceNotice.*`) : la conversion de l'AV1. */
export const DEVICE_NOTICES = ["av1Converted"] as const;
export type DeviceNotice = (typeof DEVICE_NOTICES)[number];

export type AudioSourceInfo = Pick<MediaStream, "Codec" | "Profile" | "Channels" | "DisplayTitle">;
export type SubtitleSourceInfo = Pick<MediaStream, "Codec" | "IsExternal">;

export interface DevicePlaybackInput {
  profile: DeviceMediaProfile;
  video?: DeviceVideoSource | null;
  audio?: AudioSourceInfo | null;
  /** Le sous-titre choisi ; absent : aucun. */
  subtitle?: SubtitleSourceInfo | null;
}

export interface DevicePlaybackVerdict {
  method: DevicePlayMethod;
  /** Les raisons, avec les mots de Jellyfin (`TranscodeReasons`). */
  reasons: string[];
  audioPath: AudioPath;
  subtitlePath: SubtitlePath;
  notice: DeviceNotice | null;
  /** La définition que le transcodage vise (sortie, décodeur) ; `null` : celle de la source. */
  maxHeight: number | null;
}

const ATMOS = /atmos|joc/i;
const DTS_HD = /dts-hd|dts:x|dts-x|\bma\b|\bhra\b/i;

/** Le nom de codec de Jellyfin pour un son (`dca` → `dts`). */
export function normalizeAudioCodec(codec: string | null | undefined): string {
  const c = (codec ?? "").toLowerCase();
  if (c === "dca" || c.startsWith("dts")) return "dts";
  if (c === "mlp") return "truehd";
  if (c === "e-ac-3" || c === "ec-3") return "eac3";
  return c;
}

/** L'encodage que la sortie HDMI recevrait tel quel, ou `null` (pas un son « bitstream »). */
function passthroughEncoding(audio: AudioSourceInfo, codec: string): PassthroughEncoding | null {
  const label = `${audio.Profile ?? ""} ${audio.DisplayTitle ?? ""}`;
  if (codec === "ac3" || codec === "truehd") return codec;
  if (codec === "eac3") return ATMOS.test(label) ? "eac3-joc" : "eac3";
  if (codec === "dts") return DTS_HD.test(label) ? "dtshd" : "dts";
  return null;
}

/**
 * Le chemin du son. Media3 replie de lui-même un Atmos sur l'E-AC3 de base et
 * un DTS-HD sur son cœur DTS quand la sortie ne prend que celui-là.
 */
export function deviceAudioPath(profile: DeviceMediaProfile, audio: AudioSourceInfo | null | undefined): AudioPath {
  if (!audio?.Codec) return "none";
  const codec = normalizeAudioCodec(audio.Codec);
  const encoding = passthroughEncoding(audio, codec);
  const sink: readonly string[] = profile.audio.passthrough;
  const core = encoding === "eac3-joc" ? "eac3" : encoding === "dtshd" ? "dts" : null;
  if (encoding && (sink.includes(encoding) || (core && sink.includes(core)))) return "passthrough";
  return profile.audio.decoded.includes(codec) ? "decoded" : "converted";
}

function isImageSubtitle(subtitle: SubtitleSourceInfo): boolean {
  return BURN_IN_SUBTITLE_CODECS.test(subtitle.Codec ?? "");
}

export function devicePlaybackVerdict(input: DevicePlaybackInput): DevicePlaybackVerdict {
  const { profile, video, audio, subtitle } = input;
  const videoReason = video ? videoUnsupportedReason(profile, video) : null;
  const audioPath = deviceAudioPath(profile, audio);
  // Servi par le serveur dès que l'image ou le son ne passent pas tels quels.
  const served = videoReason !== null || audioPath === "converted";

  let subtitlePath: SubtitlePath = "none";
  if (subtitle?.Codec) {
    if (isImageSubtitle(subtitle)) {
      // Une image embarquée se décode dans le lecteur (Media3 : PGS, VobSub,
      // DVB) ; dans un flux servi, ou d'un fichier à part, elle s'incruste.
      subtitlePath = served || subtitle.IsExternal ? "burnIn" : "native";
    } else {
      subtitlePath = served ? "text" : "native";
    }
  }

  const reasons: string[] = [];
  if (videoReason) reasons.push(videoReason);
  if (audioPath === "converted") reasons.push("AudioCodecNotSupported");
  if (subtitlePath === "burnIn") reasons.push("SubtitleCodecNotSupported");

  const reencodes = videoReason !== null || subtitlePath === "burnIn";
  let method: DevicePlayMethod = reencodes ? "Transcode" : audioPath === "converted" ? "DirectStream" : "DirectPlay";
  if (method === "Transcode" && !hardwareDecoder(profile, "h264") && !hardwareDecoder(profile, "hevc")) method = "Refuse";

  const av1 = video && normalizeVideoCodec(video.Codec) === "av1" && videoReason !== null;
  return {
    method,
    reasons,
    audioPath,
    subtitlePath,
    notice: av1 && method === "Transcode" ? "av1Converted" : null,
    maxHeight: method === "Transcode" && video ? transcodeMaxHeight(profile, video) : null,
  };
}
