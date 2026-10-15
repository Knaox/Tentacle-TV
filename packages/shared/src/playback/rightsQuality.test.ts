import { describe, expect, it } from "vitest";
import type { MediaSource } from "../types/media";
import { FULL_PLAYBACK_RIGHTS, type PlaybackRights } from "./playbackRights";
import { exceedsBitrateCap, lighterPreset, offeredQualityPresets, rightsCapTier } from "./rightsQuality";
import { buildQualityLadder } from "../utils/qualityLadder";

/** La source du banc « Debit (2024) » : 720p H.264 à ~8 Mb/s. */
const source = {
  Bitrate: 8_200_000,
  MediaStreams: [{ Type: "Video", Codec: "h264", Height: 720, Width: 1280, BitRate: 8_000_000 }],
} as unknown as MediaSource;
const rights = (patch: Partial<PlaybackRights>): PlaybackRights => ({ ...FULL_PLAYBACK_RIGHTS, ...patch });

describe("rightsQuality — l'échelle face aux droits", () => {
  it("sans droit de réencoder : « Originale » seule", () => {
    const offered = offeredQualityPresets(buildQualityLadder(source), rights({ videoTranscoding: false }));
    expect(offered.map((preset) => preset.key)).toEqual(["original"]);
  });

  it("un plafond retire les paliers trop lourds", () => {
    const offered = offeredQualityPresets(buildQualityLadder(source), rights({ maxBitrate: 2_000_000 }));
    expect(offered.every((preset) => preset.bitrate == null || preset.bitrate <= 2_000_000)).toBe(true);
    expect(offered[0].key).toBe("original");
  });

  it("le plafond impose un palier dès que la source le dépasse", () => {
    const tier = rightsCapTier(source, rights({ maxBitrate: 2_000_000 }));
    expect(tier?.bitrate).toBeLessThanOrEqual(2_000_000);
    expect(rightsCapTier(source, rights({ maxBitrate: 20_000_000 }))).toBeNull();
    expect(rightsCapTier(source, FULL_PLAYBACK_RIGHTS)).toBeNull();
    // Sans droit de réencoder, aucun palier : la lecture se juge à part.
    expect(rightsCapTier(source, rights({ maxBitrate: 2_000_000, videoTranscoding: false }))).toBeNull();
    expect(exceedsBitrateCap(source, rights({ maxBitrate: 2_000_000 }))).toBe(true);
    expect(exceedsBitrateCap(source, rights({ maxBitrate: 20_000_000 }))).toBe(false);
  });

  it("le plus léger de deux paliers", () => {
    const a = { key: "p720", bitrate: 4_000_000 } as never;
    const b = { key: "p480", bitrate: 2_000_000 } as never;
    expect(lighterPreset(a, b)).toBe(b);
    expect(lighterPreset(null, a)).toBe(a);
  });
});
