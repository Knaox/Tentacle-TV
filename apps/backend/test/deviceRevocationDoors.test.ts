/**
 * Un jeton d'appareil révoqué est refusé à CHAQUE porte HTTP — routes REST,
 * proxy Jellyfin (métadonnées, images, flux), tuiles de trickplay,
 * rafraîchissement — sans qu'aucune requête ne parte chez Jellyfin. L'autre
 * TV du même compte, elle, passe partout.
 *
 * Un vrai serveur HTTP local tient le rôle de Jellyfin (le proxy parle par
 * undici) ; les jetons sont des JWT factices, la base une liste en mémoire.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ url: "", hits: [] as string[], rows: new Set<string>() }));

vi.mock("../src/services/configStore", () => ({
  getJellyfinUrl: () => state.url,
  getJellyfinApiKey: () => "cle-admin",
}));
vi.mock("../src/services/jwt", () => ({
  hashToken: (value: string) => `h:${value}`,
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async (token: string) =>
    token.startsWith("jwt-") ? { userId: "u1", username: "Knaoxtest", isAdmin: false, deviceId: "d", type: "paired_device" } : null,
}));
vi.mock("../src/services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    pairedDevice: {
      findUnique: async (args: { where: { tokenHash: string } }) =>
        state.rows.has(args.where.tokenHash) ? { id: args.where.tokenHash, name: "Apple TV", jellyfinUserId: "u1", jellyfinAccessToken: null } : null,
      updateMany: async () => ({ count: 1 }),
    },
  }),
}));
vi.mock("../src/services/wsManager", () => ({ broadcastToUser: () => {} }));

import { requireAuth } from "../src/middleware/auth";
import { authRefreshRoutes } from "../src/routes/authRefresh";
import { jellyfinProxyRoutes } from "../src/routes/jellyfinProxy";
import { jellyfinTrickplayRoutes } from "../src/routes/jellyfinTrickplay";
import { clearAll } from "../src/services/jellyfinCache";
import { markDeviceRevoked, resetPairedDeviceStatusForTests } from "../src/services/pairedDeviceStatus";

/** Deux TV du même compte ; un JWT a trois segments, le rafraîchissement le vérifie. */
const SALON = "jwt-salon.charge.signature";
const CHAMBRE = "jwt-chambre.charge.signature";

let jellyfin: http.Server;
let app: FastifyInstance;
let base = "";

beforeAll(async () => {
  jellyfin = http.createServer((req, res) => {
    state.hits.push(`${req.url} ${req.headers.authorization ?? ""}`);
    // La clé admin, substituée par le proxy au JWT d'un appareil jumelé.
    if (!String(req.headers.authorization ?? "").includes('Token="cle-admin"')) {
      res.writeHead(401);
      res.end();
      return;
    }
    const isImage = /Images|Trickplay/.test(req.url ?? "");
    res.writeHead(200, { "content-type": isImage ? "image/jpeg" : "application/json" });
    res.end(isImage ? "jpeg" : JSON.stringify({ Items: [], TotalRecordCount: 0 }));
  });
  await new Promise<void>((resolve) => jellyfin.listen(0, "127.0.0.1", resolve));
  state.url = `http://127.0.0.1:${(jellyfin.address() as AddressInfo).port}`;

  app = Fastify();
  app.get("/api/protected", { preHandler: [requireAuth] }, async () => ({ ok: true }));
  await app.register(authRefreshRoutes, { prefix: "/api/auth" });
  await app.register(jellyfinTrickplayRoutes, { prefix: "/api/jellyfin" });
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
  resetPairedDeviceStatusForTests();
  state.hits = [];
  state.rows = new Set([`h:${SALON}`, `h:${CHAMBRE}`]);
});

/** Les portes, chacune avec la façon dont un téléviseur y présente son jeton. */
const DOORS: Array<{ name: string; call: (token: string) => Promise<Response> }> = [
  { name: "route REST", call: (t) => fetch(`${base}/api/protected`, { headers: { Authorization: `Bearer ${t}` } }) },
  { name: "métadonnées", call: (t) => fetch(`${base}/api/jellyfin/Items?ParentId=x`, { headers: { "X-Emby-Token": t } }) },
  { name: "image (jeton en query)", call: (t) => fetch(`${base}/api/jellyfin/Items/abc/Images/Primary?api_key=${t}`) },
  { name: "flux", call: (t) => fetch(`${base}/api/jellyfin/Videos/abc/stream?static=true&ApiKey=${t}`) },
  { name: "trickplay", call: (t) => fetch(`${base}/api/jellyfin/items/abc/trickplay/320/0.jpg?ApiKey=${t}`) },
  {
    name: "rafraîchissement",
    call: (t) => fetch(`${base}/api/auth/refresh`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t }),
    }),
  },
];

describe("un jeton révoqué est refusé à chaque porte", () => {
  for (const door of DOORS) {
    it(`${door.name} : 401 « revoked », et rien ne part chez Jellyfin`, async () => {
      state.rows.delete(`h:${SALON}`);
      const res = await door.call(SALON);
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ revoked: true });
      expect(state.hits).toEqual([]);
    });
  }

  it("l'est aussitôt après la révocation, même si son verdict était en mémoire", async () => {
    expect((await DOORS[1].call(SALON)).status).toBe(200);
    markDeviceRevoked(`h:${SALON}`);
    state.rows.delete(`h:${SALON}`);
    state.hits = [];
    const res = await DOORS[1].call(SALON);
    expect(res.status).toBe(401);
    expect(state.hits).toEqual([]);
  });

  it("ne sert pas le cache du proxy à un jeton révoqué", async () => {
    // `Views` est mis en cache par jeton : la révocation doit passer devant.
    expect((await fetch(`${base}/api/jellyfin/Users/u1/Views`, { headers: { "X-Emby-Token": SALON } })).status).toBe(200);
    markDeviceRevoked(`h:${SALON}`);
    const res = await fetch(`${base}/api/jellyfin/Users/u1/Views`, { headers: { "X-Emby-Token": SALON } });
    expect(res.status).toBe(401);
    expect(res.headers.get("x-tentacle-cache")).toBeNull();
  });
});

describe("l'autre TV du compte n'en voit rien", () => {
  for (const door of DOORS) {
    it(`${door.name} : la chambre passe quand le salon est révoqué`, async () => {
      state.rows.delete(`h:${SALON}`);
      markDeviceRevoked(`h:${SALON}`);
      const res = await door.call(CHAMBRE);
      expect(res.status).toBe(200);
    });
  }
});

describe("un 401 qui n'est pas une révocation ne déjumelle personne", () => {
  it("un jeton Jellyfin refusé répond 401 sans « revoked »", async () => {
    const res = await fetch(`${base}/api/protected`, { headers: { Authorization: "Bearer jeton-jellyfin-mort" } });
    expect(res.status).toBe(401);
    expect(await res.json()).not.toHaveProperty("revoked");
  });
});
