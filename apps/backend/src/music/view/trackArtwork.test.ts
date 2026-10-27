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

  const ARTIST = "c".repeat(32);
  const credit = [{ id: ARTIST, name: "Tears for Fears", mbid: null }];

  it("album sans image : l'image de l'artiste (avant : la case neutre)", async () => {
    await upsertRows([row(ALBUM, "album", "Songs From the Big Chair"), row(ARTIST, "artist", "Tears for Fears", { imageTag: `${ARTIST}/face` })], 1);
    const [track] = await tracksOf(view, [row(TRACK, "track", "Shout", { albumId: ALBUM, albumName: "Songs From the Big Chair", artists: credit })]);
    expect(track?.artworkUrl).toContain(ARTIST);
    expect(track?.album?.jellyfinId).toBe(ALBUM);
  });

  it("titre sans album (lu avant ses tags) : l'image de l'artiste, et pas d'album inventé", async () => {
    await upsertRows([row(ARTIST, "artist", "Tears for Fears", { imageTag: `${ARTIST}/face` })], 1);
    const [track] = await tracksOf(view, [row(TRACK, "track", "01 - Shout", { artists: credit })]);
    expect(track?.artworkUrl).toContain("tag=face");
    expect(track?.album).toBeNull();
  });

  it("un AlbumId sans nom d'album : le nom de l'album indexé, et son lien", async () => {
    await upsertRows([row(ALBUM, "album", "Songs From the Big Chair", { imageTag: `${ALBUM}/tag1` })], 1);
    const [track] = await tracksOf(view, [row(TRACK, "track", "Shout", { albumId: ALBUM })]);
    expect(track?.album).toEqual({ title: "Songs From the Big Chair", mbid: null, jellyfinId: ALBUM });
    expect(track?.artworkUrl).toContain("tag=tag1");
  });

  it("ni titre, ni album, ni artiste avec une image : rien (le client dessine son repli neutre)", async () => {
    await upsertRows([row(ALBUM, "album", "X"), row(ARTIST, "artist", "Y")], 1);
    const [track] = await tracksOf(view, [row(TRACK, "track", "Z", { albumId: ALBUM, albumName: "X", artists: [{ id: ARTIST, name: "Y", mbid: null }] })]);
    expect(track?.artworkUrl).toBeNull();
  });
});
