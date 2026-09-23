/**
 * La liste des bibliothèques telle que le proxy la rend : films, séries et
 * bibliothèques mixtes seulement — au premier appel comme depuis le cache.
 *
 * Un vrai serveur HTTP local tient le rôle de Jellyfin : le proxy parle par
 * undici, pas par le `fetch` global qu'on pourrait remplacer.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const upstream = vi.hoisted(() => ({ url: "", hits: 0 }));
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
import { clearAll } from "../src/services/jellyfinCache";

const VIEWS = {
  Items: [
    { Id: "f", Name: "Films", Type: "CollectionFolder", CollectionType: "movies" },
    { Id: "a", Name: "Animés", Type: "CollectionFolder", CollectionType: "tvshows" },
    { Id: "t", Name: "Tout", Type: "CollectionFolder" },
    { Id: "m", Name: "Musique", Type: "CollectionFolder", CollectionType: "music" },
    { Id: "l", Name: "Livres", Type: "CollectionFolder", CollectionType: "books" },
    { Id: "c", Name: "Chaîne", Type: "Channel" },
  ],
  TotalRecordCount: 6,
  StartIndex: 0,
};

let jellyfin: http.Server;
let app: FastifyInstance;
let base = "";

beforeAll(async () => {
  jellyfin = http.createServer((req, res) => {
    upstream.hits++;
    if ((req.url ?? "").toLowerCase().startsWith("/users/u1/views")) {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(VIEWS));
      return;
    }
    res.writeHead(404);
    res.end();
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
  upstream.hits = 0;
});

async function views(path: string, token: string) {
  const res = await fetch(`${base}/api/jellyfin/${path}`, { headers: { "X-Emby-Token": token } });
  const body = (await res.json()) as { Items: Array<{ Name: string }>; TotalRecordCount: number };
  return { status: res.status, cache: res.headers.get("x-tentacle-cache"), names: body.Items.map((v) => v.Name), total: body.TotalRecordCount };
}

describe("GET /api/jellyfin/Users/{id}/Views", () => {
  it("ne rend que les films, les séries et les bibliothèques mixtes", async () => {
    const first = await views("Users/u1/Views", "jeton-de-test-a");
    expect(first).toEqual({ status: 200, cache: "MISS", names: ["Films", "Animés", "Tout"], total: 3 });
  });

  it("le cache resservi est déjà trié", async () => {
    await views("Users/u1/Views", "jeton-de-test-b");
    const again = await views("Users/u1/Views", "jeton-de-test-b");
    expect(again).toEqual({ status: 200, cache: "HIT", names: ["Films", "Animés", "Tout"], total: 3 });
    expect(upstream.hits).toBe(1);
  });

  it("une casse différente du chemin ne contourne pas le tri", async () => {
    const lower = await views("users/u1/views", "jeton-de-test-c");
    expect(lower.names).toEqual(["Films", "Animés", "Tout"]);
  });
});
