/**
 * Un geste de carte (favori, vu, Ma liste) ne revient jamais en arrière à la
 * relecture qui le suit.
 *
 * Le proxy garde quelques secondes les rangées lourdes (Reprendre, Prochains
 * épisodes, Derniers ajouts — cf. `jellyfinCache`). Le client, lui, relit
 * Reprendre et Prochains épisodes dès qu'un geste aboutit
 * (`invalidateAllMediaQueries`) : servie depuis le cache, la relecture
 * rendait l'état d'AVANT le geste et écrasait la mise à jour optimiste —
 * le cœur se décochait, et chaque nouveau clic de même, jusqu'à l'expiration
 * du cache (« ça remarche après un défilement »).
 *
 * Un vrai serveur HTTP local tient le rôle de Jellyfin, avec un état : ce
 * qu'un geste écrit, la lecture suivante le rend.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const upstream = vi.hoisted(() => ({ url: "", favorite: false, played: false, likes: false, delayMs: 0 }));
vi.mock("../src/services/configStore", () => ({
  getJellyfinUrl: () => upstream.url,
  getJellyfinApiKey: () => "cle-admin",
}));
vi.mock("../src/services/jwt", () => ({
  verifyDeviceToken: async () => null,
  verifyImpersonationToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../src/services/db", () => ({ hasPrisma: () => false, getPrisma: () => null }));
vi.mock("../src/services/reco/candidates/libraryMemo", () => ({ patchLibraryMemo: () => {} }));

import { jellyfinProxyRoutes } from "../src/routes/jellyfinProxy";
import { clearAll } from "../src/services/jellyfinCache";

let jellyfin: http.Server;
let app: FastifyInstance;
let base = "";

const userData = () => ({ IsFavorite: upstream.favorite, Played: upstream.played, Likes: upstream.likes });
const list = () => JSON.stringify({ Items: [{ Id: "m1", Type: "Movie", UserData: userData() }], TotalRecordCount: 1 });

beforeAll(async () => {
  jellyfin = http.createServer((req, res) => {
    const url = req.url ?? "";
    const on = req.method === "POST";
    // Chemins MODERNES : le proxy traduit ceux du client (cf. modernRoutes).
    if (/^\/UserFavoriteItems\//.test(url)) upstream.favorite = on;
    else if (/^\/UserPlayedItems\//.test(url)) upstream.played = on;
    else if (/^\/UserItems\/[^/]+\/Rating/.test(url)) upstream.likes = on && /likes=true/i.test(url);
    // L'état lu À L'ARRIVÉE de la requête, comme Jellyfin : la réponse lente porte l'état d'avant.
    const body = req.method === "GET" ? list() : JSON.stringify(userData());
    const reply = () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(body);
    };
    // Une lecture lente : partie AVANT le geste, revenue APRÈS.
    if (req.method === "GET" && upstream.delayMs > 0) setTimeout(reply, upstream.delayMs);
    else reply();
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
  await new Promise<void>((resolve) => jellyfin.close(() => resolve()));
});

beforeEach(() => {
  Object.assign(upstream, { favorite: false, played: false, likes: false, delayMs: 0 });
  clearAll();
});

const call = (method: string, path: string) =>
  fetch(`${base}/api/jellyfin/${path}`, {
    method,
    headers: { authorization: `MediaBrowser Client="Tentacle TV - Web", Device="Banc", DeviceId="x", Version="1", Token="jeton-jellyfin"` },
  });

const firstUserData = async (path: string) => {
  const res = await call("GET", path);
  const body = (await res.json()) as { Items: Array<{ UserData: Record<string, unknown> }> };
  return body.Items[0].UserData;
};

// Les rangées que le proxy garde en cache, telles que le client les demande.
const ROWS = [
  ["Reprendre", "Users/u1/Items/Resume?Limit=12&Recursive=true"],
  ["Prochains épisodes", "Shows/NextUp?userId=u1&Limit=12"],
  ["Derniers ajouts", "Users/u1/Items/Latest?ParentId=lib&Limit=16"],
] as const;

const GESTURES = [
  ["le favori", "POST", "Users/u1/FavoriteItems/m1", "IsFavorite"],
  ["le favori retiré", "DELETE", "Users/u1/FavoriteItems/m1", "IsFavorite"],
  ["« vu »", "POST", "Users/u1/PlayedItems/m1", "Played"],
  ["« vu » retiré", "DELETE", "Users/u1/PlayedItems/m1", "Played"],
  ["Ma liste", "POST", "Users/u1/Items/m1/Rating?likes=true", "Likes"],
  ["Ma liste retirée", "DELETE", "Users/u1/Items/m1/Rating", "Likes"],
] as const;

describe("la rangée relue après un geste", () => {
  for (const [row, rowPath] of ROWS) {
    it.each(GESTURES)(`${row} : %s se relit tel quel`, async (_name, method, gesturePath, field) => {
      // L'état de départ est l'inverse du geste : un retrait part d'un titre coché.
      const start = method === "DELETE";
      Object.assign(upstream, { favorite: start, played: start, likes: start });
      expect((await firstUserData(rowPath))[field]).toBe(start);

      const gesture = await call(method, gesturePath);
      expect(gesture.status).toBe(200);

      expect((await firstUserData(rowPath))[field]).toBe(!start);
    });
  }

  it("une lecture partie avant le geste et revenue après n'est pas gardée", async () => {
    upstream.delayMs = 150;
    const slowRead = firstUserData("Users/u1/Items/Resume?Limit=12");
    await new Promise((resolve) => setTimeout(resolve, 30));
    upstream.delayMs = 0;
    await call("POST", "Users/u1/FavoriteItems/m1");
    // La lecture lente rend l'état d'avant — elle était partie avant —
    expect((await slowRead).IsFavorite).toBe(false);
    // — mais la relecture du client, elle, voit le geste.
    expect((await firstUserData("Users/u1/Items/Resume?Limit=12")).IsFavorite).toBe(true);
  });
});
