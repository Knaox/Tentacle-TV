/**
 * La copie gardée d'abord ; un titre retiré de l'appareil (une playlist tenue à
 * jour l'a perdu) se lit ensuite EN LIGNE, par le résolveur d'avant.
 */

import { describe, expect, it, vi } from "vitest";
import type { PlaybackSource } from "@tentacle-tv/shared/music";

const h = vi.hoisted(() => ({ kept: null as unknown }));
vi.mock("./keptMusicStore", () => ({
  keptMusicState: () => ({ userId: "compte" }),
  completeKeptTrack: () => h.kept,
}));

import { withKeptSources } from "./keptSources";

const SERVER: PlaybackSource = { trackKey: "jf:a", url: "/api/music/stream/a", origin: "library", complete: true, sizeBytes: null, durationMs: null, format: null, replayGain: null, expiresAt: null };

describe("withKeptSources", () => {
  it("gardé : la copie de l'appareil ; retiré : le serveur, comme avant", async () => {
    const library = vi.fn(async () => SERVER);
    const sources = withKeptSources({ library, external: async () => null, now: () => 0 });
    h.kept = { trackKey: "jf:a", itemId: "a", origin: "library", expectedSize: 3, durationMs: 1000, sourcePath: null };
    expect((await sources.library("a")).kept).toEqual({ userId: "compte" });
    expect(library).not.toHaveBeenCalled();
    h.kept = null;
    expect(await sources.library("a")).toBe(SERVER);
    expect(library).toHaveBeenCalledWith("a");
  });
});
