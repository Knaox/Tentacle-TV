import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/backendBase", () => ({ getBackendBase: () => "http://serveur:3001" }));

const { previewStreamOf } = await import("./previewStream");

const PREVIEW = {
  ytId: "", source: { kind: "dailymotion" as const, videoId: "x8abcde" }, path: "/api/trailers/hls/dm%3Ax8abcde/master.m3u8?t=x",
  mimeType: "application/vnd.apple.mpegurl" as const, expiresAt: Date.now() + 3_600_000, heights: [480, 720], qualities: [],
};

describe("aperçu › le flux d'une réponse", () => {
  it("une VOSTFR garde ses sous-titres incrustés : jamais rognée", () => {
    expect(previewStreamOf({ ...PREVIEW, version: "subtitled" })).toMatchObject({ burnedSubtitles: true, heights: [720, 480] });
    expect(previewStreamOf({ ...PREVIEW, version: "localized" }).burnedSubtitles).toBe(false);
    expect(previewStreamOf(PREVIEW)).toMatchObject({ src: "http://serveur:3001/api/trailers/hls/dm%3Ax8abcde/master.m3u8?t=x", burnedSubtitles: false });
  });
});
