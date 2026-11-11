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
  /**
   * Le codec de SORTIE quand le serveur convertit le son (le premier de
   * `AudioCodec`) ; absent : l'AAC, comme partout. Seul le mode Lite d'Android
   * TV le pose (`liteConvertedAudioEngine` : E-AC3 ou AC3, reçus tels quels
   * par le téléviseur).
   */
  audioOutput?: string;
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

/**
 * Ce que la sonde d'un lecteur WEB a répondu, codec par codec
 * (`MediaSource.isTypeSupported` — `apps/web/src/lib/deviceProfile/codecs.ts`).
 */
export interface WebDecodeProbe {
  h264: boolean;
  aac: boolean;
  /** AV1 Main, 8 bits. */
  av1: boolean;
  /** AV1 Main, 10 bits : la condition du HDR. */
  av1TenBit: boolean;
  opus: boolean;
  flac: boolean;
  mp3: boolean;
}

/**
 * Le lecteur web (`<video>` + hls.js) d'un Chromium construit SANS les codecs
 * propriétaires : le bureau CEF et ses binaires publics, quand mpv ne lit pas
 * et que le lecteur web prend le relais. Mesuré le 11/11/2026 (CEF 156, macOS)
 * : H.264, AAC, HEVC, AC-3 refusés ; AV1 (8 et 10 bits), VP9, Opus, FLAC et
 * MP3 acceptés. Ce moteur-là ne lirait RIEN du profil d'un navigateur
 * ordinaire (H.264 + AAC en TS) : il DÉCLARE ce qu'il décode, et la règle en
 * tire un flux qu'il lit.
 *
 * - L'AV1, et lui seul : c'est la SORTIE d'un transcodage — Jellyfin l'encode
 *   si l'administrateur l'a permis (« Autoriser l'encodage AV1 ») ; une source
 *   AV1 se copie. Le VP9, que ce lecteur décode pourtant, n'est PAS déclaré :
 *   mesuré sur Jellyfin 12.4, `VideoCodec=av1,vp9` lui fait choisir le VP9 —
 *   maître sans codec vidéo, init jamais servi (502 après 30 s). Une source
 *   VP9 passe par la lecture directe (WebM, MKV, MP4), sinon elle est
 *   convertie en AV1.
 * - Le son converti sort en Opus (`audioOutput`), à défaut en FLAC ou en MP3 :
 *   jamais l'AAC, que ce lecteur ne décode pas.
 * - Le HDR10 et le HLG suivent le décodeur 10 bits (Chromium les ramène à
 *   l'écran) ; pas de Dolby Vision, dont il ne lit que la base.
 * - fMP4 : le seul conteneur HLS qui porte l'AV1, le VP9 et l'Opus.
 *
 * `null` : ce lecteur lit le H.264 et l'AAC (un navigateur ordinaire, Electron
 * : leur profil d'avant, inchangé), ou il n'a pas l'AV1 avec un son lisible —
 * rien que Jellyfin sache lui produire.
 */
export function openWebEngine(probe: WebDecodeProbe): EngineCapabilities | null {
  if (probe.h264 && probe.aac) return null;
  const audioCodecs = (["opus", "flac", "mp3"] as const).filter((codec) => probe[codec]);
  if (!probe.av1 || audioCodecs.length === 0) return null;
  const tenBit = probe.av1TenBit;
  return {
    engine: "web-open",
    videoCodecs: ["av1"],
    hdr: { hdr10: tenBit, hdr10Plus: tenBit, hlg: tenBit, dolbyVision: false, dolbyVisionEnhancementLayer: false },
    audioCodecs,
    maxAudioChannels: 6,
    audioOutput: audioCodecs[0],
    segmentContainer: "mp4",
  };
}

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
