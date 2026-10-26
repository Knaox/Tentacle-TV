/**
 * La pochette d'un titre de la bibliothèque suit Jellyfin (Damien, 26/10) : un titre ajouté hors bibliothèque, rangé
 * SANS image (ni la sienne, ni encore celle de son album), puis l'album reçoit sa pochette — l'index ne réécrit que
 * l'album. La vue la lit sur l'album : l'image arrive, sans réindexer le titre. VRAI index SQLite.
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
import { tracksOf, type UserView } from "./viewContext";

const db = vi.hoisted(() => ({ client: null as unknown as PrismaClient }));
vi.mock("../../services/db", () => ({ getPrisma: () => db.client }));

let folder: string;
let client: PrismaClient;
const ALBUM = "a".repeat(32);
const TRACK = "b".repeat(32);
const view: UserView = { userId: "u", access: { mode: "all", libraryId: "lib" }, favorites: new Set() };

function row(id: string, kind: IndexRow["kind"], name: string, extra: Partial<IndexRow> = {}): IndexRow {
  return {
    id, kind, name, sortName: name.toLowerCase(), albumId: null, albumName: null, albumArtist: null, artists: [],
    year: null, trackNumber: null, discNumber: null, durationMs: null, recordingMbid: null, releaseMbid: null,
    releaseGroupMbid: null, artistMbid: null, format: null, sizeBytes: null, normalizationGain: null, imageTag: null,
    childCount: null, dateCreated: null, ...extra,
  };
}

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), "tentacle-track-artwork-"));
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
});

describe("tracksOf — la pochette suit l'album", () => {
  it("titre rangé sans image, l'album la reçoit ensuite : le titre la montre (avant : aucune image)", async () => {
    await upsertRows([row(ALBUM, "album", "Evolve"), row(TRACK, "track", "Next to Me", { albumId: ALBUM, albumName: "Evolve" })], 1);
    expect((await tracksOf(view, [row(TRACK, "track", "Next to Me", { albumId: ALBUM, albumName: "Evolve" })]))[0]?.artworkUrl).toBeNull();
    // Jellyfin a récupéré la pochette de l'album : seule SA rangée change.
    await upsertRows([row(ALBUM, "album", "Evolve", { imageTag: `${ALBUM}/tag1` })], 2);
    const [track] = await tracksOf(view, [row(TRACK, "track", "Next to Me", { albumId: ALBUM, albumName: "Evolve" })]);
    expect(track?.artworkUrl).toContain(ALBUM);
    expect(track?.artworkUrl).toContain("tag=tag1");
  });

  it("un titre qui a SA pochette la garde", async () => {
    await upsertRows([row(ALBUM, "album", "Evolve", { imageTag: `${ALBUM}/tag1` })], 1);
    const [track] = await tracksOf(view, [row(TRACK, "track", "Next to Me", { albumId: ALBUM, imageTag: `${TRACK}/own` })]);
    expect(track?.artworkUrl).toContain("tag=own");
  });
});
