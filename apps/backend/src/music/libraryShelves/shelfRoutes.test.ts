/**
 * Les favoris de la bibliothèque d'Octave : un album, un artiste, MA playlist → le favori Jellyfin ; une playlist
 * REÇUE et un élément d'extension → gardés par Tentacle (jamais Jellyfin) ; l'ordre d'une rubrique ; ce que le
 * compte ne voit pas → 404 ; la capacité absente → aucune route.
 */

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ME = "1".repeat(32);
const OWNER = "2".repeat(32);
const ALBUM = "a".repeat(32);
const ARTIST = "b".repeat(32);
const PL = "c".repeat(32);

const state = vi.hoisted(() => ({
  declared: true,
  visible: true,
  reader: "1".repeat(32) as string | null,
  jellyfinOk: true,
  jellyfin: [] as [string, boolean][],
  stored: [] as [string, string, boolean, string | null][],
  orders: [] as [string, string[]][],
  sent: [] as string[],
}));

vi.mock("../routes/requestView", () => ({
  userOf: () => ({ userId: "1".repeat(32) }),
  viewOf: async () => ({ userId: "1".repeat(32), access: { mode: "all", libraryId: "lib" }, favorites: new Set() }),
}));
vi.mock("../../serverCapabilities/declaredCapabilities", () => ({
  capabilityGate: () => async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => (state.declared ? undefined : reply.status(404).send({ error: "not_available" })),
}));
vi.mock("../../services/wsManager", () => ({ sendToUser: (_u: string, m: { type: string }) => void state.sent.push(m.type) }));
vi.mock("../access/userFavorites", () => ({
  writeFavorite: async (_u: string, id: string, fav: boolean) => {
    if (state.jellyfinOk) state.jellyfin.push([id, fav]);
    return state.jellyfinOk;
  },
}));
vi.mock("../index/indexQueries", () => ({
  rowById: async (id: string) => (id === "a".repeat(32) ? { id, kind: "album" } : id === "b".repeat(32) ? { id, kind: "artist" } : null),
}));
vi.mock("../view/viewContext", () => ({ visibleRows: (_v: unknown, rows: unknown[]) => (state.visible ? rows : []) }));
vi.mock("../playlistMembers/playlistAccess", () => ({ playlistAccess: async () => (state.reader ? { playlist: {}, readerId: state.reader, right: "owner" } : null) }));
vi.mock("../playlists/playlistJellyfin", () => ({ forgetUserPlaylists: () => undefined }));
vi.mock("./shelfFavoriteStore", () => ({
  writeShelfFavorite: async (_u: string, section: string, key: string, fav: boolean, json: string | null) => void state.stored.push([section, key, fav, json]),
}));
vi.mock("../listOrder/shelfOrderStore", () => ({ writeShelfOrder: async (_u: string, section: string, keys: string[]) => void state.orders.push([section, keys]) }));
vi.mock("./shelvesView", () => ({ shelvesView: async () => ({ albums: [], artists: [], playlists: [], order: { albums: [], artists: [], playlists: [] } }) }));

import { musicShelfRoutes } from "./shelfRoutes";

async function call(method: "GET" | "PUT", url: string, payload?: object) {
  const app = Fastify();
  await app.register(async (scope) => musicShelfRoutes(scope), { prefix: "/api/music" });
  const res = await app.inject({ method, url, payload });
  await app.close();
  return res;
}

const fav = (body: object) => call("PUT", "/api/music/library/favorite", body);

beforeEach(() => {
  Object.assign(state, { declared: true, visible: true, reader: ME, jellyfinOk: true, jellyfin: [], stored: [], orders: [], sent: [] });
});

describe("favoris de la bibliothèque", () => {
  it("un album, un artiste : le favori Jellyfin, et les autres appareils l'apprennent", async () => {
    expect((await fav({ section: "albums", jellyfinId: ALBUM, favorite: true })).json()).toEqual({ section: "albums", key: `jf:${ALBUM}`, favorite: true });
    expect((await fav({ section: "artists", jellyfinId: ARTIST, favorite: false })).statusCode).toBe(200);
    expect(state.jellyfin).toEqual([[ALBUM, true], [ARTIST, false]]);
    expect(state.stored).toEqual([]);
    expect(state.sent).toEqual(["music:userdata", "music:shelves", "music:userdata", "music:shelves"]);
  });
  it("un identifiant de la mauvaise rubrique, ou invisible pour le compte : 404, rien d'écrit", async () => {
    expect((await fav({ section: "artists", jellyfinId: ALBUM, favorite: true })).statusCode).toBe(404);
    state.visible = false;
    expect((await fav({ section: "albums", jellyfinId: ALBUM, favorite: true })).statusCode).toBe(404);
    expect(state.jellyfin).toEqual([]);
  });
  it("Jellyfin muet : 503", async () => {
    state.jellyfinOk = false;
    expect((await fav({ section: "albums", jellyfinId: ALBUM, favorite: true })).statusCode).toBe(503);
  });
  it("MA playlist : Jellyfin ; une playlist REÇUE : gardée par Tentacle ; inconnue : 404", async () => {
    await fav({ section: "playlists", jellyfinId: PL, favorite: true });
    expect(state.jellyfin).toEqual([[PL, true]]);
    state.reader = OWNER;
    await fav({ section: "playlists", jellyfinId: PL, favorite: true });
    expect(state.stored).toEqual([["playlists", `jf:${PL}`, true, null]]);
    expect(state.jellyfin).toHaveLength(1);
    state.reader = null;
    expect((await fav({ section: "playlists", jellyfinId: PL, favorite: true })).statusCode).toBe(404);
  });
  it("un élément d'extension : son instantané (champs d'une carte seulement), retiré sans instantané", async () => {
    const external = { pluginId: "sillon", id: "rg:42" };
    const album = { title: "Discovery", artists: [{ name: "Daft Punk", mbid: null }], kind: "album", artworkUrl: "https://img/1.jpg", tracks: [{}], year: 2001 };
    expect((await fav({ section: "albums", external, album, favorite: true })).json()).toEqual({ section: "albums", key: "ext:sillon:rg:42", favorite: true });
    const kept = JSON.parse(state.stored[0]![3]!);
    expect(kept).toMatchObject({ key: "ext:sillon:rg:42", jellyfinId: null, external, title: "Discovery", year: 2001, favorite: true });
    expect(kept.tracks).toBeUndefined();
    await fav({ section: "albums", external, favorite: false });
    expect(state.stored[1]).toEqual(["albums", "ext:sillon:rg:42", false, null]);
    expect(state.jellyfin).toEqual([]);
  });
  it("entrées mal formées : 400", async () => {
    expect((await fav({ section: "tracks", jellyfinId: ALBUM, favorite: true })).statusCode).toBe(400);
    expect((await fav({ section: "albums", jellyfinId: ALBUM, favorite: "yes" })).statusCode).toBe(400);
    expect((await fav({ section: "albums", external: { pluginId: "Bad Id", id: "1" }, album: { title: "x" }, favorite: true })).statusCode).toBe(400);
    expect((await fav({ section: "albums", external: { pluginId: "p", id: "1" }, favorite: true })).statusCode).toBe(400);
  });
});

describe("ordre d'une rubrique", () => {
  it("gardé tel quel (doublons retirés), les autres appareils l'apprennent", async () => {
    expect((await call("PUT", "/api/music/library/order/playlists", { keys: ["jf:1", "ext:p:2", "jf:1"] })).statusCode).toBe(200);
    expect(state.orders).toEqual([["playlists", ["jf:1", "ext:p:2"]]]);
    expect(state.sent).toEqual(["music:shelves"]);
    expect((await call("PUT", "/api/music/library/order/tracks", { keys: [] })).statusCode).toBe(400);
  });
});

describe("serveur sans la capacité", () => {
  it("aucune route", async () => {
    state.declared = false;
    expect((await call("GET", "/api/music/library/shelves")).statusCode).toBe(404);
    expect((await fav({ section: "albums", jellyfinId: ALBUM, favorite: true })).statusCode).toBe(404);
  });
});
