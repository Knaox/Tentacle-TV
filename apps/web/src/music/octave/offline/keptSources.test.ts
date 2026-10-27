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

import { SourceCache } from "@tentacle-tv/shared/octave";
import { externalTrack } from "@tentacle-tv/shared/octave/testing";
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

  it("un titre joué en flux PUIS gardé se lit depuis le disque, même avec sa source en flux en cache", async () => {
    const track = externalTrack("sillon", "ytm:t:x");
    const flux: PlaybackSource = { ...SERVER, trackKey: track.key, url: "/flux", origin: "plugin", expiresAt: 6 * 3_600_000 };
    const external = vi.fn(async () => flux);
    const cache = new SourceCache(withKeptSources({ library: async () => SERVER, external, now: () => 0 }));
    h.kept = null;
    expect((await cache.get(track))?.url).toBe("/flux");
    h.kept = { trackKey: track.key, itemId: "ext-1", origin: "external", expectedSize: 3, durationMs: 1000, sourcePath: "/api/plugins/sillon/music/offline/x" };
    expect(cache.peek(track.key)).toMatchObject({ kept: { userId: "compte" }, url: "/api/plugins/sillon/music/offline/x" });
    expect(external).toHaveBeenCalledTimes(1);
  });
});
