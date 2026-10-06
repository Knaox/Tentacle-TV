/**
 * Ce qu'un MOTEUR de lecture sait lire — la seule chose qu'un client déclare.
 *
 * Tout le reste se décide ailleurs, une fois pour toutes les plateformes
 * (`streamPlan.ts`) : codec de sortie d'un transcodage, copie du son, plages
 * HDR et Dolby Vision gardées, budget de débit. Un client ne choisit jamais
 * « h264 + aac » lui-même : il dit ce que son moteur décode, et la règle en
 * tire ce qu'il faut demander à Jellyfin.
 *
 * Les moteurs partagés entre plusieurs applications (mpv sur le bureau, le
 * mobile et Android TV ; AVPlayer sur l'Apple TV et l'iPhone) ont leur
 * déclaration ici. Un moteur dont les capacités dépendent de l'appareil
 * (l'Apple TV et son décodeur Dolby Vision) part de sa déclaration et y pose
 * ce que l'appareil a répondu (`withHdr`).
 */

/** Les plages HDR qu'un moteur sait afficher. Le SDR va de soi. */
export interface HdrSupport {
  hdr10: boolean;
  /** HDR10+ : métadonnées dynamiques par-dessus le HDR10. */
  hdr10Plus: boolean;
  hlg: boolean;
  /** Dolby Vision à couche unique (profils 5, 8.x, 10). */
  dolbyVision: boolean;
  /**
   * Dolby Vision à couche d'amélioration (profil 7, disques UHD). mpv lit la
   * couche de base avec son RPU ; AVPlayer et les téléviseurs LG ne le lisent
   * pas — il leur faut le HDR10 de la base.
   */
  dolbyVisionEnhancementLayer: boolean;
}

/** Conteneur des segments HLS que le moteur lit. */
export type SegmentContainer = "ts" | "mp4";

export interface EngineCapabilities {
  /** Nom du moteur, pour les journaux et les tests. */
  engine: string;
  /**
   * Codecs vidéo décodés, dans l'ORDRE de préférence pour la sortie d'un
   * transcodage : le premier que le serveur a le droit d'encoder sert. Le HEVC
   * d'abord quand il est décodé : à débit égal, une image plus fine — mais
   * Jellyfin ne l'encode que si l'administrateur l'a permis
   * (« Autoriser l'encodage HEVC »), sinon il prend le suivant.
   */
  videoCodecs: readonly string[];
  hdr: HdrSupport;
  /** Codecs audio décodés (au sens de Jellyfin : `dts`, `truehd`, `eac3`…). */
  audioCodecs: readonly string[];
  /** Canaux audio au plus. */
  maxAudioChannels: number;
  segmentContainer: SegmentContainer;
}

const ALL_HDR: HdrSupport = {
  hdr10: true, hdr10Plus: true, hlg: true, dolbyVision: true, dolbyVisionEnhancementLayer: true,
};

/**
 * mpv (bureau Electron, mobile, Android TV) : ce que ffmpeg décode, donc tout.
 * Il lit le Dolby Vision (libplacebo applique le RPU) et le transport TS sans
 * restriction de codec audio — DTS et TrueHD compris.
 */
export const MPV_ENGINE: EngineCapabilities = {
  engine: "mpv",
  videoCodecs: ["hevc", "h264", "av1", "vp9"],
  hdr: ALL_HDR,
  audioCodecs: ["aac", "ac3", "eac3", "dts", "truehd", "flac", "opus", "mp3", "mp2", "vorbis", "alac", "pcm_s16le", "pcm_s24le"],
  maxAudioChannels: 8,
  segmentContainer: "ts",
};

/**
 * AVPlayer (Apple TV, iPhone, iPad) : le HEVC n'y passe en HLS qu'en fMP4.
 * Pas de DTS ni de TrueHD. L'AC3 et l'E-AC3 se lisent en lecture directe,
 * mais leur COPIE vers du fMP4 donne un init vide chez Jellyfin (cf.
 * `streamPlan.ts`) : la règle les retire d'elle-même sur ce conteneur.
 * Le Dolby Vision dépend de la box : `withHdr` y pose sa réponse.
 */
export const AVPLAYER_ENGINE: EngineCapabilities = {
  engine: "avplayer",
  videoCodecs: ["hevc", "h264"],
  hdr: { hdr10: true, hdr10Plus: true, hlg: true, dolbyVision: false, dolbyVisionEnhancementLayer: false },
  audioCodecs: ["aac", "ac3", "eac3", "flac", "alac", "mp3"],
  maxAudioChannels: 6,
  segmentContainer: "mp4",
};

/**
 * ExoPlayer (Android TV, Android mobile) : HEVC et HDR10/HLG décodés par les
 * puces des téléviseurs et des téléphones récents ; le Dolby Vision et le DTS
 * dépendent du modèle, on ne les promet pas. Le TS porte AC3 et E-AC3.
 */
export const EXOPLAYER_ENGINE: EngineCapabilities = {
  engine: "exoplayer",
  videoCodecs: ["hevc", "h264"],
  hdr: { hdr10: true, hdr10Plus: false, hlg: true, dolbyVision: false, dolbyVisionEnhancementLayer: false },
  audioCodecs: ["aac", "ac3", "eac3", "mp3", "opus", "flac"],
  maxAudioChannels: 6,
  segmentContainer: "ts",
};

/**
 * Le repli après une erreur de lecture : le plus sûr, rien de plus. H.264
 * SDR et AAC, que tout moteur lit — on ne réessaie pas une copie qui vient
 * peut-être d'échouer.
 */
export const SAFE_FALLBACK_ENGINE: EngineCapabilities = {
  engine: "safe",
  videoCodecs: ["h264"],
  hdr: { hdr10: false, hdr10Plus: false, hlg: false, dolbyVision: false, dolbyVisionEnhancementLayer: false },
  audioCodecs: ["aac"],
  maxAudioChannels: 6,
  segmentContainer: "ts",
};

/** Le moteur, avec les plages HDR que l'appareil a déclarées (module natif, profil). */
export function withHdr(engine: EngineCapabilities, hdr: Partial<HdrSupport>): EngineCapabilities {
  return { ...engine, hdr: { ...engine.hdr, ...hdr } };
}

/**
 * Les `VideoRangeType` de Jellyfin qu'un moteur lit, pour un codec qui porte
 * le HDR (HEVC, AV1). Le H.264 n'existe qu'en SDR (et en Dolby Vision à base
 * SDR, jamais rencontré hors des disques).
 */
export function readableRangeTypes(hdr: HdrSupport): string[] {
  const ranges = ["SDR"];
  if (hdr.hdr10) ranges.push("HDR10");
  if (hdr.hdr10Plus) ranges.push("HDR10Plus");
  if (hdr.hlg) ranges.push("HLG");
  if (hdr.dolbyVision) ranges.push("DOVI", "DOVIWithSDR");
  // Un Dolby Vision qui porte une base HDR10 ou HLG : le moteur sans Dolby
  // Vision en lit la base, celui qui l'a en lit tout.
  if (hdr.dolbyVision || hdr.hdr10) ranges.push("DOVIWithHDR10");
  if (hdr.dolbyVision || hdr.hdr10Plus) ranges.push("DOVIWithHDR10Plus");
  if (hdr.dolbyVision || hdr.hlg) ranges.push("DOVIWithHLG");
  if (hdr.dolbyVisionEnhancementLayer) ranges.push("DOVIWithEL", "DOVIWithELHDR10Plus");
  return ranges;
}
