import { describe, expect, it } from "vitest";
import { exoPlayerEngineFor } from "./deviceEngines";
import { planStream } from "./streamPlan";
import { BCM7271_PROFILE } from "./simulatedDeviceProfiles";
import {
  liteConvertedAudioEngine,
  exoBufferPolicy, LITE_DIRECT_PLAY_MAX_BITRATE, LITE_EXO_BUFFER, litePlaybackPolicy, mpvOptionOverrides, NORMAL_EXO_BUFFER,
} from "./litePlayback";

describe("exoBufferPolicy", () => {
  it("mode normal : rien à poser, le natif garde le tampon d'avant", () => {
    expect(exoBufferPolicy("normal")).toBeNull();
    // Le miroir des valeurs natives d'avant (ExoPlayerFactory.createLoadControl).
    expect(NORMAL_EXO_BUFFER).toEqual({
      minBufferMs: 50_000, maxBufferMs: 300_000, bufferForPlaybackMs: 2_500, bufferForPlaybackAfterRebufferMs: 5_000, targetBufferBytes: null,
    });
  });

  it("Lite : 48 Mio au plus, 15 à 30 s, démarrage et reprise inchangés", () => {
    const lite = exoBufferPolicy("lite");
    expect(lite).toBe(LITE_EXO_BUFFER);
    expect(lite?.targetBufferBytes).toBe(48 * 1024 * 1024);
    expect(lite?.bufferForPlaybackMs).toBe(NORMAL_EXO_BUFFER.bufferForPlaybackMs);
    expect(lite?.bufferForPlaybackAfterRebufferMs).toBe(NORMAL_EXO_BUFFER.bufferForPlaybackAfterRebufferMs);
  });

  it("Lite : les contraintes de DefaultLoadControl tiennent (sinon il lève à la construction)", () => {
    const p = LITE_EXO_BUFFER;
    expect(p.bufferForPlaybackMs).toBeLessThanOrEqual(p.minBufferMs);
    expect(p.bufferForPlaybackAfterRebufferMs).toBeLessThanOrEqual(p.minBufferMs);
    expect(p.minBufferMs).toBeLessThanOrEqual(p.maxBufferMs);
  });

  it("Lite : au plafond de débit, le tampon tient encore ~8 s", () => {
    const seconds = (LITE_EXO_BUFFER.targetBufferBytes! * 8) / LITE_DIRECT_PLAY_MAX_BITRATE;
    expect(seconds).toBeGreaterThan(7.5);
    expect(seconds).toBeLessThan(LITE_EXO_BUFFER.maxBufferMs / 1000);
  });
});

describe("litePlaybackPolicy", () => {
  it("mode normal : aucune politique", () => {
    expect(litePlaybackPolicy("normal")).toBeNull();
  });

  it("Lite : le plafond de lecture directe et le budget du son", () => {
    expect(litePlaybackPolicy("lite")).toEqual({ directPlayMaxBitrate: 50_000_000, audioDecodeBudget: 100 });
  });
});

describe("mpvOptionOverrides", () => {
  it("mode normal : aucune option ne change", () => {
    expect(mpvOptionOverrides("normal")).toEqual([]);
  });

  it("Lite : décodage matériel seul dans la liste, tampons réduits", () => {
    const options = new Map(mpvOptionOverrides("lite"));
    expect(options.get("hwdec")).toBe("mediacodec,mediacodec-copy");
    expect(options.get("demuxer-max-bytes")).toBe(String(32 * 1024 * 1024));
    expect(options.get("demuxer-max-back-bytes")).toBe(String(8 * 1024 * 1024));
  });
});

describe("liteConvertedAudioEngine", () => {
  const engine = exoPlayerEngineFor(BCM7271_PROFILE);

  it("la box (passthrough AC3 / E-AC3) : le TrueHD converti part en E-AC3, décodé par le téléviseur", () => {
    const lite = liteConvertedAudioEngine(engine, BCM7271_PROFILE.audio.passthrough);
    expect(lite).toEqual({ ...engine, audioOutput: "eac3" });
    const plan = planStream({ engine: lite, audio: { Codec: "truehd", Channels: 8 }, tier: null, outputMaxHeight: null });
    expect(plan.params.AudioCodec?.split(",")[0]).toBe("eac3");
    expect(plan.params.AllowVideoStreamCopy).toBe("true");
  });

  it("sans sortie qui reçoive l'AC3 ou l'E-AC3 : la liste d'avant", () => {
    expect(liteConvertedAudioEngine(engine, [])).toBe(engine);
    expect(liteConvertedAudioEngine(engine, ["dts"])).toBe(engine);
  });

  it("l'AC3 seul en passthrough : l'AC3 en tête", () => {
    expect(liteConvertedAudioEngine(engine, ["ac3"]).audioOutput).toBe("ac3");
  });
});

describe("audioOutput — sans lui, les URL d'avant", () => {
  it("un moteur sans `audioOutput` garde l'AAC en tête (tous les clients)", () => {
    const engine = exoPlayerEngineFor(BCM7271_PROFILE);
    const plan = planStream({ engine, audio: { Codec: "truehd", Channels: 8 }, tier: null, outputMaxHeight: null });
    expect(plan.params.AudioCodec?.split(",")[0]).toBe("aac");
  });

  it("avec `audioOutput` et une piste copiable, la piste suit la sortie", () => {
    const engine = { ...exoPlayerEngineFor(BCM7271_PROFILE), audioOutput: "eac3" };
    const plan = planStream({ engine, audio: { Codec: "ac3", Channels: 6 }, tier: null, outputMaxHeight: null });
    expect(plan.params.AudioCodec?.split(",").slice(0, 2)).toEqual(["eac3", "ac3"]);
  });
});
