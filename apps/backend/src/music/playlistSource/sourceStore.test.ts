/**
 * Le relevé de l'ordre de la source, VRAIE base SQLite (migrations du cœur) : gardé, relu, remplacé, effacé.
 */

import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { applyCoreMigrations } from "../../services/database/migrator";
import { closeSqlitePrisma, connectSqlitePrisma } from "../../services/database/prismaClient";
import { forgetPlaylistSource, readPlaylistSource, savePlaylistSource } from "./sourceStore";
import { bound, type PlaylistSourceRecord } from "./sourceRecord";

const db = vi.hoisted(() => ({ client: null as unknown as PrismaClient }));
vi.mock("../../services/db", () => ({ getPrisma: () => db.client }));

let folder: string;
let client: PrismaClient;
const PLAYLIST = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const ITEM = "11111111111111111111111111111111";

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), "tentacle-playlist-source-"));
  const path = join(folder, "tentacle.db");
  applyCoreMigrations(path);
  client = await connectSqlitePrisma(path);
  db.client = client;
});
afterAll(async () => {
  await closeSqlitePrisma(client);
  rmSync(folder, { recursive: true, force: true });
});

const record: PlaylistSourceRecord = {
  playlistId: PLAYLIST,
  userId: "u1",
  source: "apple",
  url: "https://music.apple.com/fr/playlist/new/pl.u-new0000000000000",
  origin: "import",
  importedAt: 1_793_000_000_000,
  slots: [
    { rank: 0, title: "Premier titre", artists: ["Artiste A"], album: "Premier album", durationMs: 242_265, itemIds: [] },
    { rank: 1, title: "Second titre", artists: ["Artiste B"], album: null, durationMs: null, itemIds: [ITEM] },
  ],
};

describe("relevé de l'ordre de la source", () => {
  it("gardé puis relu tel quel ; une liaison de plus le remplace ; effacé avec la playlist", async () => {
    await savePlaylistSource(record);
    expect(await readPlaylistSource(PLAYLIST.toUpperCase())).toEqual(record);
    const next = bound(record, 0, ["22222222222222222222222222222222"]);
    await savePlaylistSource({ ...next, origin: "repair" });
    const read = await readPlaylistSource(PLAYLIST);
    expect(read?.origin).toBe("repair");
    expect(read?.slots[0]?.itemIds).toEqual(["22222222222222222222222222222222"]);
    await forgetPlaylistSource(PLAYLIST);
    expect(await readPlaylistSource(PLAYLIST)).toBeNull();
  });
});
