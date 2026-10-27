/**
 * D'où lit le lecteur (Damien, 28/10 : « il m'affiche qu'il lit le titre en Opus… ») : l'instantané dit si la
 * source en cours est la copie GARDÉE sur cet appareil (`fromDevice`), au départ, à l'enchaînement sans blanc,
 * quand la copie disparaît, et plus rien à l'arrêt.
 */

import { describe, expect, it } from "vitest";
import type { PlaybackSource } from "../music";
import { createFakeEngine } from "./fakeEngine";
import { libraryTrack } from "./fixtures";
import { OctavePlayer } from "./octavePlayer";
import { PlaybackReporter } from "./playbackReports";
import { SourceCache } from "./sourceCache";

const stream = (key: string): PlaybackSource => ({
  trackKey: key, url: `/stream/${key}`, origin: "library", complete: true, sizeBytes: null, durationMs: 200_000,
  format: null, replayGain: null, expiresAt: null,
});
const disk = (key: string): PlaybackSource => ({ ...stream(key), url: `/offline/${key}`, kept: { userId: "compte" } });

function setup(keptKeys: string[]) {
  const keptCopies = new Map(keptKeys.map((key) => [key, disk(key)]));
  const engine = createFakeEngine();
  const sources = new SourceCache({ library: async (id) => stream(`jf:${id}`), external: async () => null, now: () => 0, kept: (key) => keptCopies.get(key) ?? null });
  const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
  const player = new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {}, skipDelayMs: 0 });
  return { engine, player, keptCopies };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const tracks = ["a", "b", "c"].map((id) => libraryTrack(id));

describe("le lecteur dit d'où il lit", () => {
  it("un titre gardé : « sur cet appareil » dès le clic ; un titre en flux : rien", async () => {
    const { player } = setup(["jf:a"]);
    player.playList(tracks, 0);
    expect(player.snapshot.get().fromDevice).toBe(true);
    player.playList(tracks, 1);
    expect(player.snapshot.get().fromDevice).toBe(false);
    await flush();
    expect(player.snapshot.get().fromDevice).toBe(false);
  });

  it("l'enchaînement sans blanc prend la source du SUIVANT, dans les deux sens", async () => {
    const { player, engine } = setup(["jf:b"]);
    player.playList(tracks, 0);
    await flush();
    engine.sound(0);
    await flush();
    engine.emit({ type: "advanced", fromKey: "jf:a", toKey: "jf:b" });
    expect(player.snapshot.get()).toMatchObject({ fromDevice: true });
    expect(player.snapshot.get().current?.key).toBe("jf:b");
    await flush();
    engine.emit({ type: "advanced", fromKey: "jf:b", toKey: "jf:c" });
    expect(player.snapshot.get()).toMatchObject({ fromDevice: false });
  });

  it("la copie effacée en cours de route : le moteur redemande, le serveur reprend, la mention part", async () => {
    const { player, engine, keptCopies } = setup(["jf:a"]);
    player.playList(tracks, 0);
    expect(player.snapshot.get().fromDevice).toBe(true);
    keptCopies.clear();
    engine.emit({ type: "needSource", trackKey: "jf:a" });
    await flush();
    expect(engine.calls.at(-1)).toMatchObject({ method: "swapSource", url: "/stream/jf:a" });
    expect(player.snapshot.get().fromDevice).toBe(false);
  });

  it("à l'arrêt, plus rien", () => {
    const { player } = setup(["jf:a"]);
    player.playList(tracks, 0);
    player.stop();
    expect(player.snapshot.get().fromDevice).toBe(false);
  });
});
