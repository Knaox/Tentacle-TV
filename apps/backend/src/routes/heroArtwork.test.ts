/**
 * GET /api/hero/artwork/:itemId : le fond TMDB d'abord (clé configurée),
 * sinon les images Jellyfin du titre et de sa série ; 404 pour un titre que
 * le compte ne voit pas. Faux Jellyfin par `fetch`, auth réelle contre un faux
 * /Users/Me (motif preferences.homeLayout.test.ts).
 */
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tmdb = vi.hoisted(() => ({ configured: true, backdrop: "/fond.jpg" as string | null, calls: 0 }));
const MOVIE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const EPISODE = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SERIES = "cccccccccccccccccccccccccccccccc";
const ITEMS: Record<string, Record<string, unknown>> = {
  [MOVIE]: { Id: MOVIE, Type: "Movie", ProviderIds: { Tmdb: "603" } },
  [EPISODE]: { Id: EPISODE, Type: "Episode", SeriesId: SERIES },
  [SERIES]: { Id: SERIES, Type: "Series", ProviderIds: { Tmdb: "1399" } },
};
const IMAGES: Record<string, unknown[]> = {
  [MOVIE]: [{ ImageType: "Primary", ImageTag: "p" }, { ImageType: "Backdrop", ImageIndex: 0, ImageTag: "b" }],
  [EPISODE]: [{ ImageType: "Primary", ImageTag: "ep" }],
  [SERIES]: [{ ImageType: "Backdrop", ImageIndex: 0, ImageTag: "sb" }],
};

vi.mock("../services/configStore", () => ({ getJellyfinUrl: () => "http://jf.test", getJellyfinApiKey: () => "cle-banc" }));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/db", () => ({ hasPrisma: () => true, getPrisma: () => ({}) }));
vi.mock("../services/tmdb/client", () => ({ tmdbConfigured: () => tmdb.configured }));
vi.mock("../services/tmdb/metaCache", () => ({
  getTitleMeta: async (mediaType: string, tmdbId: number) => {
    tmdb.calls++;
    return { mediaType, tmdbId, backdropPath: tmdb.backdrop };
  },
}));

import { heroArtworkRoutes } from "./heroArtwork";

beforeEach(() => {
  tmdb.configured = true;
  tmdb.backdrop = "/fond.jpg";
  tmdb.calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/Users/Me")) {
        return new Response(JSON.stringify({ Id: "u1", Name: "banc", Policy: { IsAdministrator: false } }), { status: 200 });
      }
      if (url.pathname === "/Items") {
        const item = ITEMS[url.searchParams.get("Ids") ?? ""];
        return new Response(JSON.stringify({ Items: item ? [item] : [] }), { status: 200 });
      }
      const images = url.pathname.match(/^\/Items\/([0-9a-f]+)\/Images$/);
      if (images) return new Response(JSON.stringify(IMAGES[images[1]] ?? []), { status: 200 });
      return new Response("{}", { status: 404 });
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

async function get(id: string) {
  const app = Fastify();
  await app.register(heroArtworkRoutes, { prefix: "/api/hero" });
  const res = await app.inject({ method: "GET", url: `/api/hero/artwork/${id}`, headers: { "x-emby-token": "jeton-banc" } });
  await app.close();
  return res;
}

describe("GET /api/hero/artwork/:itemId", () => {
  it("un film : le fond TMDB, puis ses images Jellyfin (fond avant affiche)", async () => {
    const res = await get(MOVIE);
    expect(res.statusCode).toBe(200);
    expect(res.json().images).toEqual([
      { kind: "tmdb", url: "https://image.tmdb.org/t/p/w1280/fond.jpg" },
      { kind: "jellyfin", itemId: MOVIE, type: "Backdrop", index: 0, tag: "b" },
      { kind: "jellyfin", itemId: MOVIE, type: "Primary", tag: "p" },
    ]);
  });

  it("TMDB non configuré : Jellyfin seul, sans un appel à TMDB", async () => {
    tmdb.configured = false;
    const res = await get(MOVIE);
    expect(res.json().images[0]).toMatchObject({ kind: "jellyfin", type: "Backdrop" });
    expect(tmdb.calls).toBe(0);
  });

  it("un épisode : le fond TMDB de SA SÉRIE, puis le fond de la série avant l'image de l'épisode", async () => {
    const res = await get(EPISODE);
    expect(res.json().images).toEqual([
      { kind: "tmdb", url: "https://image.tmdb.org/t/p/w1280/fond.jpg" },
      { kind: "jellyfin", itemId: SERIES, type: "Backdrop", index: 0, tag: "sb" },
      { kind: "jellyfin", itemId: EPISODE, type: "Primary", tag: "ep" },
    ]);
  });

  it("un titre que le compte ne voit pas : 404 ; un id illisible : 400", async () => {
    expect((await get("dddddddddddddddddddddddddddddddd")).statusCode).toBe(404);
    expect((await get("pas-un-id")).statusCode).toBe(400);
  });
});
