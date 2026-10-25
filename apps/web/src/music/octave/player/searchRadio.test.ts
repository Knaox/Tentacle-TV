import { describe, expect, it, vi } from "vitest";
import type { MusicProvider } from "@tentacle-tv/api-client";
import type { MusicTrack, PlaybackSource } from "@tentacle-tv/shared/music";
import { OctavePlayer, PlaybackReporter, SourceCache, upcoming } from "@tentacle-tv/shared/octave";
import { createFakeEngine, externalTrack } from "@tentacle-tv/shared/octave/testing";
import { followSearchWithRadio } from "./searchRadio";

/**
 * S3 du plan de R8 : la suite d'un clic de RECHERCHE est la radio du titre touché, demandée après son premier son ;
 * un album garde sa liste ; sans radio, la file d'avant.
 */
const sourceOf = (key: string): PlaybackSource => ({ trackKey: key, url: `/s/${key}`, origin: "plugin", complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null });
const provider = (radio: string | undefined) => ({ pluginId: "sillon", name: "Sillon", configEnabled: true, music: { search: "/music/search", resolve: "/music/resolve", ...(radio ? { radio } : {}) } }) as unknown as MusicProvider;
const results = ["r1", "r2", "r3"].map((id) => externalTrack("sillon", `ytm:t:${id}`));
const radio = ["x1", "x2"].map((id) => externalTrack("sillon", `ytm:t:${id}`));
const flush = () => new Promise((r) => setTimeout(r, 0));

function rig(p: MusicProvider | null, answer: readonly MusicTrack[] | null = radio) {
  const engine = createFakeEngine();
  const sources = new SourceCache({ library: async (id) => sourceOf(`jf:${id}`), external: async (t) => sourceOf(t.key), now: () => 0 });
  const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
  const player = new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {} });
  const fetchRadio = vi.fn(async (_provider: MusicProvider, _externalId: string) => answer);
  const off = followSearchWithRadio(player, () => p, fetchRadio);
  return { engine, player, fetchRadio, off };
}

describe("la suite d'un clic de recherche : la radio, après le premier son", () => {
  it("rien avant le son ; au premier son, la radio du titre touché devient la suite (une seule demande)", async () => {
    const { engine, player, fetchRadio, off } = rig(provider("/music/radio"));
    player.playList(results, 1, "search:iris out");
    await flush();
    expect(fetchRadio).not.toHaveBeenCalled();
    engine.sound(0);
    engine.sound(500);
    await flush();
    expect(fetchRadio).toHaveBeenCalledTimes(1);
    expect(fetchRadio.mock.calls[0]?.[1]).toBe("ytm:t:r2");
    expect(upcoming(player.snapshot.get().queue).map((i) => i.track.key)).toEqual(radio.map((t) => t.key));
    expect(player.snapshot.get().queue.contextId).toBe(`radio:${results[1]!.key}`);
    off();
  });

  it("un album garde sa liste ; une extension sans radio, ou une radio vide : la file d'avant", async () => {
    for (const [p, context, answer] of [[provider("/music/radio"), "album:1", radio], [provider(undefined), "search:x", radio], [provider("/music/radio"), "search:x", []]] as const) {
      const { engine, player, off } = rig(p, answer);
      player.playList(results, 0, context);
      await flush();
      engine.sound(0);
      await flush();
      expect(upcoming(player.snapshot.get().queue).map((i) => i.track.key)).toEqual(results.slice(1).map((t) => t.key));
      off();
    }
  });

  it("l'utilisateur a changé de titre avant la réponse : la radio de l'ancien ne touche pas la nouvelle file", async () => {
    let answer: (tracks: readonly MusicTrack[]) => void = () => undefined;
    const engine = createFakeEngine();
    const sources = new SourceCache({ library: async (id) => sourceOf(`jf:${id}`), external: async (t) => sourceOf(t.key), now: () => 0 });
    const player = new OctavePlayer({ engine, sources, reporter: new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 }), prefetchExternal: () => {} });
    const off = followSearchWithRadio(player, () => provider("/music/radio"), () => new Promise((r) => (answer = r)));
    player.playList(results, 0, "search:x");
    await flush();
    engine.sound(0);
    player.playList(results, 2, "album:2");
    answer(radio);
    await flush();
    expect(upcoming(player.snapshot.get().queue)).toEqual([]);
    expect(player.snapshot.get().queue.contextId).toBe("album:2");
    off();
  });
});
