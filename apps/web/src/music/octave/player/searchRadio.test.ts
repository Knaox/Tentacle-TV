import { describe, expect, it, vi } from "vitest";
import type { MusicProvider } from "@tentacle-tv/api-client";
import type { ExternalMusicRadio, MusicTrack, PlaybackSource } from "@tentacle-tv/shared/music";
import { OctavePlayer, PlaybackReporter, SourceCache, currentItem, upcoming } from "@tentacle-tv/shared/octave";
import { createFakeEngine, externalTrack } from "@tentacle-tv/shared/octave/testing";
import { followSearchWithRadio, RADIO_MISSES_MAX } from "./searchRadio";

/**
 * S3 du plan de R8 : la suite d'un clic de RECHERCHE est la radio du titre touché, demandée après son premier son ;
 * un album garde sa liste ; sans radio, la file d'avant. G3 : la radio est sans fin — sa page suivante se demande à
 * 5 titres de la fin, sans redire ce que la file porte déjà.
 */
const sourceOf = (key: string): PlaybackSource => ({ trackKey: key, url: `/s/${key}`, origin: "plugin", complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null });
const provider = (radio: string | undefined) => ({ pluginId: "sillon", name: "Sillon", configEnabled: true, music: { search: "/music/search", resolve: "/music/resolve", ...(radio ? { radio } : {}) } }) as unknown as MusicProvider;
const tracksOf = (...ids: string[]) => ids.map((id) => externalTrack("sillon", `ytm:t:${id}`));
const results = tracksOf("r1", "r2", "r3");
const radio = tracksOf("x1", "x2");
const flush = () => new Promise((r) => setTimeout(r, 0));
const keysOf = (tracks: readonly MusicTrack[]) => tracks.map((t) => t.key);

type PageFetch = (provider: MusicProvider, externalId: string, options: { cursor?: string }) => Promise<ExternalMusicRadio | null>;

function rig(p: MusicProvider | null, pages: PageFetch) {
  const engine = createFakeEngine();
  const sources = new SourceCache({ library: async (id) => sourceOf(`jf:${id}`), external: async (t) => sourceOf(t.key), now: () => 0 });
  const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
  const player = new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {} });
  const fetchPage = vi.fn(pages);
  const off = followSearchWithRadio(player, () => p, fetchPage);
  const upcomingKeys = () => upcoming(player.snapshot.get().queue).map((i) => i.track.key);
  return { engine, player, fetchPage, off, upcomingKeys };
}

/** Une radio servie page par page : la 1re sans jeton demandé, les suivantes par leur jeton. */
function pagesBy(byCursor: Record<string, ExternalMusicRadio | null>): PageFetch {
  return async (_provider, _externalId, options) => byCursor[options.cursor ?? "first"] ?? null;
}

/** Clic sur le 2e résultat d'une recherche, puis son premier son : la radio devient la suite. */
async function clickAndSound(r: ReturnType<typeof rig>) {
  r.player.playList(results, 1, "search:iris out");
  await flush();
  r.engine.sound(0);
  await flush();
}

/** « Suivant » `n` fois, chaque titre le temps de démarrer. */
async function skip(r: ReturnType<typeof rig>, n: number) {
  for (let i = 0; i < n; i++) {
    r.player.next();
    await flush();
    r.engine.sound(0);
    await flush();
  }
}

describe("la suite d'un clic de recherche : la radio, après le premier son", () => {
  it("rien avant le son ; au premier son, la radio du titre touché devient la suite (une seule demande)", async () => {
    const r = rig(provider("/music/radio"), pagesBy({ first: { tracks: radio, cursor: null } }));
    r.player.playList(results, 1, "search:iris out");
    await flush();
    expect(r.fetchPage).not.toHaveBeenCalled();
    r.engine.sound(0);
    r.engine.sound(500);
    await flush();
    expect(r.fetchPage).toHaveBeenCalledTimes(1);
    expect(r.fetchPage.mock.calls[0]?.[1]).toBe("ytm:t:r2");
    expect(r.upcomingKeys()).toEqual(keysOf(radio));
    expect(r.player.snapshot.get().queue.contextId).toBe(`radio:${results[1]!.key}`);
    r.off();
  });

  it("un album garde sa liste ; une extension sans radio, ou une radio vide : la file d'avant", async () => {
    for (const [p, context, page] of [[provider("/music/radio"), "album:1", radio], [provider(undefined), "search:x", radio], [provider("/music/radio"), "search:x", []]] as const) {
      const r = rig(p, pagesBy({ first: { tracks: [...page], cursor: "c1" } }));
      r.player.playList(results, 0, context);
      await flush();
      r.engine.sound(0);
      await flush();
      expect(r.upcomingKeys()).toEqual(keysOf(results.slice(1)));
      r.off();
    }
  });

  it("l'utilisateur a changé de titre avant la réponse : la radio de l'ancien ne touche pas la nouvelle file", async () => {
    let answer: (page: ExternalMusicRadio) => void = () => undefined;
    const r = rig(provider("/music/radio"), () => new Promise((resolve) => (answer = resolve)));
    r.player.playList(results, 0, "search:x");
    await flush();
    r.engine.sound(0);
    r.player.playList(results, 2, "album:2");
    answer({ tracks: radio, cursor: "c1" });
    await flush();
    expect(r.upcomingKeys()).toEqual([]);
    expect(r.player.snapshot.get().queue.contextId).toBe("album:2");
    r.off();
  });
});

describe("la radio sans fin (G3)", () => {
  const first = tracksOf("x1", "x2", "x3", "x4", "x5", "x6", "x7", "x8");

  it("à 5 titres de la fin, la page suivante par son jeton ; ce que la file porte déjà (écouté ou à venir) n'est pas redit", async () => {
    const r = rig(provider("/music/radio"), pagesBy({ first: { tracks: first, cursor: "c1" }, c1: { tracks: [...tracksOf("x7", "x8", "r1", "y1"), ...tracksOf("y1", "y2")], cursor: "c2" } }));
    await clickAndSound(r);
    await skip(r, 2);
    expect(r.fetchPage).toHaveBeenCalledTimes(1);
    await skip(r, 1);
    expect(r.fetchPage).toHaveBeenCalledTimes(2);
    expect(r.fetchPage.mock.calls[1]?.[2]).toEqual({ cursor: "c1" });
    expect(r.upcomingKeys()).toEqual(keysOf(tracksOf("x4", "x5", "x6", "x7", "x8", "y1", "y2")));
    r.off();
  });

  it("une page courte : la suivante tout de suite, par le NOUVEAU jeton — jamais l'ancien une seconde fois", async () => {
    const r = rig(provider("/music/radio"), pagesBy({ first: { tracks: first.slice(0, 3), cursor: "c1" }, c1: { tracks: tracksOf("y1"), cursor: "c2" }, c2: { tracks: tracksOf("y2", "y3", "y4"), cursor: null } }));
    await clickAndSound(r);
    await flush();
    expect(r.fetchPage.mock.calls.map((call) => call[2])).toEqual([{}, { cursor: "c1" }, { cursor: "c2" }]);
    expect(r.upcomingKeys()).toEqual(keysOf(tracksOf("x1", "x2", "x3", "y1", "y2", "y3", "y4")));
    r.off();
  });

  it("une page sans jeton : la radio s'arrête là, plus aucune demande", async () => {
    const r = rig(provider("/music/radio"), pagesBy({ first: { tracks: first, cursor: null } }));
    await clickAndSound(r);
    await skip(r, 6);
    expect(r.fetchPage).toHaveBeenCalledTimes(1);
    r.off();
  });

  it("une panne attend le titre suivant pour réessayer, avec le même jeton ; trois de suite arrêtent la radio", async () => {
    const r = rig(provider("/music/radio"), pagesBy({ first: { tracks: first.slice(0, 6), cursor: "c1" } }));
    await clickAndSound(r);
    await skip(r, 1);
    expect(r.fetchPage).toHaveBeenCalledTimes(2);
    // Le même titre qui joue (positions, pause) : pas de nouvelle demande.
    r.engine.sound(1_000);
    r.player.pause();
    await flush();
    expect(r.fetchPage).toHaveBeenCalledTimes(2);
    await skip(r, 1);
    expect(r.fetchPage).toHaveBeenCalledTimes(3);
    expect(r.fetchPage.mock.calls[2]?.[2]).toEqual({ cursor: "c1" });
    await skip(r, RADIO_MISSES_MAX);
    expect(r.fetchPage).toHaveBeenCalledTimes(1 + RADIO_MISSES_MAX);
    r.off();
  });

  it("une seule demande en vol, quoi qu'il arrive au lecteur pendant ce temps", async () => {
    let answer: (page: ExternalMusicRadio) => void = () => undefined;
    const r = rig(provider("/music/radio"), (_p, _id, options) => (options.cursor ? new Promise((resolve) => (answer = resolve)) : Promise.resolve({ tracks: first.slice(0, 5), cursor: "c1" })));
    await clickAndSound(r);
    expect(r.fetchPage).toHaveBeenCalledTimes(2);
    r.engine.sound(800);
    await skip(r, 2);
    expect(r.fetchPage).toHaveBeenCalledTimes(2);
    answer({ tracks: tracksOf("y1", "y2", "y3", "y4", "y5", "y6"), cursor: null });
    await flush();
    expect(r.upcomingKeys()).toEqual(keysOf(tracksOf("x3", "x4", "x5", "y1", "y2", "y3", "y4", "y5", "y6")));
    expect(r.fetchPage).toHaveBeenCalledTimes(2);
    r.off();
  });

  it("l'utilisateur a lancé autre chose pendant la demande : la page n'entre pas dans la nouvelle file", async () => {
    let answer: (page: ExternalMusicRadio) => void = () => undefined;
    const r = rig(provider("/music/radio"), (_p, _id, options) => (options.cursor ? new Promise((resolve) => (answer = resolve)) : Promise.resolve({ tracks: first.slice(0, 5), cursor: "c1" })));
    await clickAndSound(r);
    r.player.playList(results, 0, "album:1");
    await flush();
    answer({ tracks: tracksOf("y1"), cursor: "c2" });
    await flush();
    expect(r.player.snapshot.get().queue.contextId).toBe("album:1");
    expect(currentItem(r.player.snapshot.get().queue)?.track.key).toBe(results[0]!.key);
    expect(r.upcomingKeys()).toEqual(keysOf(results.slice(1)));
    await skip(r, 2);
    expect(r.fetchPage).toHaveBeenCalledTimes(2);
    r.off();
  });
});
