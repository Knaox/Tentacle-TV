import type { CodecProfile, DeviceProfile, DirectPlayProfile, SubtitleProfile } from "../types/media";
import type { EngineCapabilities } from "./engineCapabilities";
import { engineTranscodingProfiles } from "./engineProfiles";

/**
 * La diffusion vers un téléviseur SANS l'app (Google Cast, récepteur média
 * par défaut de Google) : le téléphone ne lit rien, il dit au récepteur quoi
 * ouvrir. Le récepteur est un MOTEUR comme un autre — il déclare ce qu'il
 * décode, et la règle commune (`engineTranscodingProfiles`) en tire ce qu'il
 * faut demander à Jellyfin.
 *
 * Déclaration volontairement PRUDENTE : le récepteur par défaut tourne sur
 * toute la gamme (Chromecast de 2013 compris), et l'app n'a aucun moyen
 * fiable de connaître ses décodeurs. Le H.264 8 bits jusqu'au niveau 4.1 en
 * 1080p, l'AAC stéréo : ce que TOUS lisent. Le HEVC, le HDR et le son
 * multicanal (Chromecast Ultra, Google TV) seraient une promesse qu'un modèle
 * plus ancien ne tiendrait pas — un écran noir sur la TV, sans message.
 */
export const CAST_ENGINE: EngineCapabilities = {
  engine: "cast",
  videoCodecs: ["h264"],
  hdr: { hdr10: false, hdr10Plus: false, hlg: false, dolbyVision: false, dolbyVisionEnhancementLayer: false },
  audioCodecs: ["aac", "mp3"],
  maxAudioChannels: 2,
  segmentContainer: "ts",
};

/** Le plafond d'image du récepteur : 1080p, H.264 niveau 4.1, 8 bits. */
export const CAST_MAX_WIDTH = 1920;
export const CAST_MAX_HEIGHT = 1080;
const CAST_H264_MAX_LEVEL = "41";

/** Les sous-titres texte que Jellyfin sert en WebVTT au récepteur. */
export const CAST_TEXT_SUBTITLES: readonly string[] = ["vtt", "webvtt", "srt", "subrip", "ass", "ssa"];

/** Débit par défaut vers le récepteur : un Wi-Fi domestique, pas un câble. */
export const CAST_DEFAULT_MAX_BITRATE = 20_000_000;

/**
 * Le `DeviceProfile` envoyé à Jellyfin pour une diffusion. Lecture directe
 * d'un MP4 H.264 + AAC/MP3 seulement ; tout le reste se transcode en HLS
 * (TS, H.264, AAC) — le seul format que le récepteur par défaut lit partout.
 *
 * Sous-titres : un sous-titre TEXTE (SRT, ASS, WebVTT…) reste séparé
 * (`External`) — Jellyfin le convertit en WebVTT à la volée, le récepteur
 * l'affiche en piste texte ; une image (PGS, VobSub, DVB) est gravée par le
 * serveur (`Encode`) — jamais un format que la TV ignorerait en silence.
 */
export function buildCastDeviceProfile(maxBitrate?: number): DeviceProfile {
  const directPlayProfiles: DirectPlayProfile[] = [
    { Container: "mp4,m4v", Type: "Video", VideoCodec: "h264", AudioCodec: CAST_ENGINE.audioCodecs.join(",") },
    { Container: "mp3", Type: "Audio" },
    { Container: "aac,m4a", Type: "Audio" },
  ];
  const codecProfiles: CodecProfile[] = [
    {
      Type: "Video",
      Codec: "h264",
      Conditions: [
        { Condition: "LessThanEqual", Property: "VideoLevel", Value: CAST_H264_MAX_LEVEL, IsRequired: false },
        { Condition: "LessThanEqual", Property: "VideoBitDepth", Value: "8", IsRequired: false },
        { Condition: "LessThanEqual", Property: "Width", Value: String(CAST_MAX_WIDTH), IsRequired: false },
        { Condition: "LessThanEqual", Property: "Height", Value: String(CAST_MAX_HEIGHT), IsRequired: false },
        { Condition: "EqualsAny", Property: "VideoRangeType", Value: "SDR", IsRequired: false },
      ],
    },
    {
      Type: "VideoAudio",
      Conditions: [
        { Condition: "LessThanEqual", Property: "AudioChannels", Value: String(CAST_ENGINE.maxAudioChannels), IsRequired: false },
      ],
    },
  ];
  const subtitleProfiles: SubtitleProfile[] = [
    ...CAST_TEXT_SUBTITLES.map((format): SubtitleProfile => ({ Format: format, Method: "External" })),
    ...["pgssub", "dvdsub", "dvbsub"].map((format): SubtitleProfile => ({ Format: format, Method: "Encode" })),
  ];
  const bitrate = maxBitrate && maxBitrate > 0 ? maxBitrate : CAST_DEFAULT_MAX_BITRATE;
  return {
    MaxStreamingBitrate: bitrate,
    MaxStaticBitrate: bitrate,
    MusicStreamingTranscodingBitrate: 192_000,
    DirectPlayProfiles: directPlayProfiles,
    TranscodingProfiles: engineTranscodingProfiles(CAST_ENGINE),
    CodecProfiles: codecProfiles,
    SubtitleProfiles: subtitleProfiles,
  };
}

/**
 * Le type MIME annoncé au récepteur : il choisit son lecteur (HLS ou
 * progressif) d'après lui, jamais d'après l'URL — celles de Jellyfin n'ont pas
 * toujours d'extension.
 */
export function castContentType(directPlay: boolean, container?: string | null): string {
  if (!directPlay) return "application/x-mpegURL";
  const c = (container ?? "").toLowerCase();
  if (c === "mp3") return "audio/mpeg";
  if (c === "aac" || c === "m4a") return "audio/mp4";
  return "video/mp4";
}
