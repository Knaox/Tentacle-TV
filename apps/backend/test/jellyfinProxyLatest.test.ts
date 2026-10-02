/**
 * La rangée « Derniers ajouts » telle que le proxy la rend : regroupée par
 * série en DEUX requêtes chez Jellyfin, gardée en cache comme les autres
 * rangées, les films intacts — et rendue au relais ordinaire au moindre accroc.
 *
 * Un vrai serveur HTTP local tient le rôle de Jellyfin : le proxy parle par
 * undici, pas par le `fetch` global qu'on pourrait remplacer.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const upstream = vi.hoisted(() => ({
  url: "",
  calls: [] as Array<{ path: string; query: URLSearchParams; authorization: string }>,
  /** Ce que rend l'inventaire : 200, ou un refus. */
  scanStatus: 200,
  /** La bibliothèque, du plus récent au plus ancien — servie par pages (`StartIndex`, `Limit`). */
  inventory: [] as Array<Record<string, unknown>>,
}));
vi.mock("../src/services/configStore", () => ({
  getJellyfinUrl: () => upstream.url,
  getJellyfinApiKey: () => "cle-admin",
}));
vi.mock("../src/services/jwt", () => ({
  verifyDeviceToken: async () => null,
  verifyImpersonationToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../src/services/db", () => ({
  hasPrisma: () => false,
  getPrisma: () => {
    throw new Error("no prisma in tests");
  },
}));
vi.mock("../src/services/wsManager", () => ({ broadcastToUser: () => {} }));

import { jellyfinProxyRoutes } from "../src/routes/jellyfinProxy";
import { clearAll, invalidateByCarousel } from "../src/services/jellyfinCache";

/** La bibliothèque de séries, du plus récent au plus ancien : A et B mêlées, une saison de C. */
const INVENTORY = [
  { Id: "C-s2", Type: "Season", SeriesId: "C", IndexNumber: 2, DateCreated: "2026-10-02T21:00:00Z" },
  { Id: "C-s2e2", Type: "Episode", SeriesId: "C", SeasonId: "C-s2", ParentIndexNumber: 2, IndexNumber: 2 },
  { Id: "C-s2e1", Type: "Episode", SeriesId: "C", SeasonId: "C-s2", ParentIndexNumber: 2, IndexNumber: 1 },
  { Id: "A-s1e3", Type: "Episode", SeriesId: "A", SeasonId: "A-s1", ParentIndexNumber: 1, IndexNumber: 3 },
  { Id: "B-s4e1", Type: "Episode", SeriesId: "B", SeasonId: "B-s4", ParentIndexNumber: 4, IndexNumber: 1 },
  { Id: "A-s1e2", Type: "Episode", SeriesId: "A", SeasonId: "A-s1", ParentIndexNumber: 1, IndexNumber: 2 },
];

const DTOS: Record<string, Record<string, unknown>> = {
  C: { Id: "C", Name: "Série C", Type: "Series", ImageTags: { Primary: "c" } },
  A: { Id: "A", Name: "Série A", Type: "Series", ImageTags: { Primary: "a" } },
  "B-s4e1": { Id: "B-s4e1", Name: "Pilote", Type: "Episode", SeriesId: "B", SeriesName: "Série B" },
};

const ROW = "ParentId=lib1&Recursive=true&IncludeItemTypes=Episode&SortBy=DateCreated&SortOrder=Descending"
  + "&Limit=100&Fields=PrimaryImageAspectRatio,SeriesName,SeriesId,ParentIndexNumber,IndexNumber,MediaSources"
  + "&EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1&EnableUserData=true";

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

let jellyfin: http.Server;
let app: FastifyInstance;
let base = "";

beforeAll(async () => {
  jellyfin = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://jellyfin.test");
    const authorization = String(req.headers.authorization ?? "");
    upstream.calls.push({ path: url.pathname, query: url.searchParams, authorization });
    if (!/Token="jeton-de-test-/.test(authorization)) return json(res, 401, {});
    if (url.pathname !== "/Items" || url.searchParams.get("userId") !== "u1") return json(res, 404, {});
    if (url.searchParams.get("Limit") === "500") {
      if (upstream.scanStatus !== 200) return json(res, upstream.scanStatus, {});
      const start = Number(url.searchParams.get("StartIndex") ?? 0);
      return json(res, 200, { Items: upstream.inventory.slice(start, start + 500) });
    }
    const ids = url.searchParams.get("Ids");
    // L'ordre de Jellyfin n'est pas celui de la rangée : rendu à l'envers.
    if (ids) {
      const dto = (id: string) => DTOS[id] ?? { Id: id, Name: `Série ${id}`, Type: "Series" };
      return json(res, 200, { Items: ids.split(",").reverse().map(dto) });
    }
    // Toute autre requête — le relais ordinaire : la réponse brute, reconnaissable.
    return json(res, 200, { Items: [{ Id: "brut", Type: "Episode" }], TotalRecordCount: 1 });
  });
  await new Promise<void>((resolve) => jellyfin.listen(0, "127.0.0.1", resolve));
  upstream.url = `http://127.0.0.1:${(jellyfin.address() as AddressInfo).port}`;

  app = Fastify();
  await app.register(jellyfinProxyRoutes, { prefix: "/api/jellyfin" });
  await app.listen({ port: 0, host: "127.0.0.1" });
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await app.close();
  jellyfin.closeAllConnections();
  await new Promise<void>((resolve) => jellyfin.close(() => resolve()));
});

beforeEach(() => {
  clearAll();
  upstream.calls = [];
  upstream.scanStatus = 200;
  upstream.inventory = INVENTORY;
});

/** Les pages d'inventaire lues pendant le test. */
const scanPages = () => upstream.calls.filter((c) => c.query.get("Limit") === "500").length;

/**
 * Une avalanche : `series` séries arrivées l'une après l'autre, chacune avec
 * ses `episodes` épisodes puis ses dossiers (saison, série), du plus récent
 * au plus ancien.
 */
function avalanche(series: number, episodes: number): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (let i = 0; i < series; i++) {
    const id = `S${i}`;
    out.push({ Id: `${id}-s1`, Type: "Season", SeriesId: id, IndexNumber: 1 }, { Id: id, Type: "Series" });
    for (let e = episodes; e >= 1; e--) {
      out.push({ Id: `${id}-e${e}`, Type: "Episode", SeriesId: id, SeasonId: `${id}-s1`, ParentIndexNumber: 1, IndexNumber: e });
    }
  }
  return out;
}

async function row(query: string, token = "jeton-de-test-a") {
  const res = await fetch(`${base}/api/jellyfin/Users/u1/Items?${query}`, { headers: { "X-Emby-Token": token } });
  const body = res.status === 200 ? ((await res.json()) as { Items: Array<Record<string, unknown>>; TotalRecordCount: number }) : null;
  return { status: res.status, cache: res.headers.get("x-tentacle-cache"), cacheControl: res.headers.get("cache-control"), body };
}

describe("GET /api/jellyfin/Users/{id}/Items — « Derniers ajouts » d'une bibliothèque de séries", () => {
  it("une carte par série, à la place de son dernier ajout, en deux requêtes chez Jellyfin", async () => {
    const res = await row(ROW);
    expect(res.status).toBe(200);
    expect(res.cache).toBe("MISS");
    expect(res.cacheControl).toBe("no-store");
    expect(res.body?.Items.map((i) => i.Id)).toEqual(["C", "A", "B-s4e1"]);
    expect(res.body?.TotalRecordCount).toBe(3);
    expect(res.body?.Items[0]).toMatchObject({
      Name: "Série C", RecentlyAddedCount: 2,
      LatestAdditions: { EpisodeCount: 2, SeasonNumbers: [2], NewSeasonNumbers: [2], NewSeries: false, LatestSeasonId: "C-s2" },
    });
    expect(res.body?.Items[1]).toMatchObject({ RecentlyAddedCount: 2, LatestAdditions: { EpisodeCount: 2, NewSeasonNumbers: [] } });
    // L'épisode seul de B reste l'épisode, sans champ ajouté.
    expect(res.body?.Items[2]).toEqual(DTOS["B-s4e1"]);

    expect(upstream.calls).toHaveLength(2);
    const [scan, details] = upstream.calls;
    expect(scan.query.get("IncludeItemTypes")).toBe("Episode,Season,Series");
    expect(scan.query.get("ParentId")).toBe("lib1");
    expect(details.query.get("Ids")).toBe("C,A,B-s4e1");
    expect(details.query.get("Fields")).toContain("MediaSources");
    // Le jeton du client, sous la seule forme que Jellyfin 12 accepte, aux deux appels.
    for (const call of upstream.calls) expect(call.authorization).toContain('Token="jeton-de-test-a"');
  });

  it("le second appel vient du cache ; un ajout l'invalide", async () => {
    await row(ROW, "jeton-de-test-b");
    const again = await row(ROW, "jeton-de-test-b");
    expect(again.cache).toBe("HIT");
    expect(again.cacheControl).toBe("no-store");
    expect(again.body?.Items.map((i) => i.Id)).toEqual(["C", "A", "B-s4e1"]);
    expect(upstream.calls).toHaveLength(2);

    invalidateByCarousel("recently_added");
    expect((await row(ROW, "jeton-de-test-b")).cache).toBe("MISS");
    expect(upstream.calls).toHaveLength(4);
  });

  it("les films partent tels quels, en une requête", async () => {
    const res = await row(ROW.replace("IncludeItemTypes=Episode", "IncludeItemTypes=Movie").replace("Limit=100", "Limit=16"));
    expect(res.body?.Items.map((i) => i.Id)).toEqual(["brut"]);
    expect(upstream.calls).toHaveLength(1);
    expect(upstream.calls[0].query.get("IncludeItemTypes")).toBe("Movie");
    expect(upstream.calls[0].query.get("Limit")).toBe("16");
  });

  it("l'inventaire refusé : le relais ordinaire reprend la requête d'origine", async () => {
    upstream.scanStatus = 500;
    const res = await row(ROW);
    expect(res.body?.Items.map((i) => i.Id)).toEqual(["brut"]);
    expect(upstream.calls).toHaveLength(2);
    expect(upstream.calls[1].query.get("Limit")).toBe("100");
    expect(upstream.calls[1].query.get("IncludeItemTypes")).toBe("Episode");
  });

  it("avalanche : vingt séries de vingt épisodes font vingt cartes, en une page d'inventaire", async () => {
    upstream.inventory = avalanche(20, 20);
    const res = await row(ROW);
    expect(res.body?.Items).toHaveLength(20);
    expect(res.body?.Items.every((i) => (i.LatestAdditions as { EpisodeCount: number }).EpisodeCount === 20)).toBe(true);
    expect(scanPages()).toBe(1);
    expect(upstream.calls).toHaveLength(2);
  });

  it("des séries plus grosses : une page de plus, jusqu'aux vingt cartes", async () => {
    upstream.inventory = avalanche(20, 30);
    const res = await row(ROW);
    expect(res.body?.Items.map((i) => i.Id)).toEqual(Array.from({ length: 20 }, (_, i) => `S${i}`));
    // La série coupée entre deux pages garde tous ses épisodes.
    expect(res.body?.Items.every((i) => (i.LatestAdditions as { EpisodeCount: number }).EpisodeCount === 30)).toBe(true);
    expect(scanPages()).toBe(2);
    expect(upstream.calls[1].query.get("StartIndex")).toBe("500");
  });

  it("jamais plus de quatre pages : une série de milliers d'épisodes arrivée d'un bloc", async () => {
    upstream.inventory = [...avalanche(1, 3000), ...avalanche(5, 2)];
    const res = await row(ROW);
    expect(scanPages()).toBe(4);
    expect(res.body?.Items.map((i) => i.Id)).toEqual(["S0"]);
    expect(upstream.calls).toHaveLength(5);
  });

  it("un jeton refusé reste un 401 pour le client", async () => {
    const res = await row(ROW, "jeton-perime");
    expect(res.status).toBe(401);
  });
});
