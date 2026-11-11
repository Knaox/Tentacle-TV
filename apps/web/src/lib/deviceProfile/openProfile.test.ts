/**
 * Le profil du lecteur web d'un Chromium sans codecs propriétaires (bureau
 * CEF) : rien qu'il ne décode — ni H.264, ni AAC, ni TS.
 */
import { describe, expect, it } from "vitest";
import { openWebEngine } from "@tentacle-tv/shared";
import { openWebProfiles } from "./openProfile";

const engine = openWebEngine({ h264: false, aac: false, av1: true, av1TenBit: true, opus: true, flac: true, mp3: true })!;

describe("openWebProfiles", () => {
  it("un seul profil vidéo : HLS en fMP4, AV1, Opus — les drapeaux des profils du web", () => {
    const { transcoding } = openWebProfiles(engine);
    const video = transcoding.filter((p) => p.Type === "Video");
    expect(video).toEqual([expect.objectContaining({
      Container: "mp4", Protocol: "hls", VideoCodec: "av1", AudioCodec: "opus,flac,mp3",
      MinSegments: 1, BreakOnNonKeyFrames: false, CopyTimestamps: true, MaxAudioChannels: "6",
    })]);
    expect(transcoding.find((p) => p.Type === "Audio")).toMatchObject({ AudioCodec: "opus" });
  });

  it("jamais ce que ce lecteur ne décode", () => {
    expect(JSON.stringify(openWebProfiles(engine))).not.toMatch(/h264|hevc|vp9|aac|ac3|"ts"/);
  });

  it("l'AV1 garde sa copie en HDR10 et en Dolby Vision à base lisible, pas en Dolby Vision seul", () => {
    const av1 = openWebProfiles(engine).codecs.find((c) => c.Codec === "av1");
    const ranges = av1?.Conditions.find((c) => c.Property === "VideoRangeType")?.Value.split("|") ?? [];
    expect(ranges).toEqual(expect.arrayContaining(["Unknown", "SDR", "HDR10", "HLG", "DOVIWithHDR10"]));
    expect(ranges).not.toContain("DOVI");
  });
});
