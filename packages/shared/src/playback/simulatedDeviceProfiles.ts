import { DEVICE_MEDIA_PROFILE_VERSION, type DecoderSizePoint, type DeviceMediaProfile } from "./deviceMediaProfile";

/**
 * Les profils SIMULÉS qu'un banc injecte à la place du vrai : l'émulateur
 * Android TV n'a que des décodeurs logiciels (`c2.android.*`), il ne dit rien
 * d'une box. Sur l'émulateur, `adb shell setprop debug.tentacle.media_profile
 * bcm7271` puis une relance de l'app : le module natif annonce ce nom, et
 * l'app lit le profil ci-dessous au lieu de celui de l'émulateur
 * (`apps/tv/src/lib/deviceMediaProfile.ts`). Propriété vide : le vrai profil.
 * Seules l'app de MESURE (`*.perf`) et une construction de développement
 * l'écoutent : une propriété oubliée sur un vrai appareil ne change jamais le
 * profil de l'app de l'utilisateur.
 */

/** Les trois définitions qu'on teste sur chaque décodeur, à la cadence tenue. */
function sizes(max720: number, max1080: number, max2160: number): DecoderSizePoint[] {
  return [
    { width: 1280, height: 720, maxFrameRate: max720 },
    { width: 1920, height: 1080, maxFrameRate: max1080 },
    { width: 3840, height: 2160, maxFrameRate: max2160 },
  ];
}

/**
 * Ce que l'extension FFmpeg du lecteur décode, sur tout appareil (elle est
 * dans l'app) — complété par les décodeurs de la plateforme. Relevé sur la
 * Shield (`FfmpegLibrary.supportsFormat`), cf. `SHIELD_PRO_2019_PROFILE`.
 */
const APP_AUDIO_DECODERS = ["aac", "ac3", "eac3", "dts", "truehd", "flac", "opus", "mp3", "vorbis", "alac", "pcm_s16le", "pcm_s24le"];

/**
 * net+ Box TV UZX4020NPS (Technicolor) : Broadcom BCM7271, 4 × Cortex-A53,
 * 2 Go. Décodage matériel H.264 (jusqu'en 4K30, ce que Broadcom annonce pour
 * l'AVC), HEVC (Main 10, 4K60), VP9 (Profile 2, 4K60), MPEG-2 ; PAS d'AV1,
 * pas de Dolby Vision. HYPOTHÈSES à relever sur la vraie box : les cadences,
 * les niveaux, et l'absence de décodeur Dolby Vision. Branchée au cas le plus
 * contraint : un téléviseur 1080p SDR, son par HDMI en AC3 / E-AC3 / Atmos
 * seulement (ni TrueHD ni DTS), haut-parleurs stéréo.
 */
export const BCM7271_PROFILE: DeviceMediaProfile = {
  version: DEVICE_MEDIA_PROFILE_VERSION,
  source: "simulated",
  name: "BCM7271",
  sdk: 30,
  video: [
    {
      codec: "hevc", decoder: "OMX.brcm.video.h265.decoder", profiles: ["Main", "Main 10"], maxLevel: 153,
      maxWidth: 3840, maxHeight: 2160, sizes: sizes(60, 60, 60), tenBit: true, hdr10: true, hdr10Plus: false,
    },
    {
      codec: "h264", decoder: "OMX.brcm.video.h264.decoder", profiles: ["Baseline", "Main", "High"], maxLevel: 51,
      maxWidth: 3840, maxHeight: 2160, sizes: sizes(60, 60, 30), tenBit: false, hdr10: false, hdr10Plus: false,
    },
    {
      codec: "vp9", decoder: "OMX.brcm.video.vp9.decoder", profiles: ["Profile 0", "Profile 2"], maxLevel: null,
      maxWidth: 3840, maxHeight: 2160, sizes: sizes(60, 60, 60), tenBit: true, hdr10: true, hdr10Plus: false,
    },
    {
      codec: "mpeg2video", decoder: "OMX.brcm.video.mpeg2.decoder", profiles: ["Main"], maxLevel: null,
      maxWidth: 1920, maxHeight: 1088, sizes: sizes(60, 60, 0), tenBit: false, hdr10: false, hdr10Plus: false,
    },
  ],
  hdr: {
    display: { hdr10: false, hdr10Plus: false, hlg: false, dolbyVision: false },
    dolbyVisionProfiles: [],
  },
  audio: {
    passthrough: ["ac3", "eac3", "eac3-joc"],
    decoded: APP_AUDIO_DECODERS,
    maxPcmChannels: 2,
  },
  display: { width: 1920, height: 1080, refreshRate: 60, maxWidth: 1920, maxHeight: 1080 },
};

/** Les profils qu'un banc peut injecter, par le nom de `debug.tentacle.media_profile`. */
export const SIMULATED_DEVICE_PROFILES: Readonly<Record<string, DeviceMediaProfile>> = {
  bcm7271: BCM7271_PROFILE,
};

/** Le profil simulé de ce nom (casse indifférente), ou `null`. */
export function simulatedDeviceProfile(name: string | null | undefined): DeviceMediaProfile | null {
  const key = name?.trim().toLowerCase();
  return key ? SIMULATED_DEVICE_PROFILES[key] ?? null : null;
}
