import { describe, expect, it } from "vitest";
import { EXOPLAYER_ENGINE, MPV_ENGINE } from "./engineCapabilities";
import { BCM7271_SIMULATED, engineOnDevice, simulatedDecoderProfile, videoLimitOf } from "./deviceDecoderProfile";

describe("profil simulé BCM7271", () => {
  it("décode H.264, HEVC et VP9 en matériel, jamais l'AV1", () => {
    expect(BCM7271_SIMULATED.video.map((limit) => limit.codec).sort()).toEqual(["h264", "hevc", "vp9"]);
    expect(videoLimitOf(BCM7271_SIMULATED, "av1")).toBeNull();
  });

  it("garde le 10 bits au HEVC et au VP9, pas au H.264", () => {
    expect(videoLimitOf(BCM7271_SIMULATED, "hevc")?.maxBitDepth).toBe(10);
    expect(videoLimitOf(BCM7271_SIMULATED, "vp9")?.maxBitDepth).toBe(10);
    expect(videoLimitOf(BCM7271_SIMULATED, "h264")?.maxBitDepth).toBe(8);
  });

  it("se retrouve par l'identifiant de la propriété, quelle que soit la casse", () => {
    expect(simulatedDecoderProfile("BCM7271 ")).toBe(BCM7271_SIMULATED);
    expect(simulatedDecoderProfile("")).toBeNull();
    expect(simulatedDecoderProfile(null)).toBeNull();
    expect(simulatedDecoderProfile("inconnu")).toBeNull();
  });
});

describe("engineOnDevice", () => {
  it("retire de mpv l'AV1 que la puce ne décode pas, sans changer son ordre", () => {
    const engine = engineOnDevice(MPV_ENGINE, BCM7271_SIMULATED);
    expect(engine.videoCodecs).toEqual(["hevc", "h264", "vp9"]);
    expect(engine.engine).toBe("mpv@bcm7271");
    expect(engine.segmentContainer).toBe(MPV_ENGINE.segmentContainer);
  });

  it("ne garde que les plages HDR que la puce ET le moteur affichent", () => {
    const engine = engineOnDevice(MPV_ENGINE, BCM7271_SIMULATED);
    expect(engine.hdr).toEqual({ hdr10: true, hdr10Plus: false, hlg: true, dolbyVision: false, dolbyVisionEnhancementLayer: false });
  });

  it("ne garde que le son décodé ou envoyé en direct, et le moins de canaux", () => {
    const mpv = engineOnDevice(MPV_ENGINE, BCM7271_SIMULATED);
    expect(mpv.audioCodecs).not.toContain("truehd");
    expect(mpv.audioCodecs).not.toContain("dts");
    expect(mpv.audioCodecs).toContain("eac3");
    expect(mpv.maxAudioChannels).toBe(6);
    const exo = engineOnDevice(EXOPLAYER_ENGINE, BCM7271_SIMULATED);
    expect(exo.videoCodecs).toEqual(["hevc", "h264"]);
    expect(exo.audioCodecs).toEqual(["aac", "ac3", "eac3", "mp3", "opus", "flac"]);
  });
});
