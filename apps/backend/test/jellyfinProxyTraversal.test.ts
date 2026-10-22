/**
 * Le proxy de Jellyfin ne relaie que sa liste blanche de chemins — et un
 * appareil jumelé y voyage avec la clé d'ADMINISTRATION prêtée. Un chemin qui
 * passe la liste par son préfixe puis REMONTE (`..`, `%2e%2e`) ne doit jamais
 * atteindre une autre route de Jellyfin (`/System/Configuration`, `/Users`,
 * `/Auth/Keys`) : le chemin que Jellyfin recevrait doit lui-même être permis.
 *
 * Un vrai serveur HTTP local tient le rôle de Jellyfin ; les requêtes partent
 * par `http.request`, qui n'aplatit pas les `..` comme `fetch` le ferait.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ url: "", hits: [] as string[] }));

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
      findUnique: async () => ({ id: "salon", name: "Apple TV", jellyfinUserId: "u1", jellyfinAccessToken: null }),
      updateMany: async () => ({ count: 1 }),
    },
  }),
}));
vi.mock("../src/services/wsManager", () => ({ broadcastToUser: () => {} }));

import { jellyfinProxyRoutes } from "../src/routes/jellyfinProxy";
import { clearAll } from "../src/services/jellyfinCache";
import { resetPairedDeviceStatusForTests } from "../src/services/pairedDeviceStatus";

const TV = "jwt-salon.charge.signature";

let jellyfin: http.Server;
let app: FastifyInstance;
let port = 0;

beforeAll(async () => {
  jellyfin = http.createServer((req, res) => {
    state.hits.push(req.url ?? "");
    const isImage = /Images/.test(req.url ?? "");
    res.writeHead(200, { "content-type": isImage ? "image/jpeg" : "application/json" });
    res.end(isImage ? "jpeg" : JSON.stringify({ secret: "configuration du serveur" }));
  });
  await new Promise<void>((resolve) => jellyfin.listen(0, "127.0.0.1", resolve));
  state.url = `http://127.0.0.1:${(jellyfin.address() as AddressInfo).port}`;

  app = Fastify();
  await app.register(jellyfinProxyRoutes, { prefix: "/api/jellyfin" });
  await app.listen({ port: 0, host: "127.0.0.1" });
  port = (app.server.address() as AddressInfo).port;
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
});

/** Un GET au chemin BRUT, tel quel sur le fil (aucune normalisation). */
function rawGet(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path, method: "GET", headers: { authorization: `Bearer ${TV}` } }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode ?? 0));
    });
    req.on("error", reject);
    req.end();
  });
}

const ESCAPES = [
  "/api/jellyfin/Items/x/Images/../../../System/Configuration",
  "/api/jellyfin/Items/x/Images/%2e%2e/%2e%2e/%2e%2e/System/Configuration",
  "/api/jellyfin/Items/x/Images/%2E%2E/%2E%2E/%2E%2E/Users",
  "/api/jellyfin/Audio/x/../../Auth/Keys",
  "/api/jellyfin/DisplayPreferences/../System/Configuration",
  "/api/jellyfin/Genres/../Users",
  "/api/jellyfin/Users/u1/Items/../../../Auth/Keys",
  "/api/jellyfin/Items/x/Images/..%2f..%2f..%2fSystem/Configuration",
];

describe("proxy de Jellyfin : aucune remontée hors de la liste blanche", () => {
  it.each(ESCAPES)("refuse %s, sans rien demander à Jellyfin", async (path) => {
    const status = await rawGet(path);
    expect(status).toBe(403);
    expect(state.hits.filter((hit) => /System|Auth|\/Users(\?|$)/.test(hit))).toEqual([]);
  });

  it("un chemin permis passe toujours (une affiche)", async () => {
    expect(await rawGet("/api/jellyfin/Items/abc/Images/Primary")).toBe(200);
    expect(state.hits).toEqual(["/Items/abc/Images/Primary"]);
  });
});
