/**
 * Les routes de la préparation tenue par le serveur : ce que le téléphone
 * reçoit (début, plage, refus de reprise), l'abandon, et la push silencieuse
 * « prêt » quand personne ne lisait.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const silent = vi.hoisted(() => vi.fn(async () => 1));

vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { headers: Record<string, string>; user?: unknown }) => {
    request.user = { userId: request.headers["x-test-user"] ?? "u1", username: "banc", isAdmin: false };
  },
  getTokenFromRequest: () => "jeton",
}));
vi.mock("../services/configStore", () => ({ getJellyfinUrl: () => "http://jellyfin.test" }));
vi.mock("../services/jellyfinPolicy", () => ({
  checkLightRight: async () => true,
  checkRemuxRight: async () => true,
  mediaBrowserAuthHeader: () => "MediaBrowser Token=jeton",
}));
vi.mock("../services/dataDir", () => ({ DATA_ROOT: mkdtempSync(join(tmpdir(), "tentacle-prepared-")) }));
vi.mock("../services/pushService", () => ({ sendSilentToUser: silent }));
vi.mock("../services/downloadBandwidth/throttledStream", () => ({ throttled: (_request: unknown, stream: unknown) => stream }));

import { preparedDownloadRoutes } from "./downloadsPrepared";
import { acquirePreparation, prepareRegistry } from "../services/offlinePrepare/offlinePrepare";
import { parseLightRequest } from "../services/offlinePrepare/lightStream";

const ITEM = "0123456789abcdef0123456789abcdef";
const URL_BASE = `/api/downloads/prepared/${ITEM}?preset=p720`;

let calls = 0;
beforeEach(() => {
  calls = 0;
  vi.stubGlobal("fetch", async () => {
    calls += 1;
    return new Response("0123456789", { status: 200 });
  });
});
afterEach(() => {
  for (const job of prepareRegistry.list()) prepareRegistry.release(job.key);
  vi.unstubAllGlobals();
  silent.mockClear();
});

async function makeApp() {
  const app = Fastify();
  await app.register(preparedDownloadRoutes, { prefix: "/api/downloads" });
  return app;
}

describe("GET /api/downloads/prepared/:itemId", () => {
  it("le premier appel lance la préparation et sert le fichier entier", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url: `${URL_BASE}&tag=appareil-1` });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("0123456789");
    expect(response.headers["accept-ranges"]).toBe("bytes");
    expect(calls).toBe(1);
  });

  it("une reprise de l'appareil qui l'a lue part de sa plage, sans relancer Jellyfin", async () => {
    const app = await makeApp();
    await app.inject({ method: "GET", url: `${URL_BASE}&tag=appareil-1` });
    const resumed = await app.inject({ method: "GET", url: `${URL_BASE}&tag=appareil-1`, headers: { range: "bytes=4-" } });
    expect(resumed.statusCode).toBe(206);
    expect(resumed.headers["content-range"]).toBe("bytes 4-9/10");
    expect(resumed.body).toBe("456789");
    expect(calls).toBe(1);
  });

  it("une reprise d'un appareil qui ne l'a jamais lue repart du début (son morceau vient d'ailleurs)", async () => {
    const app = await makeApp();
    await app.inject({ method: "GET", url: `${URL_BASE}&tag=appareil-1` });
    const other = await app.inject({ method: "GET", url: `${URL_BASE}&tag=appareil-2`, headers: { range: "bytes=4-" } });
    expect(other.statusCode).toBe(200);
    expect(other.body).toBe("0123456789");
  });

  it("un palier inconnu est un 404 générique", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url: `/api/downloads/prepared/${ITEM}?preset=p9000` });
    expect(response.statusCode).toBe(404);
  });
});

describe("abandon et état", () => {
  it("DELETE efface la préparation : l'état redevient « aucune »", async () => {
    const app = await makeApp();
    await app.inject({ method: "GET", url: URL_BASE });
    expect((await app.inject({ method: "GET", url: `/api/downloads/prepared/${ITEM}/status?preset=p720` })).json()).toEqual({
      state: "done",
      bytes: 10,
    });
    expect((await app.inject({ method: "DELETE", url: URL_BASE })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: `/api/downloads/prepared/${ITEM}/status?preset=p720` })).json()).toEqual({
      state: "none",
      bytes: 0,
    });
  });
});

describe("la push silencieuse « prêt »", () => {
  it("part quand la préparation s'achève sans personne pour la lire", async () => {
    const request = parseLightRequest(ITEM, { preset: "p720" })!;
    const job = acquirePreparation("cle-push", "u1", request, "jeton", "http://jellyfin.test");
    await vi.waitFor(() => expect(job.state).toBe("done"));
    expect(silent).toHaveBeenCalledWith("u1", { type: "offline:prepared", itemId: ITEM });
  });

  it("ne part pas quand un téléphone suivait la préparation jusqu'au bout", async () => {
    const app = await makeApp();
    await app.inject({ method: "GET", url: URL_BASE });
    expect(silent).not.toHaveBeenCalled();
  });
});
