import type { MediaStream } from "../types/media";
import { transcodeTarget, type TranscodeTarget } from "../utils/transcodeTarget";
import { readableRangeTypes, type EngineCapabilities } from "./engineCapabilities";

/**
 * Ce qu'on demande à Jellyfin quand il ne sert pas le fichier tel quel —
 * une seule règle pour tous les lecteurs, qu'ils fabriquent leur URL
 * (`buildStreamUrl` : bureau, téléviseurs) ou qu'ils corrigent celle de
 * Jellyfin (`applyTranscodeTarget` : web, mobile, LG).
 *
 * # Ce que fait Jellyfin (mesuré sur 10.11.11, sources jusqu'à `master`)
 *
 * - **Le son n'est copié que si `AudioBitrate` couvre la piste source.** Un
 *   DTS 5.1 à 768 kb/s face à `AudioBitrate=384000` est converti en AAC, même
 *   si `dts` figure dans `AudioCodec` (`CanStreamCopyAudio`). Avec
 *   `AudioCodec=aac` seul, Jellyfin écrit `AudioCodecNotSupported` — d'où un
 *   tableau de bord qui disait « l'appareil ne lit pas le DTS » à propos de mpv.
 * - **La vidéo n'est copiée que si son codec et sa plage sont déclarés** :
 *   `VideoCodec` doit la contenir et `<codec>-rangetype` sa plage. Aucun
 *   plafond de définition non plus : un `MaxWidth=1920` réencodait toute
 *   source 4K, tone mapping compris.
 * - **Un RÉENCODAGE perd toujours le HDR.** `IsSwTonemapAvailable` ne regarde
 *   que la source (HDR, 10 bits) et jamais la plage demandée ; `main10` est
 *   ramené à `main`. Une source HDR10 ou Dolby Vision réencodée sort en SDR
 *   8 bits, en H.264 comme en HEVC. Le HDR et le Dolby Vision ne survivent
 *   que si l'image est COPIÉE (`-codec:v copy -tag:v dvh1`, mesuré).
 * - **Le HEVC n'est encodé que si l'administrateur l'a permis**
 *   (`AllowHevcEncoding`, éteint par défaut) ; sinon Jellyfin prend le codec
 *   suivant de la liste. Le déclarer en tête ne coûte donc rien.
 * - **Jamais d'AC3/E-AC3 copié vers du fMP4** : l'init sort avec un `moov` vide
 *   (« Cannot write moov atom before AC3 packets »), illisible par AVPlayer et
 *   MSE.
 */

/** La piste audio choisie, telle que la fiche la décrit. */
export type AudioSource = Pick<MediaStream, "Codec" | "BitRate" | "Channels">;

/** La vidéo de la source, pour les plages HDR et le codec. */
export type VideoSource = Pick<MediaStream, "Codec">;

export interface StreamPlanInput {
  engine: EngineCapabilities;
  /** La piste audio lue ; absente : on ne sait pas, le son est converti. */
  audio?: AudioSource | null;
  /**
   * Le palier : débit TOTAL et définition. `null` : pas de palier — la vidéo
   * se copie si elle est lisible (remux, repli d'un conteneur ou d'un son).
   */
  tier: { totalBitrate: number; height?: number | null } | null;
}

/** Le transcodage décidé : les paramètres Jellyfin, et ce qu'ils promettent. */
export interface StreamPlan {
  params: Record<string, string>;
  /** Le son part tel quel (copie) ; sinon il est converti en AAC. */
  copiesAudio: boolean;
  /** Le budget du palier, son compris — `null` sans palier. */
  target: TranscodeTarget | null;
}

/** Codecs qu'on ne copie jamais vers du fMP4 (init au `moov` vide chez Jellyfin). */
const NO_COPY_IN_FMP4 = new Set(["ac3", "eac3"]);

/**
 * Au-delà de cette part du palier, le son d'origine coûte trop d'image : un
 * TrueHD à 4 Mb/s dans un palier de 8 serait la moitié du flux. Il est alors
 * converti, et Jellyfin le dit justement (`AudioBitrateNotSupported`).
 */
export const AUDIO_COPY_MAX_SHARE = 0.25;

/** Débit supposé d'une piste dont Jellyfin ne connaît pas le débit, par codec. */
function assumedAudioBitrate(codec: string): number {
  if (codec === "truehd" || codec.startsWith("pcm") || codec === "flac" || codec === "alac") return 3_000_000;
  if (codec === "dts") return 1_536_000;
  return 640_000;
}

/** Les codecs audio que ce moteur reçoit dans ses segments. */
export function segmentAudioCodecs(engine: EngineCapabilities): string[] {
  const codecs = engine.segmentContainer === "mp4"
    ? engine.audioCodecs.filter((codec) => !NO_COPY_IN_FMP4.has(codec))
    : [...engine.audioCodecs];
  // L'AAC en tête : c'est le codec de SORTIE quand le son est converti.
  return ["aac", ...codecs.filter((codec) => codec !== "aac")];
}

/**
 * Le débit à réserver pour copier la piste, ou `null` si elle doit être
 * convertie : codec non lu, trop de canaux, ou trop lourde pour le palier.
 */
export function audioCopyBitrate(
  engine: EngineCapabilities,
  audio: AudioSource | null | undefined,
  totalBitrate: number | null,
): number | null {
  const codec = audio?.Codec?.toLowerCase();
  if (!codec || !segmentAudioCodecs(engine).includes(codec)) return null;
  if ((audio?.Channels ?? 2) > engine.maxAudioChannels) return null;
  const bitrate = audio?.BitRate && audio.BitRate > 0 ? audio.BitRate : assumedAudioBitrate(codec);
  if (totalBitrate != null && bitrate > totalBitrate * AUDIO_COPY_MAX_SHARE) return null;
  return bitrate;
}

/** Les codecs vidéo d'un segment : l'AV1 et le VP9 ne voyagent qu'en fMP4. */
function segmentVideoCodecs(engine: EngineCapabilities): string[] {
  if (engine.segmentContainer === "mp4") return [...engine.videoCodecs];
  return engine.videoCodecs.filter((codec) => codec === "hevc" || codec === "h264");
}

/** `<codec>-rangetype` : sans elle, Jellyfin ne copie jamais une image HDR. */
function rangeParams(engine: EngineCapabilities, codecs: readonly string[]): Record<string, string> {
  const params: Record<string, string> = {};
  const hdr = readableRangeTypes(engine.hdr).join(",");
  for (const codec of codecs) params[`${codec}-rangetype`] = codec === "h264" ? "SDR" : hdr;
  return params;
}

/** Plafond de sûreté d'une copie : au-delà de tout disque UHD existant. */
const COPY_VIDEO_BITRATE = 139_616_000;

/** Débit réservé au son converti d'une copie : AAC 5.1. */
const CONVERTED_AUDIO_BITRATE = 384_000;

export function planStream(input: StreamPlanInput): StreamPlan {
  const { engine, audio, tier } = input;
  const videoCodecs = segmentVideoCodecs(engine);
  const copyBitrate = audioCopyBitrate(engine, audio, tier?.totalBitrate ?? null);
  const copiesAudio = copyBitrate !== null;
  const params: Record<string, string> = {
    VideoCodec: videoCodecs.join(","),
    AudioCodec: segmentAudioCodecs(engine).join(","),
    AllowAudioStreamCopy: "true",
    SegmentContainer: engine.segmentContainer,
    ...rangeParams(engine, videoCodecs),
  };

  if (!tier) {
    // Copie de l'image : aucune définition imposée, un plafond de débit au-delà
    // de toute source. Le son copié garde son débit ; converti, de l'AAC 5.1.
    params.AllowVideoStreamCopy = "true";
    params.VideoBitrate = String(COPY_VIDEO_BITRATE);
    params.AudioBitrate = String(copyBitrate ?? CONVERTED_AUDIO_BITRATE);
    params.TranscodingMaxAudioChannels = String(copiesAudio ? engine.maxAudioChannels : 6);
    return { params, copiesAudio, target: null };
  }

  // Un palier réencode toujours l'image : son budget est le débit total, moins
  // le son tel qu'il partira — copié à son débit, ou converti au budget du palier.
  const target = transcodeTarget(tier.totalBitrate, tier.height, copyBitrate);
  params.AllowVideoStreamCopy = "false";
  params.EnableAudioVbrEncoding = "true";
  params.VideoBitrate = String(target.videoBitrate);
  params.AudioBitrate = String(target.audioBitrate);
  params.TranscodingMaxAudioChannels = String(copiesAudio ? engine.maxAudioChannels : target.audioChannels);
  params.MaxWidth = String(target.maxWidth);
  if (target.maxHeight) params.MaxHeight = String(target.maxHeight);
  return { params, copiesAudio, target };
}

/** Ce qu'une `TranscodingUrl` de Jellyfin dit du son (paramètres lus sans casse). */
export interface ServedAudioParams {
  audioCodecs: readonly string[];
  audioBitrate: number | null;
  allowCopy: boolean;
}

/**
 * Jellyfin a-t-il prévu de COPIER le son, et la copie tient-elle dans le
 * palier ? Il la prévoit quand le profil d'appareil déclare le codec : il pose
 * alors `AudioBitrate` au débit de la piste (768000 pour un DTS, mesuré). Un
 * palier qui y écrirait le budget d'un AAC (384000) annulerait la copie — et
 * Jellyfin convertirait en disant que l'appareil ne lit pas ce son. Rend le
 * débit à garder, ou `null` : le son sera converti au budget du palier.
 */
export function keptAudioCopyBitrate(
  served: ServedAudioParams,
  audio: AudioSource | null | undefined,
  totalBitrate: number,
): number | null {
  const codec = audio?.Codec?.toLowerCase();
  const bitrate = audio?.BitRate ?? null;
  if (!codec || !bitrate || bitrate <= 0 || !served.allowCopy) return null;
  if (!served.audioCodecs.includes(codec)) return null;
  if (served.audioBitrate === null || served.audioBitrate < bitrate) return null;
  return bitrate <= totalBitrate * AUDIO_COPY_MAX_SHARE ? bitrate : null;
}
