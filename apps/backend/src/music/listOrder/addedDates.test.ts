/**
 * Les dates d'entrée d'une playlist, VRAIE base SQLite : la portée d'avant le 27/10 (qui datait « maintenant »
 * chaque arrivée de Lidarr) est oubliée à la première lecture, et une arrivée posée à sa place garde la date
 * de sa place.
 */

import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCoreMigrations } from "../../services/database/migrator";
import { closeSqlitePrisma, connectSqlitePrisma } from "../../services/database/prismaClient";
import { addedDatesFor, legacyPlaylistScope, noteArrival, playlistScope } from "./addedDates";

const db = vi.hoisted(() => ({ client: null as unknown as PrismaClient }));
vi.mock("../../services/db", () => ({ getPrisma: () => db.client }));

let folder: string;
let client: PrismaClient;
const PLAYLIST = "016730ba".padEnd(32, "0");
const options = { ordered: true, legacyScope: legacyPlaylistScope(PLAYLIST) };

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), "tentacle-added-dates-"));
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
  await client.$executeRawUnsafe(`DELETE FROM "music_list_added"`);
});

describe("dates d'entrée d'une playlist", () => {
  it("la portée d'avant est oubliée : la première lecture repart de l'ordre de la playlist", async () => {
    const legacy = legacyPlaylistScope(PLAYLIST);
    // Avant : x, arrivé de Lidarr le dernier, daté le plus récent alors qu'il est au milieu.
    for (const [itemId, addedAt] of [["a", 1], ["x", 9_999], ["b", 2]] as const)
      await client.musicListAdded.create({ data: { scope: legacy, itemId, addedAt: new Date(addedAt) } });
    const dates = await addedDatesFor(playlistScope(PLAYLIST), ["a", "x", "b"], undefined, options);
    expect(dates.get("a")!).toBeLessThan(dates.get("x")!);
    expect(dates.get("x")!).toBeLessThan(dates.get("b")!);
    expect(await client.musicListAdded.count({ where: { scope: legacy } })).toBe(0);
    expect(await client.musicListAdded.count({ where: { scope: playlistScope(PLAYLIST) } })).toBe(3);
  });

  it("une arrivée posée au milieu, lue ensuite, prend la date de sa place et la garde", async () => {
    const scope = playlistScope(PLAYLIST);
    const first = await addedDatesFor(scope, ["a", "b", "c"], undefined, options);
    const later = await addedDatesFor(scope, ["a", "x", "b", "c", "n"], undefined, options);
    expect(later.get("x")).toBe(first.get("a"));
    expect(later.get("n")!).toBeGreaterThan(first.get("c")!);
    const again = await addedDatesFor(scope, ["a", "x", "b", "c", "n"], undefined, options);
    expect(again).toEqual(later);
  });

  it("les likés gardent leur portée et leur règle", async () => {
    const dates = await addedDatesFor("liked:u", ["a", "b"], () => 5);
    expect(dates.get("a")).toBe(5);
  });

  it("une playlist importée : la date du rang dans la source remplace celle estimée d'après l'ordre faux, et se garde", async () => {
    const scope = playlistScope(PLAYLIST);
    await addedDatesFor(scope, ["c", "a", "b"], undefined, options);
    const pinned = new Map([["a", 100], ["b", 101], ["c", 102]]);
    const dates = await addedDatesFor(scope, ["c", "a", "b"], undefined, { ...options, pinned });
    expect([...dates]).toEqual([["c", 102], ["a", 100], ["b", 101]]);
    const rows = await client.musicListAdded.findMany({ where: { scope }, orderBy: { addedAt: "asc" } });
    expect(rows.map((r) => [r.itemId, r.addedAt.getTime()])).toEqual([["a", 100], ["b", 101], ["c", 102]]);
  });

  it("une arrivée de l'extension en FIN de playlist garde la date de sa place à la lecture suivante (lot fl)", async () => {
    const scope = playlistScope(PLAYLIST);
    const first = await addedDatesFor(scope, ["a", "b"], undefined, options);
    await noteArrival(PLAYLIST, ["a", "b"], ["x"], 2);
    const later = await addedDatesFor(scope, ["a", "b", "x"], undefined, options);
    expect(later.get("x")).toBe(first.get("b"));
  });
});
