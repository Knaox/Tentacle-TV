/**
 * Les gestes de déjumelage, côté routes : la TV elle-même
 * (`POST /api/pair/self/revoke`, idempotente, et `/api/auth/logout`), la liste
 * des appareils du compte, l'admin. Chacun passe par la révocation commune :
 * le jeton est refusé aussitôt après, l'autre TV du compte n'en voit rien.
 * Vrai Fastify, vraies routes ; base en mémoire, faux Jellyfin.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeJellyfin, fakeJellyfinFetch } from "./fakeJellyfinDevices";
import { createPairingDb } from "./fakePairingDb";

const h = vi.hoisted(() => ({ db: null as ReturnType<typeof import("./fakePairingDb").createPairingDb> | null }));

vi.mock("../src/services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "cle-admin",
  getPublicUrl: () => null,
}));
vi.mock("../src/services/jwt", () => ({
  hashToken: (value: string) => `h:${value}`,
  verifyImpersonationToken: async () => null,
  signDeviceToken: async () => "jwt-neuf.a.b",
  verifyDeviceToken: async (token: string) =>
    token.startsWith("jwt-")
      ? { userId: token.startsWith("jwt-autre") ? "u2" : "u1", username: "Knaoxtest", isAdmin: token.startsWith("jwt-admin"), deviceId: "d", type: "paired_device" }
      : null,
}));
vi.mock("../src/services/db", () => ({ hasPrisma: () => true, getPrisma: () => h.db!.client }));
vi.mock("../src/services/deviceSessions/deviceAuth", () => ({ pairedDeviceIdForHash: async (hash: string) => `derive-${hash}` }));
vi.mock("../src/services/deviceSessions/gateway", () => ({ endPairedDeviceSessions: async () => undefined }));
vi.mock("../src/services/wsManager", () => ({ revokeDeviceByTokenHash: () => undefined }));

import { pairedDevicesRoutes } from "../src/routes/pairing/devices";
import { authRoutes } from "../src/routes/auth";
import { requireAuth } from "../src/middleware/auth";
import { resetPairedDeviceStatusForTests } from "../src/services/pairedDeviceStatus";

const SALON = "jwt-salon.a.b";
const CHAMBRE = "jwt-chambre.a.b";
const AUTRE = "jwt-autre.a.b";
const ADMIN = "jwt-admin.a.b";

let app: FastifyInstance;

beforeAll(async () => {
  vi.stubGlobal("fetch", vi.fn(fakeJellyfinFetch(createFakeJellyfin())));
  app = Fastify();
  app.get("/api/protected", { preHandler: [requireAuth] }, async () => ({ ok: true }));
  await app.register(pairedDevicesRoutes, { prefix: "/api/pair" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  h.db = createPairingDb();
  resetPairedDeviceStatusForTests();
  for (const [token, userId] of [[SALON, "u1"], [CHAMBRE, "u1"], [AUTRE, "u2"], [ADMIN, "u1"]]) {
    await h.db.client.pairedDevice.create({ data: { tokenHash: `h:${token}`, jellyfinUserId: userId, name: "Apple TV" } });
  }
});

const idOf = (token: string) => h.db!.state.devices.find((d) => d.tokenHash === `h:${token}`)?.id;
const as = (token: string) => ({ authorization: `Bearer ${token}` });
const protectedStatus = async (token: string) =>
  (await app.inject({ method: "GET", url: "/api/protected", headers: as(token) })).statusCode;

describe("la TV se déjumelle elle-même", () => {
  it("son jeton est révoqué, puis refusé partout", async () => {
    const res = await app.inject({ method: "POST", url: "/api/pair/self/revoke", headers: as(SALON) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ revoked: true });
    expect(idOf(SALON)).toBeUndefined();
    expect(await protectedStatus(SALON)).toBe(401);
    expect(await protectedStatus(CHAMBRE)).toBe(200);
  });

  it("répond pareil quand on la rejoue (après un plantage, un serveur coupé)", async () => {
    await app.inject({ method: "POST", url: "/api/pair/self/revoke", headers: as(SALON) });
    const again = await app.inject({ method: "POST", url: "/api/pair/self/revoke", headers: as(SALON) });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ revoked: true });
  });

  it("se déconnecter vaut déjumelage", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/logout", headers: as(SALON) });
    expect(res.statusCode).toBe(200);
    expect(idOf(SALON)).toBeUndefined();
    expect(await protectedStatus(SALON)).toBe(401);
    expect(await protectedStatus(CHAMBRE)).toBe(200);
  });

  it("refuse un jeton qui n'est pas un jeton d'appareil", async () => {
    const res = await app.inject({ method: "POST", url: "/api/pair/self/revoke", headers: as("jeton-jellyfin") });
    expect(res.statusCode).toBe(401);
    expect(h.db!.state.devices).toHaveLength(4);
  });
});

describe("déjumeler depuis la liste des appareils", () => {
  it("le compte révoque sa TV ; l'autre TV du compte continue", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/pair/my-devices/${idOf(SALON)}`, headers: as(CHAMBRE) });
    expect(res.statusCode).toBe(200);
    expect(await protectedStatus(SALON)).toBe(401);
    expect(await protectedStatus(CHAMBRE)).toBe(200);
  });

  it("un compte ne révoque pas la TV d'un autre", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/pair/my-devices/${idOf(AUTRE)}`, headers: as(SALON) });
    expect(res.statusCode).toBe(404);
    expect(await protectedStatus(AUTRE)).toBe(200);
  });

  it("l'admin révoque n'importe quelle TV, un autre compte non", async () => {
    expect((await app.inject({ method: "DELETE", url: `/api/pair/devices/${idOf(AUTRE)}`, headers: as(SALON) })).statusCode).toBe(403);
    expect((await app.inject({ method: "DELETE", url: `/api/pair/devices/${idOf(AUTRE)}`, headers: as(ADMIN) })).statusCode).toBe(200);
    expect(await protectedStatus(AUTRE)).toBe(401);
  });

  it("révoquer un appareil inconnu répond 404", async () => {
    expect((await app.inject({ method: "DELETE", url: "/api/pair/devices/inconnu", headers: as(ADMIN) })).statusCode).toBe(404);
  });
});
