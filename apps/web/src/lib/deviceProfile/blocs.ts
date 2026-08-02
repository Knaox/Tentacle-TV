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

/**
 * Capacités que la session a pu perdre en cours de route. Les deux drapeaux
 * sont levés par un ÉCHEC observé, jamais par précaution : sous-déclarer ses
 * capacités, c'est perdre la lecture directe.
 */
export interface OptionsProfilWeb {
  /**
   * Un MKV annoncé en lecture directe n'a rien donné — on le retire pour que
   * Jellyfin reparte en remux. Drapeau tenu par `usePlaybackInfo`, en mémoire.
   */
  mkvNonFiable?: boolean;
  /**
   * Le rendu PGS côté client a échoué (chargement ou décodage) : on repasse le
   * format en `Encode`, donc à l'incrustation serveur. Le prix est un
   * transcodage vidéo, et c'est pourquoi il n'arrive qu'après un vrai échec.
   */
  pgsClientIndisponible?: boolean;
}

/** Sous-titres image, selon que le client sait décoder le PGS ou non. */
export function sousTitresBitmap(pgsClientIndisponible?: boolean): SubtitleProfile[] {
  return pgsClientIndisponible ? SOUS_TITRES_BITMAP : SOUS_TITRES_BITMAP_PGS_CLIENT;
}

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

/**
 * Variante des lecteurs web : le PGS passe en piste séparée, Jellyfin sert
 * alors un `.sup` que `PgsSubtitleOverlay` décode et dessine sur un canvas.
 * C'était la première cause de transcodage vidéo — un sous-titre image
 * obligeait à ré-encoder toute l'image pour l'y incruster.
 *
 * VOBSUB et DVB restent en `Encode` : libpgs ne lit que le PGS, et les
 * déclarer externes les rendrait invisibles.
 */
export const SOUS_TITRES_BITMAP_PGS_CLIENT: SubtitleProfile[] = [
  { Format: "pgssub", Method: "External" },
  { Format: "dvdsub", Method: "Encode" },
  { Format: "dvbsub", Method: "Encode" },
];
