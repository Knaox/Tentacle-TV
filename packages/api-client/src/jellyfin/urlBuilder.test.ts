import { describe, expect, it } from "vitest";
import { transcodeTarget } from "@tentacle-tv/shared";
import { applyTranscodeTarget, buildStreamUrl, type StreamUrlContext } from "./urlBuilder";

const ctx: StreamUrlContext = {
  baseUrl: "http://jf.test",
  deviceId: "dev",
  accessToken: "tok",
  useCredentials: false,
  resolveMediaUrl: (u) => u,
};

const params = (url: string) => new URLSearchParams(url.slice(url.indexOf("?") + 1));

describe("buildStreamUrl — transcodage de qualité", () => {
  it("un palier 540p impose sa largeur (960), son débit vidéo et l'audio stéréo", () => {
    const q = params(buildStreamUrl(ctx, "item", { directPlay: false, maxBitrate: 2_528_000, maxHeight: 540 }));
    expect(q.get("MaxWidth")).toBe("960");
    expect(q.get("MaxHeight")).toBe("540");
    expect(q.get("VideoBitrate")).toBe("2400000");
    expect(q.get("AudioBitrate")).toBe("128000");
    expect(q.get("TranscodingMaxAudioChannels")).toBe("2");
    expect(q.get("VideoCodec")).toBe("h264");
  });

  it("un palier 1080p garde le 5.1 et réserve 384 kb/s à l'audio", () => {
    const q = params(buildStreamUrl(ctx, "item", { directPlay: false, maxBitrate: 8_384_000, maxHeight: 1080 }));
    expect(q.get("MaxWidth")).toBe("1920");
    expect(q.get("VideoBitrate")).toBe("8000000");
    expect(q.get("TranscodingMaxAudioChannels")).toBe("6");
  });

  it("le repli codec (débit sans hauteur) laisse la définition de la source", () => {
    const q = params(buildStreamUrl(ctx, "item", { directPlay: false, maxBitrate: 8_000_000 }));
    expect(q.get("MaxWidth")).toBe("1920");
    expect(q.has("MaxHeight")).toBe(false);
    expect(q.get("VideoBitrate")).toBe(String(8_000_000 - 384_000));
  });

  it("la lecture directe reste un fichier statique, sans plafond", () => {
    const url = buildStreamUrl(ctx, "item", { directPlay: true, mediaSourceId: "ms" });
    expect(url).toContain("/Videos/item/stream?");
    expect(params(url).get("Static")).toBe("true");
  });
});

describe("applyTranscodeTarget", () => {
  // La forme exacte que Jellyfin 10.11 rend en PlaybackInfo (relevée au banc).
  const JELLYFIN =
    "/videos/abc/master.m3u8?&DeviceId=d&MediaSourceId=abc&VideoCodec=h264&AudioCodec=aac&AudioStreamIndex=1" +
    "&VideoBitrate=1308000&AudioBitrate=640000&MaxFramerate=23.976025&SegmentContainer=ts&PlaySessionId=ps" +
    "&TranscodingMaxAudioChannels=6&hevc-level=120&h264-level=51&TranscodeReasons=VideoCodecNotSupported";

  it("pose débit, définition et audio du palier", () => {
    const q = params(applyTranscodeTarget(JELLYFIN, transcodeTarget(2_528_000, 540)));
    expect(q.get("VideoBitrate")).toBe("2400000");
    expect(q.get("AudioBitrate")).toBe("128000");
    expect(q.get("TranscodingMaxAudioChannels")).toBe("2");
    expect(q.get("MaxWidth")).toBe("960");
    expect(q.get("MaxHeight")).toBe("540");
  });

  it("garde tout le reste à l'octet près, et chaque paramètre une seule fois", () => {
    const out = applyTranscodeTarget(JELLYFIN, transcodeTarget(4_384_000, 720));
    for (const kept of ["DeviceId=d", "PlaySessionId=ps", "hevc-level=120", "MaxFramerate=23.976025", "TranscodeReasons=VideoCodecNotSupported"]) {
      expect(out).toContain(kept);
    }
    expect(out.match(/VideoBitrate=/gi)).toHaveLength(1);
    expect(out.startsWith("/videos/abc/master.m3u8?")).toBe(true);
  });

  it("remplace un paramètre quelle que soit sa casse", () => {
    const out = applyTranscodeTarget("/v/master.m3u8?videobitrate=1&maxwidth=2", transcodeTarget(4_384_000, 720));
    expect(out.match(/videobitrate=/gi)).toHaveLength(1);
    expect(params(out).get("MaxWidth")).toBe("1280");
  });

  it("une URL sans paramètres reste telle quelle", () => {
    expect(applyTranscodeTarget("/videos/abc/stream", transcodeTarget(1_000_000, 360))).toBe("/videos/abc/stream");
  });
});
