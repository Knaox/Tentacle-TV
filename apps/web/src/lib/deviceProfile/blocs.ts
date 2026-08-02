import type { CodecProfile, ProfileCondition, SubtitleProfile, TranscodingProfile } from "@tentacle-tv/shared";

/**
 * Briques communes aux trois profils (navigateur, macOS WKWebView, mpv).
 *
 * Elles ne sont ici que parce que les trois variantes les écrivaient à
 * l'identique. Tout ce qui diffère réellement d'un lecteur à l'autre reste
 * dans le fichier de la variante concernée — factoriser une différence la
 * rendrait invisible.
 */

export const DEBIT_MUSIQUE = 384_000;

/** H264 : niveau maximal (51 en Chromium, 52 sous AVFoundation) et 16 trames de référence. */
export function conditionsH264(niveauMax: string): ProfileCondition[] {
  return [
    { Condition: "LessThanEqual", Property: "VideoLevel", Value: niveauMax, IsRequired: false },
    { Condition: "LessThanEqual", Property: "RefFrames", Value: "16", IsRequired: false },
  ];
}

/** HEVC : niveau 183 (6.1) au plus, 16 trames de référence. */
export const CONDITIONS_HEVC: ProfileCondition[] = [
  { Condition: "LessThanEqual", Property: "VideoLevel", Value: "183", IsRequired: false },
  { Condition: "LessThanEqual", Property: "RefFrames", Value: "16", IsRequired: false },
];

/** Audio : 6 canaux au plus (hors codecs surround spécifiques). */
export const PROFIL_AUDIO_6_CANAUX: CodecProfile = {
  Type: "VideoAudio",
  Conditions: [
    { Condition: "LessThanEqual", Property: "AudioChannels", Value: "6", IsRequired: false },
  ],
};

/** HLS en segments TS — le repli universel des navigateurs. */
export function profilHlsTs(videoCodec: string, audioCodec: string): TranscodingProfile {
  return {
    Container: "ts",
    Type: "Video",
    VideoCodec: videoCodec,
    AudioCodec: audioCodec,
    Protocol: "hls",
    Context: "Streaming",
    MaxAudioChannels: "6",
    MinSegments: 2,
    BreakOnNonKeyFrames: true,
    CopyTimestamps: true,
  };
}

/** HLS en fMP4 — AVFoundation exige ce conteneur pour le HEVC, le TS ne passe pas. */
export const PROFIL_HLS_FMP4: TranscodingProfile = {
  Container: "mp4",
  Type: "Video",
  VideoCodec: "hevc,h264",
  AudioCodec: "aac,ac3,eac3",
  Protocol: "hls",
  Context: "Streaming",
  MaxAudioChannels: "6",
  MinSegments: 2,
  BreakOnNonKeyFrames: true,
  CopyTimestamps: true,
};

/** Transcodage audio seul. */
export const PROFIL_AUDIO_SEUL: TranscodingProfile = {
  Container: "mp4",
  Type: "Audio",
  AudioCodec: "aac",
  Protocol: "hls",
  Context: "Streaming",
  MaxAudioChannels: "6",
};

/** Sous-titres texte servis en pistes séparées (navigateur et mpv). */
export const SOUS_TITRES_TEXTE: SubtitleProfile[] = [
  { Format: "vtt", Method: "External" },
  { Format: "ass", Method: "External" },
  { Format: "ssa", Method: "External" },
  { Format: "srt", Method: "External" },
  { Format: "sub", Method: "External" },
  { Format: "subrip", Method: "External" },
];

/**
 * Variante macOS : chaque format est doublé d'une déclinaison `Hls`, pour que
 * les pistes apparaissent dans le manifeste — AVPlayer ne sait pas charger un
 * sous-titre latéral. Le format `sub` en est absent.
 */
export const SOUS_TITRES_TEXTE_HLS: SubtitleProfile[] = [
  { Format: "vtt", Method: "External" }, { Format: "vtt", Method: "Hls" },
  { Format: "srt", Method: "External" }, { Format: "srt", Method: "Hls" },
  { Format: "subrip", Method: "External" }, { Format: "subrip", Method: "Hls" },
  { Format: "ass", Method: "External" }, { Format: "ass", Method: "Hls" },
  { Format: "ssa", Method: "External" }, { Format: "ssa", Method: "Hls" },
];

/** Sous-titres image : incrustés par le serveur, donc ré-encodage de l'image. */
export const SOUS_TITRES_BITMAP: SubtitleProfile[] = [
  { Format: "pgssub", Method: "Encode" },
  { Format: "dvdsub", Method: "Encode" },
  { Format: "dvbsub", Method: "Encode" },
];
