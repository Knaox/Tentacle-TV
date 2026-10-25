import { describe, expect, it, vi } from "vitest";
import type { MusicTrack, PlaybackSource } from "../music";
import { createFakeEngine } from "./fakeEngine";
import { externalTrack } from "./fixtures";
import { OctavePlayer } from "./octavePlayer";
import { PlaybackReporter } from "./playbackReports";
import { SourceCache, type SourceIntent } from "./sourceCache";

const sourceOf = (key: string): PlaybackSource => ({ trackKey: key, url: `/src/${key}`, origin: "plugin", complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const a = externalTrack("sillon", "a");
const b = externalTrack("sillon", "b");

describe("le préchargement du suivant se dit à l'extension (contrat `intent`)", () => {
  it("le lecteur précharge le suivant de sa file en `next`, le titre joué en geste", async () => {
    const asked: [string, SourceIntent][] = [];
    const sources = new SourceCache({ library: async (id) => sourceOf(`jf:${id}`), external: async (track: MusicTrack, intent) => (asked.push([track.key, intent]), sourceOf(track.key)), now: () => 0 });
    const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
    const player = new OctavePlayer({ engine: createFakeEngine(), sources, reporter, prefetchExternal: () => {}, skipDelayMs: 0 });
    player.playList([a, b], 0);
    await wait(20);
    player.scheduleNext();
    await wait(20);
    expect(asked).toContainEqual([a.key, "play"]);
    expect(asked).toContainEqual([b.key, "next"]);
  });

  it("un clic sur un titre qu'on préchargeait encore le redemande COMME UN GESTE (l'extension promeut la résolution)", async () => {
    const asked: SourceIntent[] = [];
    let release: (s: PlaybackSource) => void = () => undefined;
    const external = vi.fn((_t: MusicTrack, intent: SourceIntent) => (asked.push(intent), intent === "next" ? new Promise<PlaybackSource>((r) => (release = r)) : Promise.resolve(sourceOf(b.key))));
    const sources = new SourceCache({ library: async (id) => sourceOf(`jf:${id}`), external, now: () => 0 });
    const preload = sources.get(b, "next");
    const click = sources.get(b, "play");
    expect(await click).toMatchObject({ trackKey: b.key });
    expect(asked).toEqual(["next", "play"]);
    // Un second préchargement (ou un second clic) rejoint la demande en vol : rien ne repart.
    void sources.get(b, "next");
    release(sourceOf(b.key));
    await preload;
    expect(external).toHaveBeenCalledTimes(2);
  });
});
