/**
 * L'accès du compte aux portes du serveur (docs/DROITS-UTILISATEURS.md § 9.1) :
 * désactivé ou hors de ses plages, un compte ne se sert plus de Tentacle — ni
 * par une route du cœur (`requireAuth`, qui sert avec la clé d'administration),
 * ni par le proxy avec la clé prêtée à sa TV, ni avec un jeton Jellyfin que
 * Jellyfin refuse. 403 `account_access` avec l'état, jamais 401 : le client ne
 * se déconnecte pas. Administrateurs compris ; « voir en tant que » non borné.
 * La route d'état reste ouverte.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  url: "",
  outside: new Set<string>(),
  disabled: new Set<string>(),
  /** Ce que `/Users/Me` répond à un jeton Jellyfin (défaut : 200, l'enfant). */
  me: new Map<string, number>(),
  /** Ce que le reste de Jellyfin répond au jeton natif de l'enfant (défaut : 200). */
  items: 200,
  hits: 0,
  /** La politique gardée en cache date d'avant la désactivation. */
  staleCache: false,
}));
const JWT_HEAD = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
const TV_CHILD = `${JWT_HEAD}.tv-enfant.sig`;
const TV_ADMIN = `${JWT_HEAD}.tv-admin.sig`;
const VIEW_AS_CHILD = `${JWT_HEAD}.voir-enfant.sig`;
const NEVER: { dayOfWeek: "Everyday"; startHour: number; endHour: number }[] = [{ dayOfWeek: "Everyday", startHour: 0, endHour: -1 }];

vi.mock("../../src/services/configStore", () => ({ getJellyfinUrl: () => state.url, getJellyfinApiKey: () => "cle-admin" }));
vi.mock("../../src/services/contentPolicy", () => ({
  getContentPolicy: async (userId: string) => ({
    readable: true,
    isDisabled: state.disabled.has(userId) && !state.staleCache,
    accessSchedules: state.outside.has(userId) ? NEVER : [],
  }),
  // La relecture à frais neufs : ce que Jellyfin dit vraiment.
  contentPolicyFromJellyfin: (_userId: string, policy: Record<string, unknown>) => ({
    readable: true,
    isDisabled: policy.IsDisabled === true,
    accessSchedules: [],
  }),
  invalidateContentPolicy: () => undefined,
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
import { accountAccessRoutes } from "../../src/routes/accountAccess";
import { requireAuth, requireSessionAnyAccess } from "../../src/middleware/auth";
import { resetPairedDeviceStatusForTests } from "../../src/services/pairedDeviceStatus";
import { resetTokenOwnersForTests } from "../../src/services/accountAccess/tokenOwners";
import { clearAll } from "../../src/services/jellyfinCache";

let jellyfin: http.Server;
let app: FastifyInstance;

function tokenOf(req: http.IncomingMessage): string {
  const header = String(req.headers.authorization ?? req.headers["x-emby-token"] ?? "");
  return /Token="([^"]+)"/.exec(header)?.[1] ?? header;
}

beforeAll(async () => {
  jellyfin = http.createServer((req, res) => {
    state.hits++;
    const token = tokenOf(req);
    const status = req.url === "/Users/Me" ? (state.me.get(token) ?? 200) : token === "cle-admin" ? 200 : state.items;
    res.writeHead(status, { "content-type": "application/json" });
    const fresh = req.url === "/Users/enfant" ? { Id: "enfant", Policy: { IsDisabled: state.disabled.has("enfant") } } : { Items: [] };
    res.end(status === 200 ? JSON.stringify(req.url === "/Users/Me" ? { Id: "enfant", Name: "Enfant", Policy: { IsAdministrator: false } } : fresh) : "");
  });
  await new Promise<void>((resolve) => jellyfin.listen(0, "127.0.0.1", resolve));
  state.url = `http://127.0.0.1:${(jellyfin.address() as AddressInfo).port}`;
  app = Fastify();
  app.get("/api/protected", { preHandler: requireAuth }, async () => ({ ok: true }));
  app.post("/api/leave", { preHandler: requireSessionAnyAccess }, async () => ({ ok: true }));
  await app.register(accountAccessRoutes, { prefix: "/api/account" });
  await app.register(jellyfinProxyRoutes, { prefix: "/api/jellyfin" });
});

afterAll(async () => {
  await app.close();
  jellyfin.closeAllConnections();
  await new Promise<void>((resolve) => jellyfin.close(() => resolve()));
});

beforeEach(() => {
  state.outside.clear();
  state.disabled.clear();
  state.me.clear();
  state.items = 200;
  state.hits = 0;
  state.staleCache = false;
  clearAll();
  resetPairedDeviceStatusForTests();
  resetTokenOwnersForTests();
});

const call = (url: string, token: string, method: "GET" | "POST" = "GET") =>
  app.inject({ method, url, headers: { "x-emby-token": token } });
const OUTSIDE = { error: "account_access", state: "outsideSchedule", schedules: NEVER, nextOpening: null };

describe("accès du compte aux portes", () => {
  it("permis : tout passe", async () => {
    expect((await call("/api/protected", TV_CHILD)).statusCode).toBe(200);
    expect((await call("/api/protected", "natif-1")).statusCode).toBe(200);
    expect((await call("/api/jellyfin/Items?Recursive=true", TV_CHILD)).statusCode).toBe(200);
    expect((await call("/api/account/access", TV_CHILD)).json()).toEqual({ state: "allowed" });
  });

  it("hors plage : 403 avec les plages, aux routes du cœur et au proxy de la TV — rien ne part chez Jellyfin", async () => {
    state.outside.add("enfant");
    for (const token of [TV_CHILD, "natif-2"]) {
      const res = await call("/api/protected", token);
      expect([res.statusCode, res.json()]).toEqual([403, OUTSIDE]);
    }
    state.hits = 0;
    expect((await call("/api/jellyfin/Items?Recursive=true", TV_CHILD)).statusCode).toBe(403);
    expect((await call("/api/jellyfin/Videos/abc/stream?static=true", TV_CHILD)).statusCode).toBe(403);
    expect(state.hits).toBe(0);
  });

  it("désactivé : 403 `disabled`", async () => {
    state.disabled.add("enfant");
    const res = await call("/api/protected", TV_CHILD);
    expect([res.statusCode, res.json()]).toEqual([403, { error: "account_access", state: "disabled" }]);
  });

  it("administrateurs compris ; « voir en tant que » non borné", async () => {
    state.outside.add("enfant");
    state.outside.add("admin");
    expect((await call("/api/protected", TV_ADMIN)).statusCode).toBe(403);
    expect((await call("/api/protected", VIEW_AS_CHILD)).statusCode).toBe(200);
    expect((await call("/api/account/access", VIEW_AS_CHILD)).json()).toEqual({ state: "allowed" });
  });

  it("la route d'état et la sortie restent ouvertes à un compte bloqué", async () => {
    state.outside.add("enfant");
    const res = await call("/api/account/access", TV_CHILD);
    expect([res.statusCode, res.json()]).toEqual([200, { state: "outsideSchedule", schedules: NEVER, nextOpening: null }]);
    expect((await call("/api/leave", TV_CHILD, "POST")).statusCode).toBe(200);
  });
});

describe("jeton Jellyfin refusé par Jellyfin", () => {
  it("compte connu, hors plage : Jellyfin dit 403 → 403 `account_access`, jamais 401", async () => {
    expect((await call("/api/protected", "natif-3")).statusCode).toBe(200); // vu valide : son compte est retenu
    state.outside.add("enfant");
    state.me.set("natif-3", 403);
    state.items = 403;
    expect((await call("/api/account/access", "natif-3")).json()).toMatchObject({ state: "outsideSchedule", schedules: NEVER });
    const proxied = await call("/api/jellyfin/Items?Recursive=true", "natif-3");
    expect([proxied.statusCode, proxied.json()]).toEqual([403, OUTSIDE]);
  });

  it("compte connu, désactivé : Jellyfin a révoqué le jeton (401) → 403 `disabled`", async () => {
    expect((await call("/api/protected", "natif-4")).statusCode).toBe(200);
    state.disabled.add("enfant");
    state.me.set("natif-4", 401);
    state.items = 401;
    const proxied = await call("/api/jellyfin/Items?Recursive=true", "natif-4");
    expect([proxied.statusCode, proxied.json()]).toEqual([403, { error: "account_access", state: "disabled" }]);
  });

  it("désactivé à l'instant (politique encore en cache « permis ») : le refus de Jellyfin la fait relire — 403, jamais 401", async () => {
    expect((await call("/api/protected", "natif-8")).statusCode).toBe(200);
    state.disabled.add("enfant");
    state.staleCache = true;
    state.me.set("natif-8", 401);
    state.items = 401;
    const proxied = await call("/api/jellyfin/Items?Recursive=true", "natif-8");
    expect([proxied.statusCode, proxied.json()]).toEqual([403, { error: "account_access", state: "disabled" }]);
  });

  it("compte inconnu : un 403 de /Users/Me vaut « hors plage, plages inconnues » ; un 401 reste un jeton invalide", async () => {
    state.me.set("natif-5", 403);
    const res = await call("/api/account/access", "natif-5");
    expect([res.statusCode, res.json()]).toEqual([200, { state: "outsideSchedule", schedules: [], nextOpening: null }]);
    expect((await call("/api/protected", "natif-5")).statusCode).toBe(403);
    state.me.set("natif-6", 401);
    expect((await call("/api/protected", "natif-6")).statusCode).toBe(401);
  });

  it("un 403 du proxy pour un droit manquant passe tel quel (le compte n'est pas bloqué)", async () => {
    expect((await call("/api/protected", "natif-7")).statusCode).toBe(200);
    state.items = 403;
    const res = await call("/api/jellyfin/Items/abc", "natif-7");
    expect(res.statusCode).toBe(403);
    expect(res.body).toBe("");
  });
});
