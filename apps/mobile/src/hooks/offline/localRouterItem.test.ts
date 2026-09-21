import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { localRouterItem } from "./localRouterItem";

const mkv: MediaItem = {
  Id: "i", Name: "Un titre", Type: "Movie",
  MediaSources: [{
    Id: "ms", Name: "ms", Container: "mkv", SupportsDirectPlay: true, SupportsDirectStream: true, SupportsTranscoding: true,
    MediaStreams: [
      { Type: "Video", Index: 0, Codec: "hevc", BitDepth: 10, VideoRangeType: "HDR10", IsDefault: true },
      { Type: "Audio", Index: 1, Codec: "dts", IsDefault: true },
      { Type: "Audio", Index: 2, Codec: "aac", IsDefault: false },
      { Type: "Subtitle", Index: 3, Codec: "subrip", IsDefault: false },
    ],
  }],
};
const streams = (item: MediaItem) => item.MediaSources?.[0]?.MediaStreams ?? [];

describe("localRouterItem", () => {
  it("un original est jugé tel quel", () => {
    expect(localRouterItem(mkv, { variant: "original", audioStreamIndex: null })).toBe(mkv);
  });

  it("une variante recompressée est un MP4 h264/aac, une piste audio, sous-titres en side-cars", () => {
    const item = localRouterItem(mkv, { variant: "light", audioStreamIndex: 2 });
    expect(item.MediaSources?.[0]?.Container).toBe("mp4");
    expect(streams(item).map((s) => `${s.Type}:${s.Codec}`)).toEqual(["Video:h264", "Audio:aac", "Subtitle:vtt"]);
    expect(streams(item).find((s) => s.Type === "Audio")?.Index).toBe(2);
    expect(streams(item).find((s) => s.Type === "Subtitle")?.IsExternal).toBe(true);
    expect(streams(item).find((s) => s.Type === "Video")?.BitDepth).toBe(8);
  });

  it("sans index audio choisi, la piste par défaut est celle gardée", () => {
    const item = localRouterItem(mkv, { variant: "light", audioStreamIndex: null });
    expect(streams(item).find((s) => s.Type === "Audio")).toMatchObject({ Index: 1, Codec: "aac" });
  });

  it("sans snapshot (item minimal), rien n'est inventé", () => {
    const minimal: MediaItem = { Id: "i", Name: "Un titre", Type: "Movie" };
    expect(localRouterItem(minimal, { variant: "light", audioStreamIndex: null })).toBe(minimal);
  });
});
