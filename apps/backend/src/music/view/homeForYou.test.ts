/**
 * « Pour vous » de l'accueil sur un VRAI index SQLite : albums et artistes du moment, mixes, « parce
 * que vous avez écouté », et les droits du compte (un compte restreint ne voit jamais ce qu'il n'a pas).
 */

import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCoreMigrations } from "../../services/database/migrator";
import { closeSqlitePrisma, connectSqlitePrisma } from "../../services/database/prismaClient";
import type { IndexRow } from "../index/indexTypes";
import { upsertRows } from "../index/indexStore";
import { forYouView, resetForYouCacheForTests } from "./homeForYou";
import type { UserView } from "./viewContext";

const db = vi.hoisted(() => ({ client: null as unknown as PrismaClient }));
vi.mock("../../services/db", () => ({ getPrisma: () => db.client }));

let client: PrismaClient;
let folder: string;

// La FTS dérive son rowid du DÉBUT de l'identifiant : des débuts distincts.
let next = 1;
const newId = () => (next++).toString(16).padStart(4, "0").padEnd(32, "e");

function row(kind: IndexRow["kind"], name: string, extra: Partial<IndexRow> = {}): IndexRow {
  return {
    id: newId(), kind, name, sortName: name.toLowerCase(), albumId: null, albumName: null, albumArtist: null, artists: [],
    year: null, trackNumber: null, discNumber: null, durationMs: 200_000, recordingMbid: null, releaseMbid: null,
    releaseGroupMbid: null, artistMbid: null, format: null, sizeBytes: null, normalizationGain: null, imageTag: null,
    childCount: null, dateCreated: null, ...extra,
  };
}

/** Un artiste, ses albums et leurs titres. */
function discography(name: string, albums: number, perAlbum: number) {
  const artist = row("artist", name);
  const credit = [{ id: artist.id, name, mbid: null }];
  const albumRows = Array.from({ length: albums }, (_, a) => row("album", `${name} album ${a}`, { artists: credit, albumArtist: name }));
  const tracks = albumRows.flatMap((al) =>
    Array.from({ length: perAlbum }, (_, n) => row("track", `${al.name} — ${n}`, { albumId: al.id, albumName: al.name, artists: credit, trackNumber: n + 1 })),
  );
  return { artist, albums: albumRows, tracks };
}

const AIR = discography("Air", 4, 5);
const JUSTICE = discography("Justice", 2, 4);
const HIDDEN = discography("Caché", 3, 5);
const ALL: IndexRow[] = [AIR, JUSTICE, HIDDEN].flatMap((d) => [d.artist, ...d.albums, ...d.tracks]);

const view = (over: Partial<UserView> = {}): UserView => ({ userId: "u", access: { mode: "all", libraryId: "lib" }, favorites: new Set(), ...over });

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), "tentacle-music-foryou-"));
  const path = join(folder, "tentacle.db");
  applyCoreMigrations(path);
  client = await connectSqlitePrisma(path);
  db.client = client;
  await upsertRows(ALL, 1);
});

afterAll(async () => {
  await closeSqlitePrisma(client);
  rmSync(folder, { recursive: true, force: true });
});

beforeEach(() => resetForYouCacheForTests());

describe("« pour vous » de l'accueil", () => {
  it("albums et artistes du moment, dans l'ordre des écoutes, une fois chacun", async () => {
    const recent = [AIR.tracks[0]!, AIR.tracks[1]!, JUSTICE.tracks[0]!, AIR.tracks[7]!];
    const out = await forYouView(view(), { recent, most: [], day: "2026-10-26" });
    expect(out.recentAlbums.map((a) => a.jellyfinId)).toEqual([AIR.albums[0]!.id, JUSTICE.albums[0]!.id, AIR.albums[1]!.id]);
    expect(out.recentArtists.map((a) => a.name)).toEqual(["Air", "Justice"]);
  });

  it("un mix par artiste qui compte, avec ses voisins ; un mix des cœurs dès cinq titres aimés", async () => {
    const recent = [...AIR.tracks.slice(0, 6), JUSTICE.tracks[0]!];
    const favorites = new Set(JUSTICE.tracks.slice(0, 5).map((t) => t.id));
    const out = await forYouView(view({ favorites }), { recent, most: [], day: "2026-10-26" });
    const air = out.mixes.find((m) => m.id === `artist:${AIR.artist.id}`);
    expect(air?.artist?.name).toBe("Air");
    expect(air?.tracks.length).toBeGreaterThan(10);
    expect(air?.tracks.some((t) => t.artists[0]?.name === "Justice")).toBe(true);
    expect(air?.artistNames[0]).toBe("Air");
    expect(out.mixes.find((m) => m.kind === "favorites")?.tracks).toHaveLength(5);
  });

  it("le mix est le même toute la journée, un autre le lendemain", async () => {
    const recent = AIR.tracks.slice(0, 3);
    const a = await forYouView(view(), { recent, most: [], day: "2026-10-26" });
    resetForYouCacheForTests();
    const b = await forYouView(view(), { recent, most: [], day: "2026-10-26" });
    resetForYouCacheForTests();
    const c = await forYouView(view(), { recent, most: [], day: "2026-10-27" });
    const keys = (x: typeof a) => x.mixes[0]?.tracks.map((t) => t.key);
    expect(keys(a)).toEqual(keys(b));
    expect(keys(a)).not.toEqual(keys(c));
  });

  it("« parce que vous avez écouté » : les autres albums de l'artiste, jamais ceux écoutés à l'instant", async () => {
    const out = await forYouView(view(), { recent: [AIR.tracks[0]!], most: [], day: "2026-10-26" });
    const because = out.because.find((b) => b.artist.name === "Air");
    expect(because?.albums.map((a) => a.jellyfinId).sort()).toEqual(AIR.albums.slice(1).map((a) => a.id).sort());
    // Justice n'a que deux albums : un écouté, un seul reste — pas assez pour une rangée.
    const justice = await forYouView(view(), { recent: [JUSTICE.tracks[0]!], most: [], day: "2026-10-26" });
    expect(justice.because).toEqual([]);
  });

  it("un compte restreint ne voit rien de ce qu'il n'a pas le droit de voir", async () => {
    const visible = new Set([AIR, JUSTICE].flatMap((d) => [d.artist, ...d.albums, ...d.tracks].map((r) => r.id)));
    const restricted = view({ access: { mode: "some", libraryId: "lib", visible } });
    // Même si l'historique en parle (il ne devrait pas), un artiste caché n'apparaît nulle part.
    const recent = [HIDDEN.tracks[0]!, AIR.tracks[0]!];
    const out = await forYouView(restricted, { recent, most: [], day: "2026-10-26" });
    const json = JSON.stringify(out);
    for (const r of [HIDDEN.artist, ...HIDDEN.albums, ...HIDDEN.tracks]) expect(json).not.toContain(r.id);
    expect(out.recentArtists.map((a) => a.name)).toEqual(["Air"]);
  });

  it("un compte sans écoute ni cœur : tout est vide, sans erreur", async () => {
    expect(await forYouView(view(), { recent: [], most: [], day: "2026-10-26" })).toEqual({ recentAlbums: [], recentArtists: [], mixes: [], because: [] });
  });
});
