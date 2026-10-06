import { hardwareDecoder, type DeviceMediaProfile } from "./deviceMediaProfile";
import { EXOPLAYER_ENGINE, MPV_ENGINE, type EngineCapabilities, type HdrSupport } from "./engineCapabilities";

/**
 * Les moteurs d'Android TV, déclarés d'après CET appareil (`DeviceMediaProfile`)
 * au lieu d'une liste fixe. Le principe de `engineCapabilities.ts` ne change
 * pas — le moteur déclare, `planStream` décide —, seule la déclaration vient
 * du relevé : un codec n'y figure que s'il a un décodeur MATÉRIEL.
 *
 * Sans profil (module natif absent, forme inconnue), chaque moteur garde sa
 * déclaration fixe : rien n'est supposé.
 */

/** Ordre de préférence d'un codec de sortie : le HEVC d'abord (cf. `EngineCapabilities.videoCodecs`). */
const OUTPUT_ORDER = ["hevc", "h264", "av1", "vp9"] as const;

/** Les codecs vidéo de `base` que l'appareil décode en matériel, H.264 toujours gardé. */
function hardwareVideoCodecs(profile: DeviceMediaProfile, base: readonly string[]): string[] {
  const kept = OUTPUT_ORDER.filter((codec) => base.includes(codec) && hardwareDecoder(profile, codec) !== null);
  // Le H.264 est la sortie universelle d'un transcodage : sans lui, la liste
  // pourrait être vide et l'URL invalide. Aucune box sans décodeur H.264 n'existe.
  return kept.includes("h264") ? kept : [...kept, "h264"];
}

/** L'appareil lit-il ce son : décodé par lui, ou reçu tel quel par la sortie ? */
export function deviceReadsAudio(profile: DeviceMediaProfile, codec: string): boolean {
  const wanted = codec.toLowerCase();
  if (profile.audio.decoded.includes(wanted)) return true;
  const passthrough: readonly string[] = profile.audio.passthrough;
  if (wanted === "dts") return passthrough.includes("dts") || passthrough.includes("dtshd");
  return passthrough.includes(wanted);
}

/**
 * Les plages HDR que l'appareil DÉCODE — c'est le décodeur qui compte, pas
 * l'écran : une box branchée à un téléviseur SDR décode le HDR10 et le ramène
 * elle-même au SDR (Broadcom, Tegra), sans un transcodage du serveur.
 *
 * - HDR10, HDR10+ et HLG : un décodeur HEVC 10 bits (le HDR10+ se lit au moins
 *   comme son HDR10 de base) ;
 * - Dolby Vision : un décodeur du profil 5 (le seul sans base lisible
 *   autrement) ; les profils 8 et 7 se lisent par leur base HDR10 ;
 * - jamais la couche d'amélioration (profil 7) dans une COPIE de Jellyfin :
 *   non mesurée sur ExoPlayer, elle reste au réencodage, comme avant.
 */
export function deviceHdr(profile: DeviceMediaProfile): HdrSupport {
  const tenBit = !!hardwareDecoder(profile, "hevc")?.tenBit;
  return {
    hdr10: tenBit, hdr10Plus: tenBit, hlg: tenBit,
    dolbyVision: tenBit && profile.hdr.dolbyVisionProfiles.includes(5),
    dolbyVisionEnhancementLayer: false,
  };
}

/**
 * ExoPlayer, d'après l'appareil : les codecs vidéo matériels, le HDR décodé,
 * et les sons de sa déclaration mesurée (`EXOPLAYER_ENGINE`) que l'appareil
 * lit — jamais un son de plus dans les segments (le DTS et le TrueHD copiés
 * en TS ne sont pas mesurés sur ExoPlayer ; en lecture directe, eux se lisent).
 */
export function exoPlayerEngineFor(profile: DeviceMediaProfile | null): EngineCapabilities {
  if (!profile) return EXOPLAYER_ENGINE;
  const audio = EXOPLAYER_ENGINE.audioCodecs.filter((codec) => codec === "aac" || deviceReadsAudio(profile, codec));
  return {
    ...EXOPLAYER_ENGINE,
    engine: `exoplayer:${profile.name}`,
    videoCodecs: hardwareVideoCodecs(profile, OUTPUT_ORDER),
    hdr: deviceHdr(profile),
    audioCodecs: audio,
  };
}

/**
 * mpv sur Android TV, d'après l'appareil : il décode par MediaCodec
 * (`hwdec=mediacodec`) et ne doit JAMAIS retomber sur le logiciel d'un A53.
 * Ses codecs vidéo se limitent donc aux décodeurs matériels, et le HDR (que
 * libplacebo sait tout lire, Dolby Vision compris) à un HEVC 10 bits matériel.
 * Le son, lui, reste celui de ffmpeg : tout se décode.
 */
export function mpvEngineFor(profile: DeviceMediaProfile | null): EngineCapabilities {
  if (!profile) return MPV_ENGINE;
  const tenBit = !!hardwareDecoder(profile, "hevc")?.tenBit;
  const none: HdrSupport = { hdr10: false, hdr10Plus: false, hlg: false, dolbyVision: false, dolbyVisionEnhancementLayer: false };
  return {
    ...MPV_ENGINE,
    engine: `mpv:${profile.name}`,
    videoCodecs: hardwareVideoCodecs(profile, MPV_ENGINE.videoCodecs),
    hdr: tenBit ? MPV_ENGINE.hdr : none,
  };
}
