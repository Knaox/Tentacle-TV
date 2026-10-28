/**
 * La jaquette composée des playlists côté cœur : aucune relecture au repos, une relecture quand le tampon de
 * Jellyfin bouge, quatre lectures à la fois au plus, un budget au premier passage, et la vue d'une playlist qui
 * renouvelle sa place sans rien relire.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicPlaylist, MusicTrack } from "../contract/musicTypes";
import type { JfPlaylist } from "../playlists/playlistJellyfin";
import type { UserView } from "./viewContext";

const jf = vi.hoisted(() => ({
  entries: new Map<string, string[]>(),
  delayMs: new Map<string, number>(),
  calls: [] as string[],
  running: 0,
  maxRunning: 0,
  fail: new Set<string>(),
  handPlaced: new Set<string>(),
  imageReads: [] as string[],
}));

vi.mock("../playlists/playlistJellyfin", () => ({
  playlistHasHandPlacedImage: async (item: JfPlaylist) => {
    jf.imageReads.push(item.Id);
    return jf.handPlaced.has(item.Id);
  },
  playlistEntries: async (_userId: string, playlistId: string) => {
    jf.calls.push(playlistId);
    jf.running++;
    jf.maxRunning = Math.max(jf.maxRunning, jf.running);
    await new Promise((resolve) => setTimeout(resolve, jf.delayMs.get(playlistId) ?? 1));
    jf.running--;
    if (jf.fail.has(playlistId)) return null;
    return (jf.entries.get(playlistId) ?? []).map((itemId) => ({ entryId: `e-${itemId}`, itemId, plays: { plays: 0, lastPlayedAt: null } }));
  },
}));

/** Un identifiant d'élément = « <album>-<n> » : le titre n de l'album, pochette embarquée. */
vi.mock("./viewContext", () => ({
  visibleInOrder: async (_view: UserView, ids: readonly string[]) => ids.map((id) => ({ id })),
  tracksOf: async (_view: UserView, rows: readonly { id: string }[]) => rows.map(({ id }) => trackFor(id)),
}));

function trackFor(id: string): MusicTrack {
  const album = id.split("-")[0]!;
  return {
    key: `jf:${id}`, jellyfinId: id, external: null, title: id, artists: [{ name: `art-${album}`, mbid: null, jellyfinId: `ar${album}` }],
    album: { title: album, mbid: null, jellyfinId: `al${album}` }, durationMs: null, trackNumber: null, discNumber: null, year: null,
    artworkUrl: `/api/music/artwork/${id}?tag=x`, mbids: { recording: null, release: null, releaseGroup: null, artists: [] },
    availability: "library", format: null, favorite: false,
  };
}

const { forgetMosaics, mosaicCandidatesFor, rememberMosaic, withMosaic } = await import("./playlistMosaic");

const view = { userId: "u1", access: { mode: "all" } } as unknown as UserView;
const NOW = Date.UTC(2026, 9, 28, 12);

function jfPlaylist(id: string, etag = "e1", count = 8): JfPlaylist {
  return { Id: id, Name: id, ChildCount: count, Etag: etag };
}

function fill(id: string, albums: number) {
  jf.entries.set(id, Array.from({ length: albums }, (_, k) => [`${id}a${k}-1`, `${id}a${k}-2`]).flat());
}

const playlist = (id: string): MusicPlaylist => ({ jellyfinId: id, name: id, trackCount: 8, durationMs: null, artworkUrl: "/api/music/artwork/p?tag=collage", editable: true });

beforeEach(() => {
  forgetMosaics();
  jf.entries.clear();
  jf.delayMs.clear();
  jf.fail.clear();
  jf.handPlaced.clear();
  jf.imageReads = [];
  jf.calls = [];
  jf.maxRunning = 0;
});

describe("mosaicCandidatesFor", () => {
  it("au repos, la liste ne relit rien ; un tampon changé relit CETTE playlist", async () => {
    fill("p1", 6);
    fill("p2", 6);
    const items = [jfPlaylist("p1"), jfPlaylist("p2")];
    await mosaicCandidatesFor(view, items, { now: NOW });
    expect(jf.calls.sort()).toEqual(["p1", "p2"]);
    jf.calls = [];
    await mosaicCandidatesFor(view, items, { now: NOW + 60_000 });
    expect(jf.calls).toEqual([]);
    await mosaicCandidatesFor(view, [jfPlaylist("p1", "e2"), jfPlaylist("p2")], { now: NOW + 120_000 });
    expect(jf.calls).toEqual(["p1"]);
  });

  it("un album par case : deux titres du même album ne font qu'un candidat", async () => {
    fill("p1", 6);
    const candidates = (await mosaicCandidatesFor(view, [jfPlaylist("p1")], { now: NOW })).get("p1")!;
    expect(candidates.candidates).toHaveLength(6);
  });

  it("quatre lectures à la fois au plus", async () => {
    const items = Array.from({ length: 10 }, (_, k) => {
      fill(`q${k}`, 4);
      jf.delayMs.set(`q${k}`, 5);
      return jfPlaylist(`q${k}`);
    });
    const out = await mosaicCandidatesFor(view, items, { now: NOW });
    expect(out.size).toBe(10);
    expect(jf.maxRunning).toBe(4);
  });

  it("une playlist trop lente garde l'image de Jellyfin cette fois-ci, et a sa jaquette à la liste suivante", async () => {
    fill("fast", 5);
    fill("slow", 5);
    jf.delayMs.set("slow", 80);
    const items = [jfPlaylist("fast"), jfPlaylist("slow")];
    const first = await mosaicCandidatesFor(view, items, { now: NOW, waitMs: 20 });
    expect([...first.keys()]).toEqual(["fast"]);
    await new Promise((resolve) => setTimeout(resolve, 120));
    jf.calls = [];
    const second = await mosaicCandidatesFor(view, items, { now: NOW, waitMs: 20 });
    expect([...second.keys()].sort()).toEqual(["fast", "slow"]);
    expect(jf.calls).toEqual([]);
  });

  it("Jellyfin muet : la place d'avant sert encore, rien ne casse", async () => {
    fill("p1", 5);
    await mosaicCandidatesFor(view, [jfPlaylist("p1")], { now: NOW });
    jf.fail.add("p1");
    const out = await mosaicCandidatesFor(view, [jfPlaylist("p1", "e2")], { now: NOW });
    expect(out.get("p1")?.candidates).toHaveLength(5);
  });

  it("la vue d'une playlist renouvelle sa place : la liste suivante ne relit rien, et montre la même jaquette", async () => {
    fill("p1", 7);
    const tracks = jf.entries.get("p1")!.map(trackFor);
    const fromDetail = await rememberMosaic(view, jfPlaylist("p1"), tracks, NOW);
    const fromList = (await mosaicCandidatesFor(view, [jfPlaylist("p1")], { now: NOW })).get("p1");
    expect(jf.calls).toEqual([]);
    expect(withMosaic(playlist("p1"), fromList, NOW).mosaic).toEqual(withMosaic(playlist("p1"), fromDetail, NOW).mosaic);
  });
});

describe("withMosaic", () => {
  it("quatre pochettes d'albums différents à partir de quatre albums ; une seule en dessous", async () => {
    fill("p1", 6);
    fill("p2", 2);
    const four = withMosaic(playlist("p1"), await rememberMosaic(view, jfPlaylist("p1"), jf.entries.get("p1")!.map(trackFor), NOW), NOW);
    const one = withMosaic(playlist("p2"), await rememberMosaic(view, jfPlaylist("p2"), jf.entries.get("p2")!.map(trackFor), NOW), NOW);
    expect(new Set(four.mosaic).size).toBe(4);
    expect(one.mosaic).toHaveLength(1);
  });

  it("aucun album à pochette : pas de jaquette composée, l'image de Jellyfin reste", () => {
    const out = withMosaic(playlist("p1"), { candidates: [], handPlaced: false }, NOW);
    expect(out.mosaic).toBeUndefined();
    expect(out.artworkUrl).toBe("/api/music/artwork/p?tag=collage");
  });

  it("une image posée à la main reste la sienne : aucune jaquette composée", async () => {
    fill("p1", 6);
    jf.handPlaced.add("p1");
    const place = (await mosaicCandidatesFor(view, [jfPlaylist("p1")], { now: NOW })).get("p1");
    const out = withMosaic(playlist("p1"), place, NOW);
    expect(out.mosaic).toBeUndefined();
    expect(out.artworkUrl).toBe("/api/music/artwork/p?tag=collage");
  });

  it("le verdict se relit seulement quand le tampon change (l'envoi d'une image change l'Etag)", async () => {
    fill("p1", 6);
    await mosaicCandidatesFor(view, [jfPlaylist("p1")], { now: NOW });
    await rememberMosaic(view, jfPlaylist("p1"), jf.entries.get("p1")!.map(trackFor), NOW);
    expect(jf.imageReads).toEqual(["p1"]);
    jf.handPlaced.add("p1");
    const place = await rememberMosaic(view, jfPlaylist("p1", "e2"), jf.entries.get("p1")!.map(trackFor), NOW);
    expect(jf.imageReads).toEqual(["p1", "p1"]);
    expect(place.handPlaced).toBe(true);
  });

  it("le détail rend sa couverture sans rien du cache (ni tampon, ni date)", async () => {
    fill("p1", 5);
    const place = await rememberMosaic(view, jfPlaylist("p1"), jf.entries.get("p1")!.map(trackFor), NOW);
    expect(Object.keys(place).sort()).toEqual(["candidates", "handPlaced"]);
  });
});
