/**
 * SEC-F-34 — Un jeton d'appareil ne doit JAMAIS obtenir la clé d'administration
 * pour une MUTATION arbitraire de Jellyfin.
 *
 * Faille existante, signalée par le coordinateur (à corriger par T2) : le proxy
 * substitue la clé admin au JWT de TOUT appareil jumelé, et la garde de
 * périmètre (`userScope`) ne regarde que les routes `/Users/{id}/…`. Or la
 * liste blanche laisse passer `Items/{id}` en TOUTES méthodes : un appareil
 * jumelé pouvait donc `DELETE /api/jellyfin/Items/{id}` (supprimer un média) ou
 * `POST` dessus, exécuté chez Jellyfin avec les pleins pouvoirs de la clé admin.
 *
 * L'invariant de sécurité visé : une requête MUTANTE (DELETE/POST/PUT) portée
 * par un jeton d'appareil, sur une route qui n'est pas une route de session
 * autorisée, est refusée AVANT d'atteindre Jellyfin — et surtout Jellyfin ne
 * reçoit jamais cette mutation avec la clé admin.
 *
 * EN ATTENTE DE LA CORRECTION DE T2 (`describe.skip`) : rouge tant que le proxy
 * substitue encore la clé admin. Dé-skipper une fois la correction fusionnée.
 * T2 ne modifie pas ce test ; il le fait passer. Refus net attendu = 403
 * (toléré : 401 si le proxy relaie sans clé admin et Jellyfin refuse).
 *
 * Harnais calqué sur `test/deviceRevocationDoors.test.ts` : un vrai serveur
 * HTTP local joue Jellyfin, les jetons sont des JWT factices, la base est en
 * mémoire.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  url: "",
  hits: [] as Array<{ method: string; url: string; auth: string }>,
  rows: new Set<string>(),
}));

vi.mock("../../src/services/configStore", () => ({
  getJellyfinUrl: () => state.url,
  getJellyfinApiKey: () => "cle-admin",
}));
vi.mock("../../src/services/jwt", () => ({
  hashToken: (value: string) => `h:${value}`,
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async (token: string) =>
    token.startsWith("jwt-")
      ? { userId: "u1", username: "Knaoxtest", isAdmin: false, deviceId: "d", type: "paired_device" }
      : null,
}));
vi.mock("../../src/services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    pairedDevice: {
      findUnique: async (args: { where: { tokenHash: string } }) =>
        state.rows.has(args.where.tokenHash)
          ? { id: args.where.tokenHash, name: "Apple TV", jellyfinUserId: "u1", jellyfinAccessToken: null, jellyfinDeviceId: null }
          : null,
      updateMany: async () => ({ count: 1 }),
    },
  }),
}));
vi.mock("../../src/services/wsManager", () => ({ broadcastToUser: () => {} }));

import { jellyfinProxyRoutes } from "../../src/routes/jellyfinProxy";
import { resetPairedDeviceStatusForTests } from "../../src/services/pairedDeviceStatus";
import { clearAll } from "../../src/services/jellyfinCache";

const DEVICE = "jwt-salon.charge.signature";

let jellyfin: http.Server;
let app: FastifyInstance;
let base = "";

/** Une mutation a-t-elle atteint Jellyfin en portant la clé admin ? */
function adminMutationsReached(): Array<{ method: string; url: string; auth: string }> {
  return state.hits.filter(
    (h) => h.method !== "GET" && h.method !== "HEAD" && h.auth.includes('Token="cle-admin"'),
  );
}

// `describe.skip` : les hooks sont À L'INTÉRIEUR pour qu'aucun serveur ne soit
// monté tant que le test attend la correction de T2 (les hooks de niveau
// fichier tournent même quand tous les describe sont skippés). Au dé-skip,
// ils s'exécutent normalement.
describe.skip("SEC-F-34 : un jeton d'appareil ne mute pas Jellyfin avec la clé admin (attend la correction proxy de T2)", () => {
  beforeAll(async () => {
    jellyfin = http.createServer((req, res) => {
      const auth = String(req.headers.authorization ?? req.headers["x-emby-token"] ?? "");
      state.hits.push({ method: req.method ?? "", url: req.url ?? "", auth });
      // La clé admin, si le proxy la substitue : Jellyfin « exécute » la mutation.
      if (!auth.includes('Token="cle-admin"')) {
        res.writeHead(401);
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => jellyfin.listen(0, "127.0.0.1", resolve));
    state.url = `http://127.0.0.1:${(jellyfin.address() as AddressInfo).port}`;

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
    resetPairedDeviceStatusForTests();
    state.hits = [];
    state.rows = new Set([`h:${DEVICE}`]);
  });

  it("DELETE /Items/:id est refusé et n'atteint jamais Jellyfin avec la clé admin", async () => {
    const res = await fetch(`${base}/api/jellyfin/Items/abc123`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${DEVICE}` },
    });
    expect([401, 403]).toContain(res.status);
    expect(adminMutationsReached()).toEqual([]);
  });

  it("POST /Items/:id est refusé et n'atteint jamais Jellyfin avec la clé admin", async () => {
    const res = await fetch(`${base}/api/jellyfin/Items/abc123`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DEVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ Name: "pirate" }),
    });
    expect([401, 403]).toContain(res.status);
    expect(adminMutationsReached()).toEqual([]);
  });

  it("le même jeton garde sa lecture légitime (GET Items dans son périmètre) — non-régression", async () => {
    // La correction ne doit pas casser la lecture : un GET reste servi (par la
    // clé admin OU le jeton propre ; ici le faux Jellyfin répond à la clé admin).
    const res = await fetch(`${base}/api/jellyfin/Items?ParentId=x`, {
      headers: { "X-Emby-Token": DEVICE },
    });
    expect(res.status).toBe(200);
  });
});
