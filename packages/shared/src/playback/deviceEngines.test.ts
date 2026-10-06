import { describe, expect, it } from "vitest";
import type { DeviceMediaProfile } from "./deviceMediaProfile";
import { deviceHdr, deviceReadsAudio, exoPlayerEngineFor, mpvEngineFor } from "./deviceEngines";
import { AVPLAYER_ENGINE, EXOPLAYER_ENGINE, MPV_ENGINE, withHdr } from "./engineCapabilities";
import { engineTranscodingProfiles } from "./engineProfiles";
import { BCM7271_PROFILE } from "./simulatedDeviceProfiles";
import { planStream } from "./streamPlan";

/** Une vieille box : H.264 seul, sans HEVC ni sortie HDMI multicanal. */
const H264_ONLY: DeviceMediaProfile = {
  ...BCM7271_PROFILE,
  name: "h264-only",
  video: BCM7271_PROFILE.video.filter((decoder) => decoder.codec === "h264"),
  audio: { passthrough: [], decoded: ["aac", "mp3"], maxPcmChannels: 2 },
};

/** Un HEVC 8 bits seulement : pas de HDR décodable. */
const HEVC_8BIT: DeviceMediaProfile = {
  ...BCM7271_PROFILE,
  name: "hevc-8bit",
  video: BCM7271_PROFILE.video.map((decoder) => (decoder.codec === "hevc" ? { ...decoder, tenBit: false, profiles: ["Main"] } : decoder)),
};

describe("sans profil, rien n'est supposé", () => {
  it("ExoPlayer et mpv gardent leur déclaration fixe", () => {
    expect(exoPlayerEngineFor(null)).toBe(EXOPLAYER_ENGINE);
    expect(mpvEngineFor(null)).toBe(MPV_ENGINE);
  });
});

describe("ExoPlayer d'après l'appareil — BCM7271", () => {
  const exo = exoPlayerEngineFor(BCM7271_PROFILE);

  it("ne déclare que les codecs à décodeur MATÉRIEL : jamais l'AV1", () => {
    expect(exo.videoCodecs).toEqual(["hevc", "h264", "vp9"]);
    expect(exo.videoCodecs).not.toContain("av1");
  });

  it("le HDR suit le décodeur HEVC 10 bits, pas l'écran (SDR ici) ; pas de Dolby Vision", () => {
    expect(exo.hdr).toEqual({ hdr10: true, hdr10Plus: true, hlg: true, dolbyVision: false, dolbyVisionEnhancementLayer: false });
  });

  it("les sons des segments restent ceux mesurés sur ExoPlayer (ni DTS ni TrueHD en TS)", () => {
    expect(exo.audioCodecs).toEqual(EXOPLAYER_ENGINE.audioCodecs);
    expect(exo.segmentContainer).toBe("ts");
    expect(exo.maxAudioChannels).toBe(EXOPLAYER_ENGINE.maxAudioChannels);
  });

  it("une conversion demande du HEVC (puis du H.264) et copie une image HDR10", () => {
    const plan = planStream({ engine: exo, audio: { Codec: "aac", BitRate: 256_000, Channels: 2 }, tier: null });
    expect(plan.params.VideoCodec).toBe("hevc,h264");
    expect(plan.params["hevc-rangetype"]).toBe("SDR,HDR10,HDR10Plus,HLG,DOVIWithHDR10,DOVIWithHDR10Plus,DOVIWithHLG");
    expect(plan.params["h264-rangetype"]).toBe("SDR");
  });

  it("le DeviceProfile de Jellyfin en sort de la même règle (HEVC en tête, repli H.264 + AAC)", () => {
    const [primary, fallback] = engineTranscodingProfiles(exo);
    expect(primary).toMatchObject({ Container: "ts", VideoCodec: "hevc,h264" });
    expect(fallback).toMatchObject({ Container: "ts", VideoCodec: "h264", AudioCodec: "aac" });
  });
});

describe("ExoPlayer d'après l'appareil — cas limites", () => {
  it("sans HEVC : H.264 seul, et jamais une liste vide", () => {
    const exo = exoPlayerEngineFor(H264_ONLY);
    expect(exo.videoCodecs).toEqual(["h264"]);
    expect(planStream({ engine: exo, audio: null, tier: { totalBitrate: 8_000_000, height: 1080 } }).params.VideoCodec).toBe("h264");
  });

  it("sans décodeur AC3 ni sortie AC3 : l'AC3 n'est plus copié, il est converti", () => {
    const exo = exoPlayerEngineFor(H264_ONLY);
    expect(exo.audioCodecs).toEqual(["aac", "mp3"]);
    const plan = planStream({ engine: exo, audio: { Codec: "ac3", BitRate: 640_000, Channels: 6 }, tier: null });
    expect(plan.copiesAudio).toBe(false);
    expect(plan.audioReason).toBe("AudioCodecNotSupported");
  });

  it("un HEVC 8 bits ne promet aucun HDR : la copie d'une image HDR est refusée à Jellyfin", () => {
    expect(deviceHdr(HEVC_8BIT)).toEqual({ hdr10: false, hdr10Plus: false, hlg: false, dolbyVision: false, dolbyVisionEnhancementLayer: false });
    expect(planStream({ engine: exoPlayerEngineFor(HEVC_8BIT), audio: null, tier: null }).params["hevc-rangetype"]).toBe("SDR");
  });

  it("le Dolby Vision n'est promis qu'avec un décodeur du profil 5", () => {
    const withP8 = { ...BCM7271_PROFILE, hdr: { ...BCM7271_PROFILE.hdr, dolbyVisionProfiles: [8] } };
    const withP5 = { ...BCM7271_PROFILE, hdr: { ...BCM7271_PROFILE.hdr, dolbyVisionProfiles: [5, 8] } };
    expect(deviceHdr(withP8).dolbyVision).toBe(false);
    expect(deviceHdr(withP5).dolbyVision).toBe(true);
  });

  it("un son se lit décodé par l'appareil OU reçu tel quel par la sortie", () => {
    const passOnly = { ...BCM7271_PROFILE, audio: { passthrough: ["dtshd" as const], decoded: ["aac"], maxPcmChannels: 2 } };
    expect(deviceReadsAudio(passOnly, "dts")).toBe(true);
    expect(deviceReadsAudio(passOnly, "truehd")).toBe(false);
    expect(deviceReadsAudio(BCM7271_PROFILE, "TrueHD")).toBe(true);
  });
});

describe("mpv d'après l'appareil — jamais le décodage logiciel", () => {
  it("BCM7271 : ses codecs matériels, et tout le HDR (libplacebo) sur un HEVC 10 bits", () => {
    const mpv = mpvEngineFor(BCM7271_PROFILE);
    expect(mpv.videoCodecs).toEqual(["hevc", "h264", "vp9"]);
    expect(mpv.hdr).toEqual(MPV_ENGINE.hdr);
    expect(mpv.audioCodecs).toEqual(MPV_ENGINE.audioCodecs);
  });

  it("sans HEVC 10 bits matériel, aucun HDR copié vers mpv", () => {
    expect(mpvEngineFor(HEVC_8BIT).hdr.hdr10).toBe(false);
    expect(mpvEngineFor(H264_ONLY).videoCodecs).toEqual(["h264"]);
  });
});

describe("Apple TV inchangée", () => {
  it("AVPlayer garde sa déclaration, mot pour mot", () => {
    expect(AVPLAYER_ENGINE).toEqual({
      engine: "avplayer",
      videoCodecs: ["hevc", "h264"],
      hdr: { hdr10: true, hdr10Plus: true, hlg: true, dolbyVision: false, dolbyVisionEnhancementLayer: false },
      audioCodecs: ["aac", "ac3", "eac3", "flac", "alac", "mp3"],
      maxAudioChannels: 6,
      segmentContainer: "mp4",
    });
  });

  it("le moteur de l'Apple TV 4K (Dolby Vision) donne la même URL qu'avant", () => {
    const engine = withHdr(AVPLAYER_ENGINE, { hdr10: true, hdr10Plus: true, hlg: true, dolbyVision: true });
    const plan = planStream({ engine, audio: { Codec: "eac3", BitRate: 640_000, Channels: 6 }, tier: { totalBitrate: 8_384_000, height: 1080 } });
    expect(plan.params).toEqual({
      VideoCodec: "hevc,h264", AudioCodec: "aac,flac,alac,mp3", AllowAudioStreamCopy: "true", SegmentContainer: "mp4",
      "hevc-rangetype": "SDR,HDR10,HDR10Plus,HLG,DOVI,DOVIWithSDR,DOVIWithHDR10,DOVIWithHDR10Plus,DOVIWithHLG",
      "h264-rangetype": "SDR",
      AllowVideoStreamCopy: "false", EnableAudioVbrEncoding: "true", VideoBitrate: "8000000", AudioBitrate: "384000",
      TranscodingMaxAudioChannels: "6", MaxWidth: "1920", MaxHeight: "1080",
    });
  });
});
