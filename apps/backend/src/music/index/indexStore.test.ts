/**
 * L'index de la musique sur un VRAI fichier SQLite, migré par les migrations
 * commitées (0012 comprise) et lu par Prisma comme en service : écriture par
 * lots, recherche FTS5 (accents, ligatures, préfixes), retraits, générations.
 */

import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCoreMigrations } from "../../services/database/migrator";
import { closeSqlitePrisma, connectSqlitePrisma } from "../../services/database/prismaClient";
import type { IndexRow } from "./indexTypes";
import { currentGeneration, dropOlderThan, removeRows, saveReplayGain, upsertRows } from "./indexStore";
import { albumTracks, countsByKind, creditedTo, orderedIds, replayGainJsonOf, rowById, searchIndex, tracksByRecording } from "./indexQueries";
import { ftsMatchExpression } from "./searchQuery";
import { fillArtistMbids } from "./artistMbids";

const db = vi.hoisted(() => ({ client: null as unknown as PrismaClient }));
let client: PrismaClient;
let folder: string;

vi.mock("../../services/db", () => ({ getPrisma: () => db.client }));

function row(id: string, kind: IndexRow["kind"], name: string, extra: Partial<IndexRow> = {}): IndexRow {
  return {
    id, kind, name, sortName: name.toLowerCase(), albumId: null, albumName: null, albumArtist: null, artists: [],
    year: null, trackNumber: null, discNumber: null, durationMs: null, recordingMbid: null, releaseMbid: null,
    releaseGroupMbid: null, artistMbid: null, format: null, sizeBytes: null, normalizationGain: null, imageTag: null,
    childCount: null, dateCreated: null, ...extra,
  };
}

const ARTIST = "a".repeat(32);
const ALBUM = "b".repeat(32);
const ensemble = { id: ARTIST, name: "Ensemble Témoin", mbid: "0c7a0e00-0000-4000-8000-0000000000a2" };
const ROWS: IndexRow[] = [
  row(ARTIST, "artist", "Ensemble Témoin", { artists: [{ id: ARTIST, name: "Ensemble Témoin", mbid: null }] }),
  row(ALBUM, "album", "Duos d'été", { artists: [ensemble], albumArtist: "Ensemble Témoin", year: 2025, dateCreated: 1_760_000_000_000 }),
  row("c".repeat(32), "track", "Été à Noël", { albumId: ALBUM, albumName: "Duos d'été", artists: [ensemble], trackNumber: 1, recordingMbid: "0c7a0e00-0000-4000-800d-000000000301", sizeBytes: 5_000_000_000 }),
  row("d".repeat(32), "track", "Œuvre crépusculaire", { albumId: ALBUM, albumName: "Duos d'été", artists: [ensemble], trackNumber: 3 }),
  row("e".repeat(32), "track", "Ça déménage", { albumId: ALBUM, albumName: "Duos d'été", artists: [ensemble], trackNumber: 2 }),
];

const search = async (q: string) => (await searchIndex(ftsMatchExpression(q)!, 20)).map((h) => h.id[0]);

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), "tentacle-music-index-"));
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

describe("index de la musique (SQLite + FTS5)", () => {
  it("relit ce qu'il a écrit (dates, gros entiers, JSON)", async () => {
    const track = await rowById("c".repeat(32));
    expect(track?.sizeBytes).toBe(5_000_000_000);
    expect(track?.artists[0]?.name).toBe("Ensemble Témoin");
    expect((await rowById(ALBUM))?.dateCreated).toBe(1_760_000_000_000);
    expect(await countsByKind()).toEqual({ track: 3, album: 1, artist: 1 });
  });

  it("cherche sans accents, ligatures pliées, par préfixes", async () => {
    expect(await search("ete noel")).toEqual(["c"]);
    expect(await search("oeuvre")).toEqual(["d"]);
    expect(await search("ca dem")).toEqual(["e"]);
    // L'album de chaque titre est cherchable ; le nom pèse plus que l'album.
    expect((await search("duos"))[0]).toBe("b");
  });

  it("met à jour sans doublon dans la recherche", async () => {
    await upsertRows([{ ...ROWS[2]!, name: "Été à Paris" }], 1);
    expect(await search("noel")).toEqual([]);
    expect(await search("paris")).toEqual(["c"]);
  });

  it("retire des éléments, et ce qu'une génération complète n'a pas revu", async () => {
    expect(await removeRows(["d".repeat(32), "f".repeat(32)])).toEqual(["d".repeat(32)]);
    expect(await search("oeuvre")).toEqual([]);
    await upsertRows([ROWS[0]!, ROWS[1]!], 2);
    expect(await currentGeneration()).toBe(2);
    expect((await dropOlderThan(2)).sort()).toEqual(["c".repeat(32), "e".repeat(32)]);
    expect(await search("ete")).toEqual(["b"]);
  });

  it("ordonne un album, retrouve un enregistrement, les crédits d'un artiste", async () => {
    expect((await albumTracks(ALBUM)).map((r) => r.trackNumber)).toEqual([1, 2, 3]);
    expect((await tracksByRecording(["0c7a0e00-0000-4000-800d-000000000301"])).map((r) => r.id[0])).toEqual(["c"]);
    expect((await creditedTo(ARTIST, "album")).map((r) => r.id)).toEqual([ALBUM]);
    expect(await orderedIds("album", "recent")).toEqual([ALBUM]);
  });

  it("complète le MBID d'un artiste depuis les crédits", async () => {
    expect(await fillArtistMbids()).toBe(1);
    expect((await rowById(ARTIST))?.artistMbid).toBe("0c7a0e00-0000-4000-8000-0000000000a2");
  });

  it("garde la ReplayGain relue tant que le fichier ne change pas", async () => {
    await saveReplayGain("c".repeat(32), "{}");
    await upsertRows([ROWS[2]!], 1);
    expect(await replayGainJsonOf("c".repeat(32))).toBe("{}");
    await upsertRows([{ ...ROWS[2]!, sizeBytes: 42 }], 1);
    expect(await replayGainJsonOf("c".repeat(32))).toBeNull();
  });
});
