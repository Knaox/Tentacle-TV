/**
 * La Famille aux portes existantes : une session de profil de TV (ligne
 * enfant de `paired_devices`) passe comme un jumelage — sans aucun droit
 * d'administration —, se ferme seule (« Changer de profil ») sans déjumeler la
 * TV, et part avec son jumelage. Le jeton de jumelage « profils seuls » n'ouvre
 * aucune autre porte. Vrai Fastify, vraies routes ; base en mémoire.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeJellyfin, fakeJellyfinFetch } from "./fakeJellyfinDevices";
import { createPairingDb } from "./fakePairingDb";

const h = vi.hoisted(() => ({
  db: null as ReturnType<typeof import("./fakePairingDb").createPairingDb> | null,
  ended: [] as Array<[string, string]>,
  unpaired: [] as string[],
}));

vi.mock("../src/services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "cle-admin",
  getPublicUrl: () => null,
}));
vi.mock("../src/services/jwt", () => ({
  hashToken: (value: string) => `h:${value}`,
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async (token: string) => {
    if (token.startsWith("jwt-profil-")) {
      // Le jeton se dit administrateur : la porte ne doit pas le croire.
      return { userId: "u-lea", username: "Léa", isAdmin: true, deviceId: "d", type: "paired_device", scope: "profile", pairingId: "pd-1" };
    }
    return token.startsWith("jwt-") ? { userId: "u1", username: "Damien", isAdmin: true, deviceId: "d", type: "paired_device" } : null;
  },
  verifyTvPairingToken: async (token: string) =>
    token.startsWith("tvp-") ? { type: "tv_pairing", pairingId: "pd-1", userId: "u1", username: "Damien", nonce: "n" } : null,
}));
vi.mock("../src/services/db", () => ({ hasPrisma: () => true, getPrisma: () => h.db!.client }));
vi.mock("../src/services/deviceSessions/deviceAuth", () => ({ pairedDeviceIdForHash: async (hash: string) => `derive-${hash}` }));
vi.mock("../src/services/deviceSessions/gateway", () => ({ endPairedDeviceSessions: async () => undefined }));
vi.mock("../src/services/wsManager", () => ({
  revokeDeviceByTokenHash: (hash: string) => h.unpaired.push(hash),
  endProfileSessionSockets: (hash: string, reason: string) => h.ended.push([hash, reason]),
}));

import { pairedDevicesRoutes } from "../src/routes/pairing/devices";
import { authRefreshRoutes } from "../src/routes/authRefresh";
import { requireAdmin, requireAuth } from "../src/middleware/auth";
import { resetPairedDeviceStatusForTests } from "../src/services/pairedDeviceStatus";

const PAIRING = "tvp-salon.a.b";
const PROFILE = "jwt-profil-lea.a.b";
const OWNER_TV = "jwt-chambre.a.b";

let app: FastifyInstance;

beforeAll(async () => {
  vi.stubGlobal("fetch", vi.fn(fakeJellyfinFetch(createFakeJellyfin())));
  app = Fastify();
  app.get("/api/protected", { preHandler: [requireAuth] }, async (request) => ({ user: (request as unknown as { user: unknown }).user }));
  app.get("/api/admin-only", { preHandler: [requireAdmin] }, async () => ({ ok: true }));
  await app.register(pairedDevicesRoutes, { prefix: "/api/pair" });
  await app.register(authRefreshRoutes, { prefix: "/api/auth" });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  h.db = createPairingDb();
  h.ended = [];
  h.unpaired = [];
  resetPairedDeviceStatusForTests();
  // pd-1 : la TV du salon, passée aux profils ; pd-2 : la session de Léa dessus ; pd-3 : une TV d'avant.
  await h.db.client.pairedDevice.create({
    data: { tokenHash: `h:${PAIRING}`, jellyfinUserId: "u1", name: "Apple TV", profilesSince: new Date(), stickyProfileId: "u-lea" },
  });
  await h.db.client.pairedDevice.create({
    data: { tokenHash: `h:${PROFILE}`, jellyfinUserId: "u-lea", name: "Apple TV", parentId: "pd-1", profileKind: "member" },
  });
  await h.db.client.pairedDevice.create({ data: { tokenHash: `h:${OWNER_TV}`, jellyfinUserId: "u1", name: "Apple TV 2" } });
});

const as = (token: string) => ({ authorization: `Bearer ${token}` });
const rows = () => h.db!.state.devices.map((d) => d.id).sort();

describe("une session de profil aux portes", () => {
  it("passe comme le compte du profil, jamais administratrice", async () => {
    const res = await app.inject({ method: "GET", url: "/api/protected", headers: as(PROFILE) });
    expect(res.json().user).toEqual({ userId: "u-lea", username: "Léa", isAdmin: false, session: "tvProfile", pairingId: "pd-1" });
    expect((await app.inject({ method: "GET", url: "/api/admin-only", headers: as(PROFILE) })).statusCode).toBe(403);
  });

  it("se ferme seule : la TV reste jumelée, « Rester sur ce profil » s'en va", async () => {
    const res = await app.inject({ method: "POST", url: "/api/pair/self/revoke", headers: as(PROFILE) });
    expect(res.json()).toEqual({ revoked: true });
    expect(rows()).toEqual(["pd-1", "pd-3"]);
    expect(h.ended).toEqual([[`h:${PROFILE}`, "closed"]]);
    expect(h.unpaired).toEqual([]);
    expect(h.db!.state.devices.find((d) => d.id === "pd-1")?.stickyProfileId).toBeNull();
    const after = await app.inject({ method: "GET", url: "/api/protected", headers: as(PROFILE) });
    expect(after.statusCode).toBe(401);
    expect(after.json()).toMatchObject({ revoked: true, profileEnded: true });
    const refresh = await app.inject({ method: "POST", url: "/api/auth/refresh", payload: { token: PROFILE } });
    expect(refresh.json()).toMatchObject({ revoked: true, profileEnded: true });
  });

  it("part avec son jumelage : le jeton de jumelage déjumelle la TV et ses sessions", async () => {
    const res = await app.inject({ method: "POST", url: "/api/pair/self/revoke", headers: as(PAIRING) });
    expect(res.json()).toEqual({ revoked: true });
    expect(rows()).toEqual(["pd-3"]);
    expect(h.ended).toEqual([[`h:${PROFILE}`, "unpaired"]]);
    expect(h.unpaired).toEqual([`h:${PAIRING}`]);
  });

  it("l'admin qui déjumelle la TV emporte ses sessions de profil", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/pair/devices/pd-1", headers: as(OWNER_TV) });
    expect(res.statusCode).toBe(200);
    expect(rows()).toEqual(["pd-3"]);
    expect(h.ended.map(([, reason]) => reason)).toEqual(["unpaired"]);
  });
});

describe("le jeton de jumelage « profils seuls »", () => {
  it("n'ouvre aucune autre porte", async () => {
    const res = await app.inject({ method: "GET", url: "/api/protected", headers: as(PAIRING) });
    expect(res.statusCode).toBe(401);
    expect(res.json().revoked).toBeUndefined();
  });
});

describe("les listes d'appareils", () => {
  it("ne montrent jamais une session de profil ; une session de profil n'y touche pas", async () => {
    const mine = await app.inject({ method: "GET", url: "/api/pair/my-devices", headers: as(OWNER_TV) });
    expect(mine.json().map((d: { id: string }) => d.id).sort()).toEqual(["pd-1", "pd-3"]);
    const all = await app.inject({ method: "GET", url: "/api/pair/devices", headers: as(OWNER_TV) });
    expect(all.json()).toHaveLength(2);
    // Une session de profil n'atteint pas le jumelage (périmètre de la Famille).
    const child = await app.inject({ method: "DELETE", url: "/api/pair/my-devices/pd-2", headers: as(PROFILE) });
    expect(child.statusCode).toBe(403);
    expect(child.json().code).toBe("family.personal_session_required");
    expect(h.db!.state.devices.map((d) => d.id)).toContain("pd-2");
  });
});
