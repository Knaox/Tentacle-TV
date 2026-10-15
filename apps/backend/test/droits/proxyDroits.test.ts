/**
 * Le proxy Jellyfin face aux droits d'un compte (docs/DROITS-UTILISATEURS.md
 * § 5 et § 7) : la clé d'administration prêtée à une TV ou à « voir en tant
 * que » ne lit jamais pour l'administrateur ; un flux ne part que vers un
 * compte qui voit son titre ; deux comptes ne partagent jamais une réponse
 * mise en cache.
 *
 * Un vrai serveur HTTP local joue Jellyfin : il répond en fonction du
 * `userId` reçu, comme Jellyfin (404 pour un titre hors des droits).
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  url: "",
  hits: [] as Array<{ method: string; url: string; auth: string }>,
}));

/** Les JWT ont tous le même début : c'est ce qui trompait la clé du cache. */
const JWT_HEAD = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
const TV_CHILD = `${JWT_HEAD}.tv-enfant.sig`;
const TV_ADULT = `${JWT_HEAD}.tv-adulte.sig`;
const VIEW_AS_CHILD = `${JWT_HEAD}.voir-enfant.sig`;
const NATIVE_CHILD = "jeton-jellyfin-enfant";
const FORBIDDEN = "f0".repeat(16);

vi.mock("../../src/services/configStore", () => ({
  getJellyfinUrl: () => state.url,
  getJellyfinApiKey: () => "cle-admin",
}));
vi.mock("../../src/services/jwt", () => ({
  hashToken: (value: string) => `h:${value}`,
  verifyImpersonationToken: async (token: string) =>
    token === VIEW_AS_CHILD ? { userId: "enfant", username: "Enfant", isAdmin: false, type: "impersonation" } : null,
  verifyDeviceToken: async (token: string) => {
    const user = token === TV_CHILD ? "enfant" : token === TV_ADULT ? "adulte" : null;
    return user ? { userId: user, username: user, isAdmin: false, deviceId: `d-${user}`, type: "paired_device" } : null;
  },
}));
vi.mock("../../src/services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    pairedDevice: {
      findUnique: async () => ({ id: "row", jellyfinUserId: "x", jellyfinAccessToken: null, jellyfinDeviceId: null }),
      updateMany: async () => ({ count: 1 }),
    },
  }),
}));
vi.mock("../../src/services/wsManager", () => ({ broadcastToUser: () => {} }));

import { jellyfinProxyRoutes } from "../../src/routes/jellyfinProxy";
import { resetPairedDeviceStatusForTests } from "../../src/services/pairedDeviceStatus";
import { clearAll } from "../../src/services/jellyfinCache";

let jellyfin: http.Server;
let app: FastifyInstance;

/** Ce que Jellyfin répond : la fiche d'un titre interdit à `enfant` est un 404. */
function fakeJellyfin(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = new URL(String(req.url), "http://jf");
  const user = url.searchParams.get("userId");
  if (url.pathname === "/Users/Me") {
    const native = /Token="([^"]*)"/.exec(String(req.headers.authorization))?.[1];
    res.writeHead(native === NATIVE_CHILD ? 200 : 401, { "content-type": "application/json" });
    res.end(JSON.stringify({ Id: "enfant", Name: "Enfant", Policy: { IsAdministrator: false } }));
    return;
  }
  if (url.pathname === `/Items/${FORBIDDEN}` && user === "enfant") {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ Items: [], answeredFor: user }));
}

beforeAll(async () => {
  jellyfin = http.createServer((req, res) => {
    state.hits.push({ method: String(req.method), url: String(req.url), auth: String(req.headers.authorization ?? "") });
    fakeJellyfin(req, res);
  });
  await new Promise<void>((resolve) => jellyfin.listen(0, "127.0.0.1", resolve));
  state.url = `http://127.0.0.1:${(jellyfin.address() as AddressInfo).port}`;
  app = Fastify();
  await app.register(jellyfinProxyRoutes, { prefix: "/api/jellyfin" });
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

function proxy(path: string, token: string) {
  return app.inject({ method: "GET", url: `/api/jellyfin/${path}`, headers: { "x-emby-token": token } });
}

describe("le cache du proxy ne mélange jamais deux comptes", () => {
  it("deux TV de comptes différents, même URL : chacune reçoit SA réponse", async () => {
    const adult = await proxy("Shows/NextUp?Limit=5", TV_ADULT);
    const child = await proxy("Shows/NextUp?Limit=5", TV_CHILD);
    expect(adult.json().answeredFor).toBe("adulte");
    expect(child.json().answeredFor).toBe("enfant");
  });

  it("un faux jeton qui commence comme un JWT ne lit pas l'entrée d'un autre", async () => {
    await proxy("Shows/NextUp?Limit=5", TV_ADULT);
    const before = state.hits.length;
    await proxy("Shows/NextUp?Limit=5", `${JWT_HEAD}.faux.sig`);
    expect(state.hits.length).toBe(before + 1);
  });
});
