/**
 * Ce que l'APPAREIL décode — le pendant matériel de `engineCapabilities.ts`.
 *
 * Un moteur (ExoPlayer, mpv) dit ce qu'il SAIT lire ; l'appareil dit ce que
 * ses décodeurs matériels tiennent vraiment : codecs, profils, niveaux,
 * résolution et cadence au plus, 10 bits, plages HDR, et ce que la sortie
 * HDMI accepte en direct pour le son. Les deux se croisent
 * (`engineOnDevice`) : un moteur ne promet jamais au serveur plus que la puce
 * ne décode. Une box Android TV faible (Broadcom BCM7271, quatre Cortex-A53)
 * ne doit jamais retomber sur un décodage logiciel.
 *
 * Le profil se MESURE sur l'appareil (MediaCodecList, capacités HDMI) ; à
 * l'émulateur, dont les décodeurs sont logiciels et ne prouvent rien, on en
 * SIMULE un (`SIMULATED_DECODER_PROFILES`), injecté dans l'app de mesure par
 * `adb shell setprop debug.tentacle.caps <id>`.
 *
 * Les noms de codecs et de profils sont ceux de Jellyfin (`h264`, `hevc`,
 * `vp9`, `av1` ; `high`, `main 10`, `profile 2`…), comme dans
 * `engineCapabilities.ts`.
 */
import type { EngineCapabilities, HdrSupport } from "./engineCapabilities";

/** La limite d'UN décodeur vidéo matériel. */
export interface VideoDecoderLimit {
  /** Codec au sens de Jellyfin. */
  codec: string;
  /** Profils décodés, au sens de Jellyfin (`high`, `main 10`, `profile 2`). */
  profiles: readonly string[];
  /** Niveau au plus, au sens de Jellyfin (H.264 `51` = 5.1 ; HEVC `153` = 5.1). */
  maxLevel: number;
  maxWidth: number;
  maxHeight: number;
  /** Images par seconde au plus, à la résolution maximale. */
  maxFps: number;
  /** Profondeur de couleur au plus : 8 ou 10 bits. */
  maxBitDepth: 8 | 10;
}

/** Le son : ce que l'appareil décode lui-même, et ce que la sortie HDMI prend en direct. */
export interface AudioOutputSupport {
  /** Décodé par l'appareil (au sens de Jellyfin : `aac`, `ac3`…). */
  decode: readonly string[];
  /** Envoyé tel quel à l'ampli ou au téléviseur (passthrough HDMI). */
  passthrough: readonly string[];
  /** Canaux au plus, toutes voies confondues. */
  maxChannels: number;
}

/** La sortie vidéo de l'appareil (souvent 1080p sur une box qui décode le 4K). */
export interface DisplayOutput {
  width: number;
  height: number;
  /** Fréquences d'écran proposées par la sortie, en Hz. */
  refreshRates: readonly number[];
}

export interface DeviceDecoderProfile {
  /** Identifiant court (`bcm7271`) — celui de la propriété de débogage. */
  id: string;
  /** Pour les journaux et les rapports. */
  label: string;
  /** `measured` : relevé sur l'appareil ; `simulated` : posé à la main, pour le banc. */
  source: "measured" | "simulated";
  /** Les décodeurs MATÉRIELS ; un codec absent n'a pas de décodeur matériel. */
  video: readonly VideoDecoderLimit[];
  hdr: HdrSupport;
  audio: AudioOutputSupport;
  display: DisplayOutput;
}

const NO_HDR: HdrSupport = {
  hdr10: false, hdr10Plus: false, hlg: false, dolbyVision: false, dolbyVisionEnhancementLayer: false,
};

/**
 * Broadcom BCM7271 — la box net+ UZX4020NPS (Technicolor), quatre Cortex-A53
 * à 1,6 GHz, 2 Go. Fiche du constructeur et de l'opérateur : H.264, HEVC
 * Main 10 et VP9 Profile 2 en matériel, PAS d'AV1. Les limites précises
 * (cadence du H.264 en 4K, Dolby Vision, DTS en direct) sont des HYPOTHÈSES
 * prudentes, à remplacer par le relevé de la vraie box (MediaCodecList).
 */
export const BCM7271_SIMULATED: DeviceDecoderProfile = {
  id: "bcm7271",
  label: "Broadcom BCM7271 (box net+, simulée)",
  source: "simulated",
  video: [
    { codec: "hevc", profiles: ["main", "main 10"], maxLevel: 153, maxWidth: 3840, maxHeight: 2160, maxFps: 60, maxBitDepth: 10 },
    { codec: "vp9", profiles: ["profile 0", "profile 2"], maxLevel: 51, maxWidth: 3840, maxHeight: 2160, maxFps: 60, maxBitDepth: 10 },
    { codec: "h264", profiles: ["baseline", "constrained baseline", "main", "high"], maxLevel: 51, maxWidth: 3840, maxHeight: 2160, maxFps: 30, maxBitDepth: 8 },
  ],
  hdr: { ...NO_HDR, hdr10: true, hlg: true },
  audio: {
    decode: ["aac", "mp3", "opus", "flac", "vorbis", "ac3", "eac3"],
    passthrough: ["ac3", "eac3"],
    maxChannels: 6,
  },
  display: { width: 3840, height: 2160, refreshRates: [50, 60] },
};

/** Les profils simulés du banc, par identifiant (`debug.tentacle.caps`). */
export const SIMULATED_DECODER_PROFILES: Readonly<Record<string, DeviceDecoderProfile>> = {
  [BCM7271_SIMULATED.id]: BCM7271_SIMULATED,
};

/** Le profil simulé d'un identifiant de la propriété de débogage, ou `null`. */
export function simulatedDecoderProfile(id: string | null | undefined): DeviceDecoderProfile | null {
  const key = id?.trim().toLowerCase();
  if (!key) return null;
  return SIMULATED_DECODER_PROFILES[key] ?? null;
}

/** La limite du décodeur matériel d'un codec, ou `null` s'il n'y en a pas. */
export function videoLimitOf(device: DeviceDecoderProfile, codec: string): VideoDecoderLimit | null {
  return device.video.find((limit) => limit.codec === codec) ?? null;
}

/**
 * Le moteur RESTREINT à l'appareil : ses codecs vidéo gardés dans SON ordre de
 * préférence s'ils ont un décodeur matériel, ses plages HDR si la puce les
 * affiche aussi, ses codecs audio si l'appareil les décode ou les envoie en
 * direct, et le moins de canaux des deux. Le conteneur des segments reste
 * celui du moteur.
 */
export function engineOnDevice(engine: EngineCapabilities, device: DeviceDecoderProfile): EngineCapabilities {
  const hardware = new Set(device.video.map((limit) => limit.codec));
  const audio = new Set([...device.audio.decode, ...device.audio.passthrough]);
  const hdr = Object.fromEntries(
    (Object.keys(engine.hdr) as (keyof HdrSupport)[]).map((key) => [key, engine.hdr[key] && device.hdr[key]]),
  ) as unknown as HdrSupport;
  return {
    ...engine,
    engine: `${engine.engine}@${device.id}`,
    videoCodecs: engine.videoCodecs.filter((codec) => hardware.has(codec)),
    hdr,
    audioCodecs: engine.audioCodecs.filter((codec) => audio.has(codec)),
    maxAudioChannels: Math.min(engine.maxAudioChannels, device.audio.maxChannels),
  };
}
