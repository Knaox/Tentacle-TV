/**
 * Les entrées de `/api/tmdb` partent dans des URL portées par une clé :
 * celle de Seerr (`/check-platform` → `watchProviders=`) et la clé
 * d'ADMINISTRATION de Jellyfin (`/resolve` → `AnyProviderIdEquals=`). Un
 * identifiant qui n'est pas un nombre n'y entre jamais : ni paramètre ajouté
 * (`&userId=un-autre`, qui ferait lire Jellyfin au nom d'un autre compte), ni
 * chauffe d'une « plateforme » inventée à chaque appel.
 */

import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { user?: unknown }) => {
    request.user = { userId: "u1", username: "alice", isAdmin: false };
  },
}));
vi.mock("../services/configStore", () => ({ getJellyfinUrl: () => "http://jf.test", getJellyfinApiKey: () => "cle-admin" }));
vi.mock("../services/seerConfig", () => ({ getSeerrConfig: () => ({ url: "http://seerr.test", apiKey: "cle-seerr" }) }));

import { tmdbRoutes } from "./tmdb";

const calls: string[] = [];

async function appWithFetch() {
  calls.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return Response.json({ Items: [], totalPages: 1, results: [] });
  }));
  const app = Fastify();
  await app.register(tmdbRoutes, { prefix: "/api/tmdb" });
  return app;
}

afterEach(() => vi.unstubAllGlobals());

describe("/api/tmdb : aucun identifiant qui ne soit un nombre", () => {
  it("/resolve : un tmdbId porteur de paramètres ne part pas chez Jellyfin", async () => {
    const app = await appWithFetch();
    const res = await app.inject({ url: `/api/tmdb/resolve?tmdbId=${encodeURIComponent("1&userId=admin")}&mediaType=movie` });
    expect(res.json()).toEqual({ jellyfinId: null, remoteTrailers: [] });
    expect(calls).toEqual([]);
  });

  it("/resolve : un tmdbId numérique est résolu comme avant", async () => {
    const app = await appWithFetch();
    await app.inject({ url: "/api/tmdb/resolve?tmdbId=603&mediaType=movie" });
    expect(calls[0]).toContain("AnyProviderIdEquals=tmdb.603&");
  });

  it("/check-platform : une plateforme qui n'est pas un entier ne part pas chez Seerr", async () => {
    const app = await appWithFetch();
    const res = await app.inject({
      method: "POST",
      url: "/api/tmdb/check-platform",
      payload: { tmdbIds: [{ tmdbId: 1, mediaType: "movie" }], platformId: "8&page=999" },
    });
    expect(res.json()).toEqual({ matchingIds: [], cacheReady: false });
    expect(calls).toEqual([]);
  });

  it("/check-platform : une liste mal formée rend la réponse vide, jamais une 500", async () => {
    const app = await appWithFetch();
    const res = await app.inject({ method: "POST", url: "/api/tmdb/check-platform", payload: { tmdbIds: "x", platformId: 8 } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ matchingIds: [], cacheReady: false });
  });
});
