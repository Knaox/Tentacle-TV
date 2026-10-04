/**
 * La faille fermée : un jeton d'appareil (TV jumelée, session de profil)
 * reçoit en aval la clé d'administration de Jellyfin — il ne doit donc jamais
 * pouvoir supprimer ou modifier un titre par le proxy. Ce que les TV livrées
 * écrivent (vu, favoris, Ma liste, reports de lecture…) passe toujours ; un
 * jeton Jellyfin natif (web, bureau, mobile) n'est pas concerné : Jellyfin
 * décide pour lui.
 *
 * Un vrai serveur HTTP local tient le rôle de Jellyfin (le proxy parle par
 * undici, pas par le `fetch` global).
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const upstream = vi.hoisted(() => ({ url: "", hits: [] as string[] }));
vi.mock("../src/services/configStore", () => ({
  getJellyfinUrl: () => upstream.url,
  getJellyfinApiKey: () => "cle-admin",
}));
vi.mock("../src/services/jwt", () => ({
  verifyDeviceToken: async (token: string) =>
    token === "jwt-tv" ? { userId: "u1", username: "Damien", isAdmin: false, deviceId: "d", type: "paired_device" } : null,
  verifyImpersonationToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../src/services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    pairedDevice: {
      findUnique: async (args: { where: { tokenHash?: string } }) => (args.where.tokenHash === "jwt-tv" ? { id: "pd", name: "Apple TV" } : null),
      updateMany: async () => ({ count: 0 }),
    },
  }),
}));
vi.mock("../src/services/wsManager", () => ({ broadcastToUser: () => {} }));

import { jellyfinProxyRoutes } from "../src/routes/jellyfinProxy";
import { resetPairedDeviceStatusForTests } from "../src/services/pairedDeviceStatus";

let jellyfin: http.Server;
let app: FastifyInstance;
let base = "";

beforeAll(async () => {
  jellyfin = http.createServer((req, res) => {
    upstream.hits.push(`${req.method} ${req.url} ${/Token="cle-admin"/.test(String(req.headers.authorization)) ? "clé-admin" : "jeton-client"}`);
    res.writeHead(req.method === "DELETE" ? 204 : 200, { "content-type": "application/json" });
    res.end(req.method === "DELETE" ? undefined : "{}");
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
  upstream.hits = [];
  resetPairedDeviceStatusForTests();
});

const call = (method: string, path: string, token: string) => {
  const withBody = method === "POST";
  return fetch(`${base}/api/jellyfin/${path}`, {
    method,
    headers: {
      authorization: `MediaBrowser Client="Tentacle TV - TV", Device="Apple TV", DeviceId="x", Version="1", Token="${token}"`,
      ...(withBody && { "content-type": "application/json" }),
    },
    body: withBody ? "{}" : undefined,
  });
};

describe("un jeton d'appareil", () => {
  it.each([
    ["DELETE", "Users/u1/Items/item1"],
    ["DELETE", "Items/item1"],
    ["POST", "Items/item1"],
    ["POST", "Items/item1/Images/Primary"],
    ["DELETE", "Items/item1/Images/Primary/0"],
  ])("%s %s : refusé, Jellyfin n'en voit rien", async (method, path) => {
    const res = await call(method, path, "jwt-tv");
    expect(res.status).toBe(403);
    expect(upstream.hits).toEqual([]);
  });

  it.each([
    ["POST", "Users/u1/FavoriteItems/item1"],
    ["DELETE", "Users/u1/PlayedItems/item1"],
    ["POST", "Users/u1/Items/item1/Rating?likes=true"],
  ])("%s %s : ce que les TV écrivent passe toujours", async (method, path) => {
    const res = await call(method, path, "jwt-tv");
    expect(res.status).toBeLessThan(300);
    expect(upstream.hits).toHaveLength(1);
    expect(upstream.hits[0]).toMatch(/clé-admin$/);
  });
});

describe("un jeton Jellyfin natif", () => {
  it("n'est pas concerné : Jellyfin décide avec SON jeton", async () => {
    const res = await call("DELETE", "Items/item1", "jeton-jellyfin-du-web");
    expect(res.status).toBe(204);
    expect(upstream.hits).toEqual(["DELETE /Items/item1 jeton-client"]);
  });
});
