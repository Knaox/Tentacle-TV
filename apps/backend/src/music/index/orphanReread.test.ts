/**
 * La relecture des titres sans album face à un Jellyfin SIMULÉ et un VRAI index SQLite : seuls les titres sans
 * album sont relus (tags remplacés), leur dossier d'album récursivement, une seule fois par semaine ; Jellyfin
 * muet ne casse rien. Jamais un redémarrage, jamais toute la bibliothèque.
 */

import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCoreMigrations } from "../../services/database/migrator";
import { closeSqlitePrisma, connectSqlitePrisma } from "../../services/database/prismaClient";
import type { IndexRow } from "./indexTypes";
import { upsertRows } from "./indexStore";
import { ORPHAN_REREAD_KEY, rereadOrphans } from "./orphanReread";

const db = vi.hoisted(() => ({ client: null as unknown as PrismaClient }));
const jf = vi.hoisted(() => ({ calls: [] as string[], paths: new Map<string, string>(), folders: new Map<string, { parent: string; path: string }>(), mute: false }));

vi.mock("../../services/db", () => ({ getPrisma: () => db.client }));
vi.mock("../jellyfin/musicLibrary", () => ({ getMusicLibrary: async () => ({ libraryId: "lib", name: "Musique", paths: ["/music"] }) }));
vi.mock("../../services/jellyfinLibrary", () => ({ adminUserParam: async () => "&userId=admin" }));
vi.mock("../jellyfin/musicJellyfin", async (original) => ({
  ...(await original<typeof import("../jellyfin/musicJellyfin")>()),
  jfAdmin: async (path: string) => {
    if (jf.mute) return { ok: false, failure: "unreachable" };
    const url = new URL(`http://jf${path}`);
    const ids = url.searchParams.get("Ids");
    if (ids) return { ok: true, data: { Items: ids.split(",").flatMap((Id) => (jf.paths.has(Id) ? [{ Id, Path: jf.paths.get(Id) }] : [])) } };
    const parent = url.searchParams.get("ParentId");
    return { ok: true, data: { Items: [...jf.folders].filter(([, f]) => f.parent === parent).map(([Id, f]) => ({ Id, Path: f.path, IsFolder: true })) } };
  },
  jfWrite: async (path: string, method: string) => {
    jf.calls.push(`${method} ${path}`);
    return { ok: !jf.mute };
  },
}));

let folder: string;
let client: PrismaClient;
const NOW = 1_800_000_000_000;
const [SHOUT, MOTHERS, LINKED, ALBUM] = ["a".repeat(32), "b".repeat(32), "c".repeat(32), "d".repeat(32)];

function track(id: string, name: string, albumId: string | null): IndexRow {
  return {
    id, kind: "track", name, sortName: name.toLowerCase(), albumId, albumName: albumId ? "Songs From the Big Chair" : null, albumArtist: null,
    artists: [], year: null, trackNumber: null, discNumber: null, durationMs: null, recordingMbid: null, releaseMbid: null,
    releaseGroupMbid: null, artistMbid: null, format: null, sizeBytes: null, normalizationGain: null, imageTag: null, childCount: null,
    dateCreated: NOW,
  };
}

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), "tentacle-orphan-reread-"));
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
  await client.serverConfig.deleteMany({ where: { key: ORPHAN_REREAD_KEY } });
  const { setConfigValue } = await import("../../services/configStore");
  await setConfigValue(ORPHAN_REREAD_KEY, "{}");
  Object.assign(jf, { calls: [], mute: false });
  jf.folders = new Map([
    ["artist", { parent: "lib", path: "/music/Tears for Fears" }],
    ["chair", { parent: "artist", path: "/music/Tears for Fears/Songs From the Big Chair (1985)" }],
  ]);
  jf.paths = new Map([
    [SHOUT, "/music/Tears for Fears/Songs From the Big Chair (1985)/01 - Shout.flac"],
    [MOTHERS, "/music/Tears for Fears/Songs From the Big Chair (1985)/08 - Listen.flac"],
  ]);
  await upsertRows([track(SHOUT, "01 - Shout", null), track(MOTHERS, "08 - Listen", null), track(LINKED, "Mothers Talk", ALBUM)], 1);
});

describe("relecture des titres sans album", () => {
  it("les titres sans album sont relus (tags remplacés), leur dossier d'album une fois, récursivement", async () => {
    const report = await rereadOrphans(() => NOW);
    expect(report).toEqual({ orphans: 2, items: 2, folders: 1, more: false });
    expect(jf.calls.filter((c) => c.includes("ReplaceAllMetadata=true"))).toHaveLength(2);
    expect(jf.calls.some((c) => c.includes(LINKED))).toBe(false);
    expect(jf.calls).toContain("POST /Items/chair/Refresh?Recursive=true&MetadataRefreshMode=Default&ImageRefreshMode=Default&ReplaceAllMetadata=false&ReplaceAllImages=false");
    expect(jf.calls.some((c) => c.includes("/Library/Refresh") || c.includes("/System/Restart") || c.includes("/Items/lib/"))).toBe(false);
  });

  it("un second passage la même semaine ne relit rien ; un titre qui a retrouvé son album est oublié", async () => {
    await rereadOrphans(() => NOW);
    jf.calls = [];
    await upsertRows([track(SHOUT, "Shout", ALBUM)], 1);
    expect(await rereadOrphans(() => NOW + 60_000)).toEqual({ orphans: 1, items: 0, folders: 0, more: false });
    expect(jf.calls).toEqual([]);
    const { getConfigValue } = await import("../../services/configStore");
    expect(Object.keys(JSON.parse(getConfigValue(ORPHAN_REREAD_KEY)!))).toEqual([MOTHERS]);
  });

  it("Jellyfin muet : rien ne casse, l'essai est noté (pas de rafale au retour)", async () => {
    jf.mute = true;
    expect(await rereadOrphans(() => NOW)).toEqual({ orphans: 2, items: 0, folders: 0, more: false });
  });

  it("un arriéré se relit par vagues : un passage dit qu'il en reste", async () => {
    await upsertRows(Array.from({ length: 30 }, (_, i) => track(i.toString(16).padStart(2, "0").padEnd(32, "e"), `piste ${i}`, null)), 1);
    const report = await rereadOrphans(() => NOW);
    expect(report?.items).toBe(25);
    expect(report?.more).toBe(true);
    expect((await rereadOrphans(() => NOW + 1))?.more).toBe(false);
  });
});
