/**
 * Ce que CET appareil décode et sort — relevé sur l'appareil lui-même, jamais
 * supposé d'après une liste fixe.
 *
 * Android TV le lit dans `MediaCodecList` (décodeurs MATÉRIELS seulement :
 * `c2.android.*`, `c2.google.*` et `OMX.google.*` sont des décodeurs logiciels,
 * qu'un Cortex-A53 ne tient pas en vidéo), dans les capacités HDR de l'écran
 * et dans celles de la sortie HDMI (`AudioCapabilities` de Media3). Le module
 * natif (`MediaCapabilitiesModule`, apps/tv) rend exactement cette forme, en
 * JSON ; `parseDeviceMediaProfile` la vérifie avant tout usage.
 *
 * Un banc injecte à la place un profil SIMULÉ (`simulatedDeviceProfiles.ts`) :
 * même forme, `source: "simulated"`.
 *
 * Ce profil ne décide de rien : les moteurs en tirent leur déclaration
 * (`deviceEngines.ts`), la règle de lecture son verdict
 * (`devicePlaybackVerdict.ts`).
 */

/** La version de la forme : un module natif plus ancien ou plus récent est ignoré. */
export const DEVICE_MEDIA_PROFILE_VERSION = 1;

/** Une définition testée sur le décodeur, et la cadence la plus haute qu'il y tient. */
export interface DecoderSizePoint {
  width: number;
  height: number;
  /**
   * Cadence la plus haute tenue à cette définition (parmi 24, 25, 30, 48, 50,
   * 60, 120), au sens de Media3 : points de performance (Android 10+), sinon
   * `areSizeAndRateSupported`. `0` : la définition n'est pas décodée.
   */
  maxFrameRate: number;
}

/** Un décodeur vidéo MATÉRIEL, pour un codec. */
export interface VideoDecoderCaps {
  /** Codec au sens de Jellyfin : `h264`, `hevc`, `vp9`, `av1`, `mpeg2video`, `vc1`, `mpeg4`, `vp8`. */
  codec: string;
  /** Nom du décodeur (`OMX.brcm.video.h265.decoder`, `c2.nvidia.hevc.decoder`) — journaux et rapport. */
  decoder: string;
  /**
   * Profils décodés, avec les mots de Jellyfin (`High`, `Main 10`, `Profile 2`…).
   * Vide : le décodeur ne les dit pas — aucun contrôle de profil alors.
   */
  profiles: string[];
  /**
   * Niveau le plus haut, dans l'unité du `Level` de Jellyfin (H.264 : 51 pour
   * 5.1 ; HEVC : 153 pour 5.1 ; AV1 : l'index `seq_level_idx`). Relevé pour le
   * rapport ; il ne DÉCIDE pas (cf. `devicePlaybackVerdict.ts`). `null` : inconnu.
   */
  maxLevel: number | null;
  /** Définition la plus grande que le décodeur annonce. */
  maxWidth: number;
  maxHeight: number;
  /** Les définitions courantes (720p, 1080p, 2160p) et la cadence tenue à chacune. */
  sizes: DecoderSizePoint[];
  /** Décode le 10 bits (HEVC Main 10, VP9 Profile 2, AV1 Main 10). */
  tenBit: boolean;
  /** Le décodeur déclare le HDR10 (profil `…HDR10`) — indicatif, le 10 bits suffit. */
  hdr10: boolean;
  /** Le décodeur déclare le HDR10+. */
  hdr10Plus: boolean;
}

/** Les plages HDR, côté écran (ce que la sortie HDMI annonce). */
export interface DisplayHdrTypes {
  hdr10: boolean;
  hdr10Plus: boolean;
  hlg: boolean;
  dolbyVision: boolean;
}

export interface DeviceHdrCaps {
  /** `Display.getHdrCapabilities()` (ou les types du mode, Android 14+). */
  display: DisplayHdrTypes;
  /**
   * Profils Dolby Vision décodés (`video/dolby-vision`) : 4, 5, 7, 8, 9, 10.
   * Vide : aucun décodeur Dolby Vision.
   */
  dolbyVisionProfiles: number[];
}

/**
 * Encodages que la sortie reçoit TELS QUELS (passthrough), au sens de
 * `AudioCapabilities` : `ac3`, `eac3`, `eac3-joc` (Atmos), `truehd`, `dts`,
 * `dtshd`. Ce que l'ampli ou le téléviseur décode lui-même.
 */
export type PassthroughEncoding = "ac3" | "eac3" | "eac3-joc" | "truehd" | "dts" | "dtshd";

export interface DeviceAudioCaps {
  passthrough: PassthroughEncoding[];
  /**
   * Codecs que l'appareil DÉCODE lui-même (décodeurs de la plateforme, plus
   * l'extension FFmpeg du lecteur), au sens de Jellyfin : `aac`, `ac3`,
   * `eac3`, `dts`, `truehd`, `flac`, `opus`, `mp3`… Un son décodé coûte du
   * processeur (sensible sur un A53), mais se lit.
   */
  decoded: string[];
  /** Canaux PCM que la sortie accepte (`AudioCapabilities.maxChannelCount`). */
  maxPcmChannels: number;
}

/** La sortie vidéo : le mode en cours, et le plus grand que l'écran propose. */
export interface DeviceDisplayCaps {
  width: number;
  height: number;
  refreshRate: number;
  maxWidth: number;
  maxHeight: number;
}

export interface DeviceMediaProfile {
  version: typeof DEVICE_MEDIA_PROFILE_VERSION;
  /** `native` : lu sur l'appareil ; `simulated` : injecté par un banc. */
  source: "native" | "simulated";
  /** Nom lisible : modèle et puce (`SHIELD Android TV · tegra`), ou le profil simulé (`BCM7271`). */
  name: string;
  /** Version d'Android (API), pour le rapport. */
  sdk: number;
  /** Un décodeur matériel par codec (le meilleur quand il y en a plusieurs). */
  video: VideoDecoderCaps[];
  hdr: DeviceHdrCaps;
  audio: DeviceAudioCaps;
  display: DeviceDisplayCaps;
}

/** Le décodeur matériel de ce codec, s'il y en a un. */
export function hardwareDecoder(profile: DeviceMediaProfile, codec: string): VideoDecoderCaps | null {
  const wanted = codec.toLowerCase();
  return profile.video.find((decoder) => decoder.codec === wanted) ?? null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const num = (value: unknown, fallback = 0): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const bool = (value: unknown): boolean => value === true;
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

const PASSTHROUGH: ReadonlySet<string> = new Set(["ac3", "eac3", "eac3-joc", "truehd", "dts", "dtshd"]);

function parseDecoder(raw: unknown): VideoDecoderCaps | null {
  if (!isRecord(raw) || typeof raw.codec !== "string") return null;
  const sizes = Array.isArray(raw.sizes)
    ? raw.sizes.filter(isRecord).map((s) => ({ width: num(s.width), height: num(s.height), maxFrameRate: num(s.maxFrameRate) }))
    : [];
  return {
    codec: raw.codec.toLowerCase(),
    decoder: typeof raw.decoder === "string" ? raw.decoder : "",
    profiles: strings(raw.profiles),
    maxLevel: typeof raw.maxLevel === "number" && raw.maxLevel > 0 ? raw.maxLevel : null,
    maxWidth: num(raw.maxWidth),
    maxHeight: num(raw.maxHeight),
    sizes,
    tenBit: bool(raw.tenBit),
    hdr10: bool(raw.hdr10),
    hdr10Plus: bool(raw.hdr10Plus),
  };
}

/**
 * Le profil rendu par le module natif, vérifié : `null` s'il n'a pas la forme
 * attendue (module absent, d'une autre version). Rien n'est alors supposé :
 * les moteurs gardent leur déclaration fixe.
 */
export function parseDeviceMediaProfile(raw: unknown): DeviceMediaProfile | null {
  if (!isRecord(raw) || raw.version !== DEVICE_MEDIA_PROFILE_VERSION) return null;
  if (!Array.isArray(raw.video) || !isRecord(raw.hdr) || !isRecord(raw.audio) || !isRecord(raw.display)) return null;
  const display = raw.hdr.display;
  const hdrDisplay = isRecord(display) ? display : {};
  return {
    version: DEVICE_MEDIA_PROFILE_VERSION,
    source: raw.source === "simulated" ? "simulated" : "native",
    name: typeof raw.name === "string" ? raw.name : "",
    sdk: num(raw.sdk),
    video: raw.video.map(parseDecoder).filter((d): d is VideoDecoderCaps => d !== null),
    hdr: {
      display: {
        hdr10: bool(hdrDisplay.hdr10), hdr10Plus: bool(hdrDisplay.hdr10Plus),
        hlg: bool(hdrDisplay.hlg), dolbyVision: bool(hdrDisplay.dolbyVision),
      },
      dolbyVisionProfiles: Array.isArray(raw.hdr.dolbyVisionProfiles)
        ? raw.hdr.dolbyVisionProfiles.filter((p): p is number => typeof p === "number")
        : [],
    },
    audio: {
      passthrough: strings(raw.audio.passthrough).filter((e): e is PassthroughEncoding => PASSTHROUGH.has(e)),
      decoded: strings(raw.audio.decoded).map((c) => c.toLowerCase()),
      maxPcmChannels: num(raw.audio.maxPcmChannels, 2),
    },
    display: {
      width: num(raw.display.width), height: num(raw.display.height), refreshRate: num(raw.display.refreshRate),
      maxWidth: num(raw.display.maxWidth), maxHeight: num(raw.display.maxHeight),
    },
  };
}
