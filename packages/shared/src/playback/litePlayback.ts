/**
 * La lecture en mode LITE (Android TV faibles : box net+, 4 × Cortex-A53,
 * 2 Go, Wi-Fi seul) — une règle pure : le niveau de l'appareil en entrée,
 * les réglages des moteurs en sortie. Les adaptateurs (vues natives d'Exo et
 * de mpv) ne font qu'APPLIQUER.
 *
 * Le niveau est un TRAIT (`normal` | `lite`), décidé ailleurs (détection de
 * l'appareil). En `normal` — l'Apple TV, la Shield — rien ne change : chaque
 * fonction rend `null` ou une liste vide, et le natif garde ses valeurs
 * d'avant, à l'octet près.
 */

import type { PassthroughEncoding } from "./deviceMediaProfile";
import type { EngineCapabilities } from "./engineCapabilities";

export type PlaybackTier = "normal" | "lite";

/**
 * Le contrôle de tampon d'ExoPlayer (`DefaultLoadControl`). Les octets cibles
 * passent AVANT la durée (`prioritizeTimeOverSizeThresholds` faux, le défaut
 * de Media3) : le tampon s'arrête à `targetBufferBytes`, même sous
 * `minBufferMs`.
 */
export interface ExoBufferPolicy {
  minBufferMs: number;
  maxBufferMs: number;
  bufferForPlaybackMs: number;
  bufferForPlaybackAfterRebufferMs: number;
  /** Plafond du tampon, en octets ; `null` : celui de Media3 (calculé des pistes). */
  targetBufferBytes: number | null;
}

/**
 * Le tampon d'avant, celui du mode normal (`ExoPlayerFactory.createLoadControl`) :
 * 50 s au moins, 300 s au plus. Sans plafond fixé, Media3 en prend un des
 * pistes : 2000 × 64 Kio = 131 Mio pour la vidéo (`DEFAULT_VIDEO_BUFFER_SIZE`),
 * atteint par tout flux au-delà de ~3,5 Mb/s sur 300 s — DANS le tas Java
 * (`DefaultAllocator`, des `byte[]`), sur une box dont toute l'app doit tenir
 * en 100 à 200 Mo avant le lowmemorykiller.
 */
export const NORMAL_EXO_BUFFER: Readonly<ExoBufferPolicy> = {
  minBufferMs: 50_000,
  maxBufferMs: 300_000,
  bufferForPlaybackMs: 2_500,
  bufferForPlaybackAfterRebufferMs: 5_000,
  targetBufferBytes: null,
};

const MIB = 1024 * 1024;

/**
 * Le tampon Lite : 48 Mio au plus (au lieu de 131), 15 à 30 s. Au plafond de
 * débit de la lecture directe (`LITE_DIRECT_PLAY_MAX_BITRATE`, 50 Mb/s), les
 * 48 Mio tiennent ~8 s ; un 4K web (15-25 Mb/s) ~16-26 s ; un 1080p (8 Mb/s)
 * les 30 s. Assez pour passer un creux de Wi-Fi, jamais un tiers de la
 * mémoire de l'app. Le démarrage (2,5 s) et la reprise après un arrêt (5 s)
 * restent ceux d'avant : rien ne démarre plus tard.
 */
export const LITE_EXO_BUFFER: Readonly<ExoBufferPolicy> = {
  minBufferMs: 15_000,
  maxBufferMs: 30_000,
  bufferForPlaybackMs: 2_500,
  bufferForPlaybackAfterRebufferMs: 5_000,
  targetBufferBytes: 48 * MIB,
};

/** Le tampon d'ExoPlayer à poser ; `null` : le natif garde le sien (mode normal, inchangé). */
export function exoBufferPolicy(tier: PlaybackTier): Readonly<ExoBufferPolicy> | null {
  return tier === "lite" ? LITE_EXO_BUFFER : null;
}

/**
 * Le plafond de débit de la LECTURE DIRECTE en Lite, en b/s (débit de
 * l'image). Au-delà — un remux UHD (60-100 Mb/s) —, le serveur sert le
 * titre à ce débit, à la définition de l'écran : sur le Wi-Fi d'une box,
 * avec un tampon de 48 Mio, un remux à 80 Mb/s ne tient que 5 s de réserve.
 * Contrepartie assumée : un réencodage d'une source HDR sort en SDR
 * (Jellyfin, mesuré) — seuls les fichiers au-delà du plafond la paient.
 */
export const LITE_DIRECT_PLAY_MAX_BITRATE = 50_000_000;

/** Ce que le mode Lite change dans la DÉCISION de lecture (`devicePlaybackVerdict`). */
export interface LitePlaybackPolicy {
  /** Débit d'image au-delà duquel la lecture directe cède la place au serveur, en b/s. */
  directPlayMaxBitrate: number;
  /**
   * Le budget de processeur d'un son DÉCODÉ sur l'appareil, en millièmes d'un
   * cœur de box (A53 à 1,6 GHz) : au-delà, le serveur convertit le son
   * (`audioDecodeCost.ts`).
   */
  audioDecodeBudget: number;
}

/** Le budget du son décodé : 10 % d'un cœur d'A53 (voir `audioDecodeCost.ts`). */
export const LITE_AUDIO_DECODE_BUDGET = 100;

export function litePlaybackPolicy(tier: PlaybackTier): LitePlaybackPolicy | null {
  if (tier !== "lite") return null;
  return { directPlayMaxBitrate: LITE_DIRECT_PLAY_MAX_BITRATE, audioDecodeBudget: LITE_AUDIO_DECODE_BUDGET };
}

/**
 * Le moteur d'un flux dont le serveur CONVERTIT le son, en Lite : les sons que
 * la sortie HDMI reçoit tels quels (E-AC3, puis AC3) passent en tête de la
 * liste — Jellyfin encode le premier qu'il a le droit d'encoder. Le téléviseur
 * ou l'ampli décode alors le son converti : rien sur le processeur de la box
 * (un AAC 5.1, premier sinon, s'y décoderait). Sans sortie qui les reçoive :
 * la liste d'avant.
 */
export function liteConvertedAudioEngine(engine: EngineCapabilities, passthrough: readonly PassthroughEncoding[]): EngineCapabilities {
  const output = (["eac3", "ac3"] as const).find((codec) => passthrough.includes(codec) && engine.audioCodecs.includes(codec));
  return output ? { ...engine, audioOutput: output } : engine;
}

/**
 * Les options de mpv qui changent en Lite, posées APRÈS celles d'avant
 * (`MpvOptions.kt`) — noms de propriétés mpv, traversés par chaîne, jamais
 * renommés. Vide en mode normal.
 *
 * - `hwdec` : la liste d'avant, sans rien d'autre — `mediacodec` (zéro copie,
 *   `AImageReader` sous `vo=gpu`), puis `mediacodec-copy`. mpv retombe de
 *   lui-même sur le décodage LOGICIEL quand aucun ne s'ouvre : c'est la garde
 *   (tv-core `mpvDecoderVerdict`) qui l'interdit, par `hwdec-current`.
 * - tampons du démuxeur : 32 Mio devant, 8 Mio derrière (au lieu de 64 + 64) —
 *   mpv ne lit ici que des flux du serveur, plafonnés à l'écran.
 */
export function mpvOptionOverrides(tier: PlaybackTier): Array<[string, string]> {
  if (tier !== "lite") return [];
  return [
    ["hwdec", "mediacodec,mediacodec-copy"],
    ["demuxer-max-bytes", String(32 * MIB)],
    ["demuxer-max-back-bytes", String(8 * MIB)],
  ];
}
