/**
 * Hors de ses plages horaires, un compte ne regarde rien par Tentacle
 * (docs/DROITS-UTILISATEURS.md § 5) : ni par une route du cœur (`requireAuth`,
 * qui sert avec la clé d'administration), ni par le proxy avec la clé prêtée à
 * sa TV. 403, jamais 401 : le client ne se déconnecte pas. L'administrateur et
 * « voir en tant que » ne sont pas concernés.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ url: "", outside: new Set<string>(), hits: 0 }));
const JWT_HEAD = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
const TV_CHILD = `${JWT_HEAD}.tv-enfant.sig`;
const TV_ADMIN = `${JWT_HEAD}.tv-admin.sig`;
const VIEW_AS_CHILD = `${JWT_HEAD}.voir-enfant.sig`;
const NATIVE_CHILD = "jeton-jellyfin-enfant";

vi.mock("../../src/services/configStore", () => ({ getJellyfinUrl: () => state.url, getJellyfinApiKey: () => "cle-admin" }));
// Les plages du compte : celles de l'enfant ne couvrent jamais « maintenant » quand il est hors plage.
vi.mock("../../src/services/contentPolicy", () => ({
  getContentPolicy: async (userId: string) => ({
    accessSchedules: state.outside.has(userId) ? [{ dayOfWeek: "Everyday", startHour: 0, endHour: -1 }] : [],
  }),
}));
vi.mock("../../src/services/jwt", () => ({
  hashToken: (value: string) => `h:${value}`,
  verifyImpersonationToken: async (token: string) =>
    token === VIEW_AS_CHILD ? { userId: "enfant", username: "Enfant", isAdmin: false, type: "impersonation" } : null,
  verifyDeviceToken: async (token: string) =>
    token === TV_CHILD
      ? { userId: "enfant", username: "Enfant", isAdmin: false, deviceId: "d", type: "paired_device" }
      : token === TV_ADMIN
        ? { userId: "admin", username: "Admin", isAdmin: true, deviceId: "d2", type: "paired_device" }
        : null,
}));
vi.mock("../../src/services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    pairedDevice: { findUnique: async () => ({ id: "row" }), updateMany: async () => ({ count: 1 }) },
  }),
}));
vi.mock("../../src/services/wsManager", () => ({ broadcastToUser: () => {} }));

import { jellyfinProxyRoutes } from "../../src/routes/jellyfinProxy";
import { requireAuth } from "../../src/middleware/auth";
import { resetPairedDeviceStatusForTests } from "../../src/services/pairedDeviceStatus";
import { clearAll } from "../../src/services/jellyfinCache";

let jellyfin: http.Server;
let app: FastifyInstance;

beforeAll(async () => {
  jellyfin = http.createServer((req, res) => {
    state.hits++;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(req.url === "/Users/Me" ? { Id: "enfant", Name: "Enfant", Policy: { IsAdministrator: false } } : { Items: [] }));
  });
  await new Promise<void>((resolve) => jellyfin.listen(0, "127.0.0.1", resolve));
  state.url = `http://127.0.0.1:${(jellyfin.address() as AddressInfo).port}`;
  app = Fastify();
  app.get("/api/protected", { preHandler: requireAuth }, async () => ({ ok: true }));
  await app.register(jellyfinProxyRoutes, { prefix: "/api/jellyfin" });
});

afterAll(async () => {
  await app.close();
  jellyfin.closeAllConnections();
  await new Promise<void>((resolve) => jellyfin.close(() => resolve()));
});

beforeEach(() => {
  state.outside.clear();
  state.hits = 0;
  clearAll();
  resetPairedDeviceStatusForTests();
});

const call = (url: string, token: string) => app.inject({ method: "GET", url, headers: { "x-emby-token": token } });

describe("plages horaires", () => {
  it("dans la plage : tout passe", async () => {
    expect((await call("/api/protected", TV_CHILD)).statusCode).toBe(200);
    expect((await call("/api/protected", NATIVE_CHILD)).statusCode).toBe(200);
    expect((await call("/api/jellyfin/Items?Recursive=true", TV_CHILD)).statusCode).toBe(200);
  });

  it("hors plage : 403 aux routes du cœur (TV et jeton Jellyfin) et au proxy de la TV — rien ne part chez Jellyfin pour la TV", async () => {
    state.outside.add("enfant");
    for (const token of [TV_CHILD, NATIVE_CHILD]) {
      const res = await call("/api/protected", token);
      expect([res.statusCode, res.json()]).toEqual([403, { error: "outside_access_schedule" }]);
    }
    state.hits = 0;
    expect((await call("/api/jellyfin/Items?Recursive=true", TV_CHILD)).statusCode).toBe(403);
    expect((await call("/api/jellyfin/Videos/abc/stream?static=true", TV_CHILD)).statusCode).toBe(403);
    expect(state.hits).toBe(0);
  });

  it("un administrateur et « voir en tant que » ne sont pas bornés", async () => {
    state.outside.add("enfant");
    state.outside.add("admin");
    expect((await call("/api/protected", TV_ADMIN)).statusCode).toBe(200);
    expect((await call("/api/protected", VIEW_AS_CHILD)).statusCode).toBe(200);
  });
});
