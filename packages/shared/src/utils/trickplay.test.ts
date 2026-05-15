import { describe, expect, it } from "vitest";
import {
  getTrickplayTile,
  getTrickplayTileCount,
  pickBestTrickplayWidth,
} from "./trickplay";
import type { TrickplayInfo, TrickplayManifest } from "../types/media";

const INFO: TrickplayInfo = {
  Width: 320,
  Height: 180,
  TileWidth: 10,
  TileHeight: 10,
  ThumbnailCount: 720,
  Interval: 10_000,
  Bandwidth: 500_000,
};

describe("getTrickplayTile", () => {
  it("returns tile 0 / (0,0) at position 0", () => {
    expect(getTrickplayTile(0, INFO)).toEqual({
      tileIndex: 0,
      xInTile: 0,
      yInTile: 0,
    });
  });

  it("computes mid-tile coordinates", () => {
    // frameIndex = floor(35000 / 10000) = 3 → col 3, row 0 inside tile 0
    expect(getTrickplayTile(35_000, INFO)).toEqual({
      tileIndex: 0,
      xInTile: 3 * 320,
      yInTile: 0,
    });
  });

  it("rolls over to the next tile exactly at the boundary", () => {
    // 100 frames per tile @ 10s each → frame 100 = first of tile 1 (top-left)
    expect(getTrickplayTile(1_000_000, INFO)).toEqual({
      tileIndex: 1,
      xInTile: 0,
      yInTile: 0,
    });
  });

  it("computes y offset on a later row inside the tile", () => {
    // frameIndex = 12 → col 2, row 1 inside tile 0
    expect(getTrickplayTile(125_000, INFO)).toEqual({
      tileIndex: 0,
      xInTile: 2 * 320,
      yInTile: 1 * 180,
    });
  });

  it("clamps negative positions to 0", () => {
    expect(getTrickplayTile(-500, INFO)).toEqual({
      tileIndex: 0,
      xInTile: 0,
      yInTile: 0,
    });
  });
});

describe("getTrickplayTileCount", () => {
  it("rounds up to the nearest tile mosaic", () => {
    expect(getTrickplayTileCount(INFO)).toBe(8); // ceil(720 / 100) = 8
    expect(getTrickplayTileCount({ ...INFO, ThumbnailCount: 100 })).toBe(1);
    expect(getTrickplayTileCount({ ...INFO, ThumbnailCount: 101 })).toBe(2);
  });
});

describe("pickBestTrickplayWidth", () => {
  const manifest: TrickplayManifest = {
    "msrc-A": {
      "160": { ...INFO, Width: 160, Height: 90 },
      "320": { ...INFO, Width: 320, Height: 180 },
      "480": { ...INFO, Width: 480, Height: 270 },
    },
  };

  it("prefers 320 when available", () => {
    const sel = pickBestTrickplayWidth(manifest);
    expect(sel?.width).toBe(320);
    expect(sel?.mediaSourceId).toBe("msrc-A");
  });

  it("falls back to the closest width when 320 is missing", () => {
    const m: TrickplayManifest = {
      "msrc-A": { "240": { ...INFO, Width: 240 }, "480": { ...INFO, Width: 480 } },
    };
    expect(pickBestTrickplayWidth(m)?.width).toBe(240);
  });

  it("returns null for an empty manifest", () => {
    expect(pickBestTrickplayWidth({})).toBeNull();
    expect(pickBestTrickplayWidth(undefined)).toBeNull();
    expect(pickBestTrickplayWidth(null)).toBeNull();
  });

  it("uses the requested mediaSourceId when present", () => {
    const m: TrickplayManifest = {
      "msrc-A": { "320": INFO },
      "msrc-B": { "480": { ...INFO, Width: 480 } },
    };
    expect(pickBestTrickplayWidth(m, "msrc-B")?.width).toBe(480);
  });

  it("falls back to the first mediaSourceId when the requested one is absent", () => {
    const m: TrickplayManifest = { "msrc-A": { "320": INFO } };
    expect(pickBestTrickplayWidth(m, "msrc-X")?.mediaSourceId).toBe("msrc-A");
  });
});
