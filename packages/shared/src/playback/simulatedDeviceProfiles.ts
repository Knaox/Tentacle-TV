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
 * Shield le 07/10 (plateforme + `FfmpegLibrary.supportsFormat`), cf.
 * `SHIELD_PRO_2019_PROFILE` ; l'AAC et le MP3 ont partout un décodeur.
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

/** Un décodeur Nvidia de la Shield, tel que relevé (le H.264 seul monte à 120 i/s en 1080p). */
function nvidia(
  codec: string, decoder: string, profiles: string[], maxLevel: number | null,
  [maxWidth, maxHeight]: [number, number], rates: [number, number, number],
) {
  return {
    codec, decoder, profiles, maxLevel, maxWidth, maxHeight,
    sizes: sizes(...rates), tenBit: codec === "hevc", hdr10: codec === "hevc", hdr10Plus: false,
  };
}

/**
 * La Shield TV Pro 2019 (Tegra X1+, « mdarcy ») de Damien, RELEVÉE le 07/10
 * par le module natif (`survey`, 55 ms), branchée à son téléviseur 4K
 * (HDR10 et Dolby Vision ; pas de HLG annoncé) et à un ampli qui prend tout
 * en passthrough. À noter : pas d'AV1 matériel, et le VP9 n'annonce que le
 * Profile 0 (8 bits). Brut : `.claude/locks/lite/L3-shield-profil-2026-10-07.json`.
 */
export const SHIELD_PRO_2019_PROFILE: DeviceMediaProfile = {
  version: DEVICE_MEDIA_PROFILE_VERSION,
  source: "simulated",
  name: "NVIDIA SHIELD Android TV · darcy",
  sdk: 30,
  video: [
    nvidia("h264", "OMX.Nvidia.h264.decode", ["Baseline", "Constrained Baseline", "Main", "High"], 52, [3840, 2176], [120, 120, 60]),
    nvidia("hevc", "OMX.Nvidia.h265.decode", ["Main", "Main 10"], 153, [3840, 2176], [60, 60, 60]),
    nvidia("vp9", "OMX.Nvidia.vp9.decode", ["Profile 0"], 51, [3840, 2176], [60, 60, 60]),
    nvidia("mpeg2video", "OMX.Nvidia.mpeg2v.decode", ["Simple", "Main"], null, [1920, 1088], [120, 120, 0]),
    nvidia("vc1", "OMX.Nvidia.vc1.decode", [], null, [3840, 2176], [120, 120, 0]),
    nvidia("mpeg4", "OMX.Nvidia.mp4.decode", [], null, [896, 896], [0, 0, 0]),
    nvidia("vp8", "OMX.Nvidia.vp8.decode", [], null, [3840, 2176], [120, 120, 60]),
  ],
  hdr: {
    display: { hdr10: true, hdr10Plus: false, hlg: false, dolbyVision: true },
    dolbyVisionProfiles: [4, 5, 8, 9],
  },
  audio: {
    passthrough: ["ac3", "eac3", "eac3-joc", "truehd", "dts", "dtshd"],
    decoded: APP_AUDIO_DECODERS,
    maxPcmChannels: 10,
  },
  display: { width: 3840, height: 2160, refreshRate: 59.94, maxWidth: 3840, maxHeight: 2160 },
};

/** Les profils qu'un banc peut injecter, par le nom de `debug.tentacle.media_profile`. */
export const SIMULATED_DEVICE_PROFILES: Readonly<Record<string, DeviceMediaProfile>> = {
  bcm7271: BCM7271_PROFILE,
  shield: SHIELD_PRO_2019_PROFILE,
};

/** Le profil simulé de ce nom (casse indifférente), ou `null`. */
export function simulatedDeviceProfile(name: string | null | undefined): DeviceMediaProfile | null {
  const key = name?.trim().toLowerCase();
  return key ? SIMULATED_DEVICE_PROFILES[key] ?? null : null;
}
