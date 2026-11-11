/**
 * Le lecteur web d'un Chromium sans codecs propriétaires (le bureau CEF quand
 * mpv ne lit pas) : il déclare ce qu'il décode, et la règle en tire un flux
 * qu'il lit — AV1 + Opus en fMP4, jamais le H.264 + AAC d'un navigateur.
 */
import { describe, expect, it } from "vitest";
import { MPV_ENGINE, openWebEngine, readableRangeTypes, type WebDecodeProbe } from "./engineCapabilities";
import { engineTranscodingProfiles } from "./engineProfiles";
import { planStream } from "./streamPlan";

/** Ce que `MediaSource.isTypeSupported` répond dans CEF 156 (mesuré le 11/11/2026, macOS). */
const CEF: WebDecodeProbe = { h264: false, aac: false, av1: true, av1TenBit: true, opus: true, flac: true, mp3: true };
/** Chrome, Electron, Safari : tout ce qu'il faut au profil d'un navigateur. */
const CHROME: WebDecodeProbe = { ...CEF, h264: true, aac: true };

describe("openWebEngine", () => {
  it("un navigateur qui lit le H.264 et l'AAC ne déclare rien : son profil d'avant", () => {
    expect(openWebEngine(CHROME)).toBeNull();
  });

  it("le bureau CEF : AV1 seul (jamais le VP9 : Jellyfin le choisirait, et ne sert rien), Opus en sortie, fMP4, HDR sans Dolby Vision", () => {
    const engine = openWebEngine(CEF);
    expect(engine).toMatchObject({
      engine: "web-open", videoCodecs: ["av1"], audioCodecs: ["opus", "flac", "mp3"],
      audioOutput: "opus", segmentContainer: "mp4", maxAudioChannels: 6,
    });
    const ranges = readableRangeTypes(engine!.hdr);
    expect(ranges).toEqual(expect.arrayContaining(["SDR", "HDR10", "HLG", "DOVIWithHDR10"]));
    expect(ranges).not.toContain("DOVI");
  });

  it("sans décodeur 10 bits : le SDR seul", () => {
    const engine = openWebEngine({ ...CEF, av1TenBit: false });
    expect(readableRangeTypes(engine!.hdr)).toEqual(["SDR"]);
  });

  it("le son converti sort dans ce que le lecteur décode : Opus, sinon FLAC, sinon MP3", () => {
    expect(openWebEngine({ ...CEF, opus: false })?.audioOutput).toBe("flac");
    expect(openWebEngine({ ...CEF, opus: false, flac: false })?.audioOutput).toBe("mp3");
  });

  it("rien que Jellyfin sache produire (pas d'AV1, ou aucun son lisible) : rien à déclarer", () => {
    expect(openWebEngine({ ...CEF, av1: false })).toBeNull();
    expect(openWebEngine({ ...CEF, opus: false, flac: false, mp3: false })).toBeNull();
    // H.264 sans AAC (ou l'inverse) : pas un navigateur ordinaire, le moteur se déclare.
    expect(openWebEngine({ ...CEF, h264: true })?.engine).toBe("web-open");
  });
});

describe("le flux tiré du moteur web ouvert", () => {
  const engine = openWebEngine(CEF)!;

  it("planStream : AV1 en tête, Opus en sortie, jamais ni H.264 ni AAC", () => {
    const { params, copiesAudio } = planStream({ engine, audio: { Codec: "eac3", BitRate: 640_000, Channels: 6 }, tier: { totalBitrate: 8_000_000, height: 1080 } });
    expect(params.VideoCodec).toBe("av1");
    expect(params.AudioCodec).toBe("opus,flac,mp3");
    expect(params.SegmentContainer).toBe("mp4");
    expect(params["av1-rangetype"]).toContain("HDR10");
    expect(copiesAudio).toBe(false);
    expect(`${params.VideoCodec},${params.AudioCodec}`).not.toMatch(/h264|aac|hevc|vp9/);
  });

  it("une piste Opus se copie, sans palier l'image aussi", () => {
    const plan = planStream({ engine, audio: { Codec: "opus", BitRate: 192_000, Channels: 6 }, tier: null });
    expect(plan.copiesAudio).toBe(true);
    expect(plan.params.AllowVideoStreamCopy).toBe("true");
  });

  it("le profil d'appareil : un seul profil vidéo (fMP4 AV1 + Opus), un profil audio en Opus", () => {
    const profiles = engineTranscodingProfiles(engine, { minSegments: 1, breakOnNonKeyFrames: false, universalFallback: false });
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toMatchObject({ Type: "Video", Container: "mp4", Protocol: "hls", VideoCodec: "av1", AudioCodec: "opus,flac,mp3", MinSegments: 1, BreakOnNonKeyFrames: false });
    expect(profiles[1]).toMatchObject({ Type: "Audio", AudioCodec: "opus" });
    expect(JSON.stringify(profiles)).not.toMatch(/h264|aac/);
  });

  it("les autres moteurs gardent leur repli universel et leur profil audio AAC", () => {
    const profiles = engineTranscodingProfiles(MPV_ENGINE);
    expect(profiles.some((p) => p.Type === "Video" && p.Container === "ts" && p.VideoCodec === "h264" && p.AudioCodec === "aac")).toBe(true);
    expect(profiles.at(-1)).toMatchObject({ Type: "Audio", AudioCodec: "aac" });
  });
});
