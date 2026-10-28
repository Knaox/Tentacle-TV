/** La copie gardée d'abord ; sur le mobile, elle désigne son fichier (`kept.localUri`). */

import { describe, expect, it, vi } from "vitest";
import type { PlaybackSource } from "@tentacle-tv/shared/music";
import { keptSource, withKeptSources } from "./keptSources";
import { keptTrack } from "./testing/fixtures";

const SERVER: PlaybackSource = { trackKey: "jf:a", url: "/api/music/stream/a", origin: "library", complete: true, sizeBytes: null, durationMs: null, format: null, replayGain: null, expiresAt: null };

describe("keptSources", () => {
  it("le fichier de l'appareil quand on le connaît, le serveur en repli", () => {
    const source = keptSource(keptTrack("jf:a", { itemId: "a" }), "compte", "file:///musique/a.flac");
    expect(source.kept).toEqual({ userId: "compte", localUri: "file:///musique/a.flac" });
    expect(source.url).toBe("/api/music/stream/a");
    expect(keptSource(keptTrack("ext:s:x", { sourcePath: "/api/plugins/s/music/offline/x" }), "compte").kept).toEqual({ userId: "compte" });
  });

  it("gardé : la copie ; sinon le résolveur d'avant", async () => {
    const library = vi.fn(async () => SERVER);
    let kept: PlaybackSource | null = keptSource(keptTrack("jf:a", { itemId: "a" }), "compte");
    const sources = withKeptSources({ library, external: async () => null, now: () => 0 }, () => kept);
    expect((await sources.library("a")).kept).toEqual({ userId: "compte" });
    expect(library).not.toHaveBeenCalled();
    kept = null;
    expect(await sources.library("a")).toBe(SERVER);
  });
});
