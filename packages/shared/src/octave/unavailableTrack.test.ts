import { describe, expect, it, vi } from "vitest";
import type { PlaybackSource } from "../music";
import { createFakeEngine } from "./fakeEngine";
import { externalTrack, libraryTrack } from "./fixtures";
import { OctavePlayer } from "./octavePlayer";
import { queueActions } from "./octaveQueueActions";
import { PlaybackReporter } from "./playbackReports";
import { advance, createQueue, currentItem, peekNext, previous } from "./queueModel";
import { SourceCache } from "./sourceCache";
import { isTrackUnavailable, onUnavailableTrack } from "./unavailableTrack";

/** Lot « fl » (30/10) : un titre indisponible est grisé, SAUTÉ par la file, refusé au geste (« pas disponible »). */
const lost = (id: string) => externalTrack("sillon", `imp:${id}`, { unavailable: "notStreamable" });
const list = [libraryTrack("a"), lost("x"), libraryTrack("b"), lost("y"), libraryTrack("c")];
const keyOf = (q: ReturnType<typeof createQueue> | null) => (q ? currentItem(q)?.track.key : null);

describe("titre indisponible — la règle", () => {
  it("indisponible : marqué par l'extension, jamais un titre de la bibliothèque", () => {
    expect(isTrackUnavailable(lost("x"))).toBe(true);
    expect(isTrackUnavailable(externalTrack("sillon", "ytm:t:1"))).toBe(false);
    expect(isTrackUnavailable(libraryTrack("a", { unavailable: "notStreamable" }))).toBe(false);
  });
});

describe("titre indisponible — la file le saute", () => {
  it("fin du titre et « Suivant » passent par-dessus, le suivant annoncé au moteur aussi", () => {
    const q = createQueue(list, 0);
    expect(peekNext(q, true)?.track.key).toBe("jf:b");
    const b = advance(q, true);
    expect(keyOf(b)).toBe("jf:b");
    expect(keyOf(advance(b!, false))).toBe("jf:c");
  });

  it("deux indisponibles de suite, puis la fin : rien après, sans boucle", () => {
    const tail = createQueue([libraryTrack("a"), lost("x"), lost("y")], 0);
    expect(advance(tail, true)).toBeNull();
    expect(advance({ ...tail, repeat: "all" }, true) && keyOf(advance({ ...tail, repeat: "all" }, true))).toBe("jf:a");
    const none = createQueue([lost("x"), lost("y")], 0, { repeat: "all" });
    expect(advance(none, true)).toBeNull();
  });

  it("« Précédent » revient au titre lisible d'avant, et reboucle sur le dernier lisible en « tout répéter »", () => {
    const atB = createQueue(list, 2);
    const back = previous(atB, 0);
    expect(back.kind === "moved" && keyOf(back.queue)).toBe("jf:a");
    const loop = previous({ ...createQueue([libraryTrack("a"), libraryTrack("b"), lost("z")], 0), repeat: "all" }, 0);
    expect(loop.kind === "moved" && keyOf(loop.queue)).toBe("jf:b");
  });

  it("« Lire » une liste qui commence par un indisponible part du premier lisible ; en aléatoire aussi", () => {
    expect(keyOf(createQueue([lost("x"), libraryTrack("a")], 0))).toBe("jf:a");
    const shuffled = createQueue([lost("x"), libraryTrack("a"), libraryTrack("b")], 0, { shuffle: true, random: () => 0.5 });
    expect(isTrackUnavailable(currentItem(shuffled)!.track)).toBe(false);
  });

  it("« répéter un titre » ne reste pas sur un indisponible", () => {
    const q = { ...createQueue(list, 0), cursor: 1, repeat: "one" as const };
    expect(keyOf(advance(q, true))).toBe("jf:b");
  });
});

describe("titre indisponible — le geste est seulement dit", () => {
  it("un clic dans la file : rien ne change, l'avis est annoncé", () => {
    const sourceOf = (key: string): PlaybackSource => ({ trackKey: key, url: `/s/${key}`, origin: "library", complete: true, sizeBytes: null, durationMs: 1, format: null, replayGain: null, expiresAt: null });
    const sources = new SourceCache({ library: async (id) => sourceOf(`jf:${id}`), external: async (t) => sourceOf(t.key), now: () => 0 });
    const player = new OctavePlayer({
      engine: createFakeEngine(),
      sources,
      reporter: new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 }),
      prefetchExternal: () => {},
      skipDelayMs: 0,
    });
    const told = vi.fn();
    const off = onUnavailableTrack(told);
    player.playList(list, 0, "playlist:1");
    const before = player.snapshot.get();
    const target = before.queue.items[1]!;
    queueActions.jumpTo(player, target.uid);
    expect(told).toHaveBeenCalledTimes(1);
    expect(player.snapshot.get().current?.key).toBe("jf:a");
    expect(player.snapshot.get().queue.cursor).toBe(before.queue.cursor);
    off();
    player.dispose();
  });
});
