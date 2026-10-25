/**
 * Ce qui vient d'arriver, indexé sans attendre `LibraryChanged` : le dossier
 * rafraîchi relu jusqu'à ce que ses éléments neufs paraissent, et le filet
 * borné de `findByMbid` (dossiers récents + derniers ajouts, une fois par
 * seconde au plus).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { indexArrivalsUnder, lookupRecentArrivals, resetFolderArrivalsForTests, type ArrivalClock } from "./folderArrivals";

const { jf } = vi.hoisted(() => ({
  jf: {
    /** ParentId → éléments que Jellyfin y montre, selon le nombre de lectures déjà faites. */
    under: new Map<string, (reads: number) => string[]>(),
    recent: [] as string[],
    reads: 0,
    paths: [] as string[],
    indexed: new Set<string>(),
    applied: [] as string[][],
    told: 0,
  },
}));

vi.mock("../../services/jellyfinLibrary", () => ({ adminUserParam: async () => "&userId=admin" }));
vi.mock("../jellyfin/musicLibrary", () => ({ getMusicLibrary: async () => ({ libraryId: "lib", name: "Musique", paths: ["/music"] }) }));
vi.mock("../jellyfin/musicJellyfin", async (original) => ({
  ...(await original<typeof import("../jellyfin/musicJellyfin")>()),
  jfAdmin: async (path: string) => {
    jf.paths.push(path);
    const url = new URL(`http://jf${path}`);
    const parent = url.searchParams.get("ParentId")!;
    if (url.searchParams.get("SortBy") === "DateCreated") return { ok: true, data: { Items: jf.recent.map((Id) => ({ Id })) } };
    const list = jf.under.get(parent)?.(jf.reads++) ?? [];
    return { ok: true, data: { Items: list.map((Id) => ({ Id })) } };
  },
}));
vi.mock("../index/indexQueries", () => ({
  rowsByIds: async (ids: string[]) => new Map(ids.filter((id) => jf.indexed.has(id)).map((id) => [id, { id }])),
}));
vi.mock("../index/indexSync", () => ({
  applyLibraryChange: async (added: string[]) => {
    jf.applied.push(added);
    for (const id of added) jf.indexed.add(id);
    return { added: added.map((id) => ({ id })), updated: [], removed: [], addedRefs: [], updatedRefs: [], playlists: [], unresolved: [] };
  },
}));
vi.mock("./musicLiveEvents", () => ({
  runSerialized: (task: () => Promise<void>) => task(),
  tellLibrary: async () => {
    jf.told++;
  },
}));

function fakeClock(): ArrivalClock {
  let t = 0;
  return { now: () => t, sleep: async (ms) => { t += ms; } };
}

beforeEach(() => {
  resetFolderArrivalsForTests();
  jf.under.clear();
  jf.recent = [];
  jf.reads = 0;
  jf.paths.length = 0;
  jf.indexed = new Set(["old1", "old2"]);
  jf.applied.length = 0;
  jf.told = 0;
});

describe("indexer un dossier rafraîchi", () => {
  it("attend que ses éléments neufs paraissent ET ne bougent plus, puis indexe et annonce une fois", async () => {
    // Lectures : rien de neuf, un titre, l'album et deux titres, puis stable.
    jf.under.set("album", (n) => (n === 0 ? ["old1"] : n === 1 ? ["old1", "t1"] : ["old1", "alb", "t1", "t2"]));
    const result = await indexArrivalsUnder("album", fakeClock());
    expect(result?.added.map((r) => r.id)).toEqual(["alb", "t1", "t2"]);
    expect(jf.applied).toEqual([["alb", "t1", "t2"]]);
    expect(jf.told).toBe(1);
    expect(jf.paths.every((p) => p.includes("ParentId=album") && p.includes("Recursive=true") && p.includes("userId=admin"))).toBe(true);
  });

  it("rien de neuf : abandon au bout de 15 s, rien annoncé", async () => {
    jf.under.set("album", () => ["old1", "old2"]);
    expect(await indexArrivalsUnder("album", fakeClock())).toBeNull();
    expect(jf.applied).toEqual([]);
    expect(jf.told).toBe(0);
  });

  it("déjà indexé par LibraryChanged entre-temps : rien n'est redit", async () => {
    jf.under.set("album", (n) => {
      if (n === 1) jf.indexed.add("t1");
      return ["old1", "t1"];
    });
    expect(await indexArrivalsUnder("album", fakeClock())).toBeNull();
    expect(jf.told).toBe(0);
  });
});

describe("le filet de findByMbid", () => {
  it("relit les dossiers rafraîchis et les derniers ajouts, indexe l'inconnu", async () => {
    jf.under.set("album", () => ["old1"]);
    await indexArrivalsUnder("album", fakeClock());
    jf.under.set("album", () => ["old1", "t9"]);
    jf.recent = ["old2", "t8"];
    jf.paths.length = 0;
    await lookupRecentArrivals(10_000);
    expect(jf.applied.at(-1)?.sort()).toEqual(["t8", "t9"]);
    expect(jf.paths.some((p) => p.includes("SortBy=DateCreated") && p.includes("Limit=100"))).toBe(true);
  });

  it("une fois par seconde au plus ; les appels simultanés se rejoignent", async () => {
    jf.recent = ["t1"];
    await Promise.all([lookupRecentArrivals(20_000), lookupRecentArrivals(20_000)]);
    await lookupRecentArrivals(20_500);
    expect(jf.paths.length).toBe(1);
    await lookupRecentArrivals(21_100);
    expect(jf.paths.length).toBe(2);
  });
});
