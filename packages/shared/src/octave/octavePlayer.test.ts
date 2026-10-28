import { describe, expect, it, vi } from "vitest";
import type { MusicTrack, PlaybackSource } from "../music";
import { createFakeEngine } from "./fakeEngine";
import { externalTrack, libraryTrack } from "./fixtures";
import { OctavePlayer } from "./octavePlayer";
import { queueActions } from "./octaveQueueActions";
import { applyResolution } from "./octaveResolution";
import { PlaybackReporter } from "./playbackReports";
import { SourceCache } from "./sourceCache";

function sourceOf(key: string, origin: PlaybackSource["origin"] = "library"): PlaybackSource {
  return { trackKey: key, url: `/src/${key}`, origin, complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null };
}

function setup(options: { externalSource?: boolean } = {}) {
  const engine = createFakeEngine();
  const library = vi.fn(async (id: string) => sourceOf(`jf:${id}`));
  const external = vi.fn(async (track: MusicTrack) => (options.externalSource === false ? null : sourceOf(track.key, "plugin")));
  const sources = new SourceCache({ library, external, now: () => 0 });
  const reports: string[] = [];
  const reporter = new PlaybackReporter({ library: (r) => reports.push(`${r.event}:${r.itemId}`), externalPlayed: () => {}, now: () => 0 });
  const prefetched: string[] = [];
  const player = new OctavePlayer({
    engine,
    sources,
    reporter,
    prefetchExternal: (tracks, intent) => prefetched.push(...tracks.map((t) => `${intent}:${t.key}`)),
    skipDelayMs: 0,
  });
  return { engine, player, library, external, sources, reports, prefetched };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const tracks = ["a", "b", "c"].map((id) => libraryTrack(id));

describe("attente invisible", () => {
  it("le clic pose titre et « Pause » de façon SYNCHRONE, avant toute source", () => {
    const { player, engine } = setup();
    player.playList(tracks, 1, "album:1");
    const snap = player.snapshot.get();
    expect(snap.current?.key).toBe("jf:b");
    expect(snap.wantsPlay).toBe(true);
    expect(snap.phase).toBe("starting");
    expect(engine.calls).toHaveLength(0);
  });

  it("une source anticipée (appui) fait partir le moteur dans le même tour", async () => {
    const { player, engine } = setup();
    player.prefetch([tracks[0]!], "press");
    await flush();
    player.playList(tracks, 0);
    expect(engine.calls[0]).toMatchObject({ method: "play", key: "jf:a" });
  });

  it("la progression reste à zéro jusqu'au son, puis avance", async () => {
    const { player, engine } = setup();
    player.playList(tracks, 0);
    await flush();
    expect(player.position.get()).toMatchObject({ positionMs: 0, running: false });
    engine.sound(1_200);
    expect(player.position.get()).toMatchObject({ positionMs: 1_200, running: true });
    expect(player.snapshot.get().phase).toBe("playing");
  });
});

describe("le moteur ne reçoit que courant + suivant", () => {
  it("le suivant est préchargé, et l'enchaînement sans blanc avance la file", async () => {
    const { player, engine, reports } = setup();
    player.playList(tracks, 0);
    await flush();
    // Le suivant attend le son du courant (jamais deux ouvertures à la fois).
    expect(engine.calls.some((c) => c.method === "setNext")).toBe(false);
    engine.sound(0);
    await flush();
    expect(engine.calls).toContainEqual({ method: "setNext", key: "jf:b" });
    engine.emit({ type: "advanced", fromKey: "jf:a", toKey: "jf:b" });
    expect(player.snapshot.get().current?.key).toBe("jf:b");
    await flush();
    expect(engine.calls.at(-1)).toEqual({ method: "setNext", key: "jf:c" });
    expect(engine.calls.filter((c) => c.method === "play")).toHaveLength(1);
    expect(reports).toContain("start:a");
    expect(reports).toContain("stop:a");
  });

  it("l'aléatoire redit le suivant au moteur", async () => {
    const { player, engine } = setup();
    player.playList(["a", "b", "c", "d", "e"].map((id) => libraryTrack(id)), 0);
    await flush();
    engine.sound(0);
    await flush();
    const before = engine.calls.length;
    queueActions.toggleShuffle(player);
    await flush();
    expect(player.snapshot.get().queue.shuffle).toBe(true);
    expect(engine.calls.slice(before).some((c) => c.method === "setNext")).toBe(true);
  });

  it("un titre CHOISI sans source est signalé et RESTE : jamais sauté (Damien, 25/10)", async () => {
    const { player } = setup({ externalSource: false });
    const chosen = externalTrack("sillon", "r1");
    player.playList([chosen, libraryTrack("b")], 0);
    for (let i = 0; i < 10; i++) await flush();
    expect(player.snapshot.get()).toMatchObject({ phase: "error", error: "noSource" });
    expect(player.snapshot.get().current?.key).toBe(chosen.key);
  });

  it("un titre ENCHAÎNÉ (fin du précédent) sans source est signalé puis passé", async () => {
    const { player, engine } = setup({ externalSource: false });
    player.playList([libraryTrack("a"), externalTrack("sillon", "r1"), libraryTrack("b")], 0);
    await flush();
    engine.sound(0);
    engine.emit({ type: "state", state: { ...engine.getState(), status: "ended" } });
    for (let i = 0; i < 10; i++) await flush();
    expect(player.snapshot.get().current?.key).toBe("jf:b");
  });

  it("L1 : rien du SUIVANT ne part avant le premier son du titre touché", async () => {
    const { player, engine, prefetched, library } = setup();
    player.playList(tracks, 0);
    await flush();
    expect(prefetched.filter((p) => p.startsWith("next:"))).toEqual([]);
    expect(library.mock.calls.map(([id]) => id)).toEqual(["a"]);
    engine.sound(0);
    await flush();
    expect(prefetched).toContain("next:jf:b");
  });
});

describe("titres sans source d'affilée (défaut R2-04)", () => {
  /** Le premier titre de la file sonne puis se termine : la suite ENCHAÎNE d'elle-même. */
  const endFirst = async (engine: ReturnType<typeof createFakeEngine>) => {
    await flush();
    engine.sound(0);
    engine.emit({ type: "state", state: { ...engine.getState(), status: "ended" } });
    for (let i = 0; i < 20; i++) await flush();
  };

  it("une file de titres injouables ne défile pas toute seule : au 3e d'affilée, le lecteur s'arrête, message affiché", async () => {
    const { player, engine } = setup({ externalSource: false });
    const queue = [libraryTrack("a"), ...Array.from({ length: 8 }, (_, i) => externalTrack("sillon", `r${i}`))];
    player.playList(queue, 0);
    await endFirst(engine);
    expect(player.snapshot.get().current?.key).toBe(queue[3]!.key);
    expect(player.snapshot.get()).toMatchObject({ phase: "error", error: "noSource" });
    // « Suivant » est un CHOIX de l'utilisateur : le titre choisi reste, même sans source — plus rien ne défile.
    player.next();
    for (let i = 0; i < 20; i++) await flush();
    expect(player.snapshot.get().current?.key).toBe(queue[4]!.key);
    expect(player.snapshot.get()).toMatchObject({ phase: "error", error: "noSource" });
  });

  it("un titre qui SONNE remet la série à zéro", async () => {
    const engine = createFakeEngine();
    const sources = new SourceCache({ library: async (id) => sourceOf(`jf:${id}`), external: async (t) => (t.key.endsWith(":s2") ? sourceOf(t.key, "plugin") : null), now: () => 0 });
    const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
    const player = new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {}, skipDelayMs: 0 });
    const queue = [libraryTrack("a"), ...Array.from({ length: 6 }, (_, i) => externalTrack("sillon", `s${i}`))];
    player.playList(queue, 0);
    await endFirst(engine);
    expect(player.snapshot.get().current?.key).toBe(queue[3]!.key);
    engine.sound(500);
    expect(player.snapshot.get().phase).toBe("playing");
    engine.emit({ type: "state", state: { ...engine.getState(), status: "ended" } });
    for (let i = 0; i < 20; i++) await flush();
    // Après le son, trois nouveaux échecs enchaînés permis (s3, s4, s5) : arrêt sur s5.
    expect(player.snapshot.get().current?.key).toBe(queue[6]!.key);
  });
});

describe("bascule à la résolution (music:resolved)", () => {
  it("le courant hors bibliothèque devient le titre de la bibliothèque, source basculée à chaud", async () => {
    const { player, engine } = setup();
    const ext = externalTrack("sillon", "r1");
    player.playList([ext, libraryTrack("b")], 0);
    await flush();
    engine.sound(30_000);
    applyResolution(player, { type: "music:resolved", pluginId: "sillon", externalId: "r1", jellyfinId: "jf9", recording: null, track: null });
    expect(player.snapshot.get().current?.key).toBe("jf:jf9");
    expect(player.snapshot.get().current?.availability).toBe("library");
    await flush();
    expect(engine.calls).toContainEqual({ method: "swapSource", key: ext.key, url: "/src/jf:jf9" });
    // Le moteur garde sa clé : ses états suivants restent reconnus.
    engine.sound(31_000);
    expect(player.position.get().positionMs).toBe(31_000);
  });

  it("une entrée plus loin dans la file est remplacée sans toucher au moteur", async () => {
    const { player, engine } = setup();
    player.playList([libraryTrack("a"), libraryTrack("b"), externalTrack("sillon", "r2")], 0);
    await flush();
    applyResolution(player, { type: "music:resolved", pluginId: "sillon", externalId: "r2", jellyfinId: "jf7", recording: null, track: null });
    expect(player.snapshot.get().queue.items[2]?.track.key).toBe("jf:jf7");
    await flush();
    expect(engine.calls.some((c) => c.method === "swapSource")).toBe(false);
  });
});

describe("les deux files, appliquées par le lecteur (o3)", () => {
  it("« Ajouter à la file d'attente » : le moteur prépare ce titre-là ensuite, avant l'album", async () => {
    const { player, engine } = setup();
    player.playList(tracks, 0, "album:1");
    await flush();
    queueActions.enqueue(player, [libraryTrack("x")]);
    await flush();
    expect(engine.calls.filter((c) => c.method === "setNext").at(-1)).toMatchObject({ key: "jf:x" });
  });

  it("un autre album lancé garde la file d'attente, juste après son premier titre", () => {
    const { player } = setup();
    player.playList(tracks, 0, "album:1");
    queueActions.playNext(player, [libraryTrack("x")]);
    player.playList(["m", "n"].map((id) => libraryTrack(id)), 0, "album:2");
    const keys = player.snapshot.get().queue.items.map((i) => i.track.key);
    expect(keys.slice(player.snapshot.get().queue.cursor)).toEqual(["jf:m", "jf:x", "jf:n"]);
  });
});
