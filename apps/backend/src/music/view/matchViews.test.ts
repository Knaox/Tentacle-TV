/**
 * `POST /api/music/match` sur un VRAI index SQLite (migrations commitées, FTS5) :
 * l'album de Damien du 25/10 (bande originale que Jellyfin crédite à « Various
 * Artists »), entièrement présent, partiellement, absent, un homonyme, et les
 * droits du compte.
 */

import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCoreMigrations } from "../../services/database/migrator";
import { closeSqlitePrisma, connectSqlitePrisma } from "../../services/database/prismaClient";
import type { MusicMatchAlbumQuery, MusicMatchTrackQuery } from "../contract/musicCoreApi";
import type { IndexRow } from "../index/indexTypes";
import { upsertRows } from "../index/indexStore";
import { parseMatchRequest } from "./matchInput";
import { matchView } from "./matchViews";
import type { UserView } from "./viewContext";

const db = vi.hoisted(() => ({ client: null as unknown as PrismaClient }));
vi.mock("../../services/db", () => ({ getPrisma: () => db.client }));

let client: PrismaClient;
let folder: string;

const OST = "Cyberpunk: Edgerunners 2 (Original Series Soundtrack)";
const ALBUM = "a".repeat(32);
const VA = { id: "f".repeat(32), name: "Various Artists" };
// La FTS dérive son rowid du DÉBUT de l'identifiant : des débuts distincts.
const id = (n: number) => n.toString(16).padEnd(32, "c");

function row(rowId: string, kind: IndexRow["kind"], name: string, extra: Partial<IndexRow> = {}): IndexRow {
  return {
    id: rowId, kind, name, sortName: name.toLowerCase(), albumId: null, albumName: null, albumArtist: null, artists: [],
    year: null, trackNumber: null, discNumber: null, durationMs: null, recordingMbid: null, releaseMbid: null,
    releaseGroupMbid: null, artistMbid: null, format: null, sizeBytes: null, normalizationGain: null, imageTag: null,
    childCount: null, dateCreated: null, ...extra,
  };
}

// L'album tel que l'index de Damien le tient : chaque piste créditée « Various Artists », MBID de l'interprète.
const SOUNDTRACK: [string, string, number][] = [
  ["Watson", "Interprète Un", 202_966],
  ["You Can't Run From Me", "Interprète Deux", 234_266],
  ["Worth It", "Corbin", 161_984],
];
const ROWS: IndexRow[] = [
  row(ALBUM, "album", OST, { albumArtist: "Various Artists", artists: [{ id: id(90), name: "Petite Meller feat. Oslo Green", mbid: null }], childCount: 3 }),
  ...SOUNDTRACK.map(([title, , ms], i) =>
    row(id(i + 1), "track", title, { albumId: ALBUM, albumName: OST, albumArtist: "Various Artists", artists: [{ ...VA, mbid: null }], trackNumber: i + 1, discNumber: 1, durationMs: ms }),
  ),
  // Un homonyme : même titre, un autre artiste, un autre album.
  row(id(50), "track", "Worth It", { albumName: "Reflection", artists: [{ id: id(51), name: "Fifth Harmony", mbid: null }], durationMs: 224_573 }),
];

const ext = (title: string, artist: string, ms: number, n: number, extra: Partial<MusicMatchTrackQuery> = {}): MusicMatchTrackQuery => ({
  ref: `ext:src:t:${n}`, title, artists: [{ name: artist, mbid: null }], albumTitle: OST, durationMs: ms, recording: null, trackNumber: n, discNumber: 1, ...extra,
});
const soundtrackTracks = SOUNDTRACK.map(([title, artist, ms], i) => ext(title, artist, ms + 500, i + 1));
const albumQuery = (tracks: MusicMatchTrackQuery[], over: Partial<MusicMatchAlbumQuery> = {}): MusicMatchAlbumQuery => ({
  ref: "ext:src:al:1", title: OST, artists: [{ name: "Various Artists", mbid: null }], release: null, releaseGroup: null, compilation: false, trackCount: tracks.length, tracks, ...over,
});

const everyone: UserView = { userId: "u", access: { mode: "all", libraryId: "lib" }, favorites: new Set() };
const run = (body: unknown, view = everyone) => matchView(view, parseMatchRequest(body)!);

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), "tentacle-music-match-"));
  const path = join(folder, "tentacle.db");
  applyCoreMigrations(path);
  client = await connectSqlitePrisma(path);
  db.client = client;
});

afterAll(async () => {
  await closeSqlitePrisma(client);
  rmSync(folder, { recursive: true, force: true });
});

beforeEach(async () => {
  await client.$executeRawUnsafe(`DELETE FROM "music_items"`);
  await client.$executeRawUnsafe(`DELETE FROM "music_fts"`);
  await upsertRows(ROWS, 1);
});

describe("ce que la bibliothèque a (POST /api/music/match)", () => {
  it("un album entièrement présent : reconnu, couverture complète, chaque titre rendu comme celui de la bibliothèque", async () => {
    const out = await run({ albums: [albumQuery(soundtrackTracks)] });
    expect(out.albums).toHaveLength(1);
    expect(out.albums[0]).toMatchObject({ ref: "ext:src:al:1", coverage: "full", album: { jellyfinId: ALBUM } });
    expect(out.albums[0]!.tracks.map((t) => t.track.jellyfinId)).toEqual([id(1), id(2), id(3)]);
    expect(out.tracks.find((t) => t.ref === "ext:src:t:3")?.track).toMatchObject({ key: `jf:${id(3)}`, availability: "library" });
  });

  it("un album partiellement présent : couverture partielle, piste par piste", async () => {
    const out = await run({ albums: [albumQuery([...soundtrackTracks, ext("Absent Here", "Quelqu'un", 190_000, 4)])] });
    expect(out.albums[0]?.coverage).toBe("partial");
    expect(out.albums[0]?.tracks.map((t) => t.ref)).toEqual(["ext:src:t:1", "ext:src:t:2", "ext:src:t:3"]);
    expect(out.tracks.some((t) => t.ref === "ext:src:t:4")).toBe(false);
  });

  it("un album absent : rien", async () => {
    const out = await run({ albums: [albumQuery([ext("Other", "X", 100_000, 1, { albumTitle: "Inconnu" })], { title: "Inconnu", artists: [{ name: "X", mbid: null }] })] });
    expect(out).toEqual({ tracks: [], albums: [] });
  });

  it("un homonyme n'est jamais pris pour le titre de la bibliothèque", async () => {
    const out = await run({ tracks: [ext("Worth It", "Fifth Harmony", 224_000, 9, { albumTitle: "7/27" }), ext("Worth It", "Quelqu'un d'autre", 161_984, 8, { albumTitle: "Ailleurs" })] });
    expect(out.tracks.map((t) => [t.ref, t.track.jellyfinId])).toEqual([["ext:src:t:9", id(50)]]);
  });

  it("un titre seul de la bande originale : reconnu par son album, à sa durée", async () => {
    const out = await run({ tracks: [ext("Worth It (from Cyberpunk: Edgerunners 2)", "Corbin", 162_400, 3)] });
    expect(out.tracks.map((t) => t.track.jellyfinId)).toEqual([id(3)]);
  });

  it("un album sans liste de titres (carte) : complet si la bibliothèque en a autant", async () => {
    const card = albumQuery([], { trackCount: 3 });
    delete card.tracks;
    expect((await run({ albums: [card] })).albums[0]?.coverage).toBe("full");
    expect((await run({ albums: [{ ...card, trackCount: 12 }] })).albums[0]?.coverage).toBe("partial");
    // Une liste vide ou un compte inconnu ne font jamais un album « entier ».
    expect((await run({ albums: [{ ...card, tracks: [] }] })).albums[0]?.coverage).toBe("full");
    expect((await run({ albums: [{ ...card, tracks: [], trackCount: null }] })).albums[0]?.coverage).toBe("partial");
  });

  it("les droits du compte : ce qu'il ne voit pas n'existe pas", async () => {
    const some: UserView = { ...everyone, access: { mode: "some", libraryId: "lib", visible: new Set([id(1)]) } };
    const out = await run({ albums: [albumQuery(soundtrackTracks)], tracks: [ext("Worth It", "Corbin", 161_984, 3)] }, some);
    expect(out.albums).toEqual([]);
    expect(out.tracks).toEqual([{ ref: "ext:src:t:1", track: expect.objectContaining({ jellyfinId: id(1) }) }]);
    expect(await run({ albums: [albumQuery(soundtrackTracks)] }, { ...everyone, access: { mode: "none" } })).toEqual({ tracks: [], albums: [] });
  });

  it("un corps hors bornes est refusé", () => {
    expect(parseMatchRequest({ tracks: Array.from({ length: 201 }, (_, i) => ext("T", "A", 1, i)) })).toBeNull();
    expect(parseMatchRequest("x")).toBeNull();
    expect(parseMatchRequest({ tracks: [{ ref: "r" }] })).toEqual({ tracks: [], albums: [] });
  });
});
