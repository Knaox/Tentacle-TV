/**
 * Un import MIXTE contre un VRAI index SQLite (migrations commitées, FTS5) : la playlist Apple Music « New » de
 * Damien (26/10), page FRANÇAISE (`__fixtures__/apple-playlist-new-fr.html`, titres et durées de l'iTunes Search).
 * Ce que la bibliothèque a entre dans la playlist Jellyfin, dans le BON album ; le reste part aux absents avec sa
 * place. Avant : « Ma Meilleure Ennemie (extrait de la série …) » restait absente (mention traduite), « BIRDS OF A
 * FEATHER » aussi (3,7 s d'écart), « lovely » pouvait tomber hors des 40 premiers candidats et prenait l'album le
 * plus proche en durée, pas celui de la source.
 */

import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCoreMigrations } from "../../services/database/migrator";
import { closeSqlitePrisma, connectSqlitePrisma } from "../../services/database/prismaClient";
import type { IndexRow } from "../index/indexTypes";
import { upsertRows } from "../index/indexStore";
import type { UserView } from "../view/viewContext";
import { explainAbsent } from "./importDiagnosis";
import { getImport, resetImportsForTests, startImport, type ImportDeps } from "./importJobs";

const db = vi.hoisted(() => ({ client: null as unknown as PrismaClient }));
vi.mock("../../services/db", () => ({ getPrisma: () => db.client }));

let client: PrismaClient;
let folder: string;

// La FTS dérive son rowid du DÉBUT de l'identifiant : des débuts distincts.
const id = (n: number) => n.toString(16).padStart(4, "0").padEnd(32, "c");
const artist = (name: string) => ({ id: null, name, mbid: null });

function track(n: number, name: string, artists: string[], durationMs: number, albumName: string, extra: Partial<IndexRow> = {}): IndexRow {
  return {
    id: id(n), kind: "track", name, sortName: name.toLowerCase(), albumId: null, albumName, albumArtist: artists[0] ?? null, artists: artists.map(artist),
    year: null, trackNumber: null, discNumber: null, durationMs, recordingMbid: null, releaseMbid: null,
    releaseGroupMbid: null, artistMbid: null, format: null, sizeBytes: null, normalizationGain: null, imageTag: null,
    childCount: null, dateCreated: null, ...extra,
  } as IndexRow;
}

const HMHAS = "HIT ME HARD AND SOFT";
const BIRDS = track(0x101, "BIRDS OF A FEATHER", ["Billie Eilish"], 214_100, HMHAS);
const ENNEMIE = track(0x102, "Ma meilleure ennemie", ["Stromae & Pomme"], 148_000, "Arcane League of Legends: Season 2", { albumArtist: "Arcane & League of Legends" });
const LOVELY_SINGLE = track(0x103, "lovely", ["Billie Eilish & Khalid"], 200_187, "lovely");
const LOVELY_OST = track(0x104, "lovely", ["Various Artists"], 200_190, "13 Reasons Why (Season 2)", { albumArtist: "Various Artists" });
const LOVELY_ALBUM = track(0x105, "lovely", ["Billie Eilish", "Khalid"], 200_900, "dont smile at me (Expanded Edition)");
const AMOUR = track(0x106, "L'AMOUR DE MA VIE", ["Billie Eilish"], 334_000, HMHAS);
const WILDFLOWER = track(0x107, "WILDFLOWER", ["Billie Eilish"], 261_467, HMHAS);
// Les homonymes : un autre « The Line », et 45 titres qui portent « lovely » — plus que les 40 candidats lus.
const OTHER_LINE = track(0x108, "The Line", ["Autre Groupe"], 215_000, "Ailleurs");
const LOVELY_CROWD = Array.from({ length: 45 }, (_, i) => track(0x10 + i, `Lovely Day ${i + 1}`, [`Interprète ${i + 1}`], 180_000 + i, `Recueil ${i + 1}`));
const ROWS = [...LOVELY_CROWD, BIRDS, ENNEMIE, LOVELY_SINGLE, LOVELY_OST, LOVELY_ALBUM, AMOUR, WILDFLOWER, OTHER_LINE];

const APPLE_NEW = readFileSync(join(__dirname, "__fixtures__/apple-playlist-new-fr.html"), "utf8");
const everyone: UserView = { userId: "u1", access: { mode: "all", libraryId: "lib" }, favorites: new Set() };

function deps(): ImportDeps & { created: string[][] } {
  const created: string[][] = [];
  return {
    created,
    fetcher: async (url) => ({ status: 200, url, body: APPLE_NEW }),
    view: async () => everyone,
    create: async (_userId, _name, ids) => {
      created.push(ids);
      return { ok: true, value: "pl-new" };
    },
  };
}

const appleUrl = "https://music.apple.com/fr/playlist/new/pl.u-new0000000000000";

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), "tentacle-music-import-"));
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
  resetImportsForTests();
  await client.$executeRawUnsafe(`DELETE FROM "music_items"`);
  await client.$executeRawUnsafe(`DELETE FROM "music_fts"`);
  await upsertRows(ROWS, 1);
});

async function importNew() {
  const d = deps();
  const started = startImport("u1", { input: { kind: "url", url: { source: "apple", kind: "playlist", id: "pl.u-new0000000000000", url: appleUrl } }, name: null, keepEmpty: false }, d);
  if (!started.ok) throw new Error("import refusé");
  await started.done;
  return { job: getImport("u1", started.jobId)!, created: d.created };
}

describe("import Apple Music (page FR) contre la bibliothèque", () => {
  it("les titres présents entrent dans la playlist Jellyfin, chacun dans le BON album, dans l'ordre de la source", async () => {
    const { job, created } = await importNew();
    expect(job.stage).toBe("done");
    expect(created).toEqual([[BIRDS.id, ENNEMIE.id, LOVELY_ALBUM.id, AMOUR.id, WILDFLOWER.id]]);
    expect(job.result).toMatchObject({ total: 7, added: 5 });
  });

  it("les absents (hors bibliothèque, ou une AUTRE version) gardent leur place, rien de plus", async () => {
    const { job } = await importNew();
    expect(job.result?.absent.map((t) => [t.title, t.position])).toEqual([
      ["The Line", 2],
      ["Ma Meilleure Ennemie (feat. Elyanna, Arcane & League of Legends Music)", 4],
    ]);
  });

  it("l'album de la source quand il est dans la bibliothèque : la bande originale (recueil « Various Artists »)", async () => {
    const page = APPLE_NEW.replace('"dont smile at me"', '"13 Reasons Why (Season 2)"');
    const d = { ...deps(), fetcher: async (url: string) => ({ status: 200, url, body: page }) };
    const started = startImport("u1", { input: { kind: "url", url: { source: "apple", kind: "playlist", id: "pl.u-new0000000000000", url: appleUrl } }, name: null, keepEmpty: false }, d);
    if (!started.ok) throw new Error("import refusé");
    await started.done;
    expect(d.created[0]?.[2]).toBe(LOVELY_OST.id);
  });

  it("source sans album connu de la bibliothèque : l'album de l'artiste, jamais le recueil", async () => {
    const page = APPLE_NEW.replace('"dont smile at me"', '"Billboard Hits 2018"');
    const d = { ...deps(), fetcher: async (url: string) => ({ status: 200, url, body: page }) };
    const started = startImport("u1", { input: { kind: "url", url: { source: "apple", kind: "playlist", id: "pl.u-new0000000000000", url: appleUrl } }, name: null, keepEmpty: false }, d);
    if (!started.ok) throw new Error("import refusé");
    await started.done;
    expect([LOVELY_SINGLE.id, LOVELY_ALBUM.id]).toContain(d.created[0]?.[2]);
  });
});

describe("le journal dit pourquoi un absent n'a pas été reconnu", () => {
  it("« Ma Meilleure Ennemie » avec Coldplay (3:22) face à l'original (2:28) : autre durée, donc une autre version", async () => {
    const coldplay = { index: 5, position: 4, title: "Ma Meilleure Ennemie (feat. Elyanna, Arcane & League of Legends Music)", artists: ["Stromae", "Pomme", "Coldplay"], album: null, durationMs: 201_933, isrc: null, sourceId: null };
    const line = (await explainAbsent(everyone, [coldplay]))[0];
    expect(line).toBe(
      "[music-import] « Ma Meilleure Ennemie (feat. Elyanna, Arcane & League of Legends Music) » (Stromae, Pomme, Coldplay · 3:22) : la bibliothèque a « Ma meilleure ennemie » (Stromae & Pomme · 2:28 · Arcane League of Legends: Season 2) — autre durée, donc une autre version, laissé hors bibliothèque",
    );
  });

  it("un homonyme d'un autre artiste : dit « autre artiste » ; un titre que la bibliothèque n'a pas du tout : rien", async () => {
    const line = await explainAbsent(everyone, [{ index: 2, title: "The Line", artists: ["Twenty One Pilots"], album: null, durationMs: 215_000, isrc: null, sourceId: null }]);
    expect(line[0]).toContain("— autre artiste, laissé hors bibliothèque");
    expect(await explainAbsent(everyone, [{ index: 0, title: "Jamais Vu", artists: ["Personne"], album: null, durationMs: 1_000, isrc: null, sourceId: null }])).toEqual([]);
  });
});
