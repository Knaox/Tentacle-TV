/**
 * Tests des routes /api/downloads — garde de droits, réponse générique,
 * périmètre par bibliothèque (normalisation des GUIDs), pipe avec Range.
 * Upstream Jellyfin ENTIÈREMENT mocké via le fetch global ; configStore/jwt/db
 * mockés pour isoler le middleware d'auth réel (il valide contre /Users/Me).
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
}));
vi.mock("../src/services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../src/services/db", () => ({
  hasPrisma: () => false,
  getPrisma: () => {
    throw new Error("no prisma in tests");
  },
}));

import { downloadRoutes } from "../src/routes/downloads";
import { clearPolicyCache } from "../src/services/jellyfinPolicy";
import { fakeJellyfin, ITEM_IN_A, ITEM_IN_B, streamCapture } from "./fakeJellyfinDownloads";

async function buildApp() {
  const app = Fastify();
  await app.register(downloadRoutes, { prefix: "/api/downloads" });
  return app;
}

beforeEach(() => {
  clearPolicyCache();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    fakeJellyfin(input, init),
  ));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/downloads/capabilities", () => {
  it("droits complets → downloads + lightDownloads", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: "/api/downloads/capabilities",
      headers: { authorization: "Bearer tok-full" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      downloads: true,
      lightDownloads: true,
      lightPresets: ["p1080", "p720", "p480", "pmax"],
    });
  });

  it("sans droit de téléchargement → tout à false (indiscernable d'une feature éteinte)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: "/api/downloads/capabilities",
      headers: { authorization: "Bearer tok-nodl" },
    });
    expect(res.json()).toEqual({ downloads: false, lightDownloads: false, lightPresets: [] });
  });

  it("téléchargement OK mais conversion refusée → lightDownloads false", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: "/api/downloads/capabilities",
      headers: { authorization: "Bearer tok-noconv" },
    });
    expect(res.json()).toEqual({ downloads: true, lightDownloads: false, lightPresets: [] });
  });

  it("sans token → 401 du middleware (uniforme app-wide)", async () => {
    const app = await buildApp();
    const res = await app.inject({ url: "/api/downloads/capabilities" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/downloads/original/:itemId", () => {
  it("avec droit → 200, corps relayé, en-têtes de reprise présents", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/original/${ITEM_IN_A}`,
      headers: { authorization: "Bearer tok-full" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("FAKEDATA");
    expect(res.headers["accept-ranges"]).toBe("bytes");
    expect(res.headers["content-disposition"]).toContain("film.mkv");
  });

  it("sans droit → 404 générique, sans divulgation", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/original/${ITEM_IN_A}`,
      headers: { authorization: "Bearer tok-nodl" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Not found" });
  });

  it("périmètre bibliothèques : whitelist AVEC tirets vs ancêtre SANS tirets", async () => {
    const app = await buildApp();
    const allowed = await app.inject({
      url: `/api/downloads/original/${ITEM_IN_A}`,
      headers: { authorization: "Bearer tok-scoped" },
    });
    expect(allowed.statusCode).toBe(200);

    const denied = await app.inject({
      url: `/api/downloads/original/${ITEM_IN_B}`,
      headers: { authorization: "Bearer tok-scoped" },
    });
    expect(denied.statusCode).toBe(404);
    expect(denied.json()).toEqual({ error: "Not found" });
  });

  it("bibliothèque bloquée : la blacklist GAGNE sur EnableAllFolders", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/original/${ITEM_IN_A}`,
      headers: { authorization: "Bearer tok-blocked" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("Range relayé dans les deux sens (206 + content-range)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/original/${ITEM_IN_A}`,
      headers: { authorization: "Bearer tok-full", range: "bytes=2-5" },
    });
    expect(res.statusCode).toBe(206);
    expect(res.headers["content-range"]).toBe("bytes 2-5/8");
    expect(res.body).toBe("KEDA");
  });

  it("itemId non conforme → 404 générique", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: "/api/downloads/original/..%2Fadmin",
      headers: { authorization: "Bearer tok-full" },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/downloads/light/:itemId", () => {
  it("avec droit → 200 fMP4, session de transcodage exposée, paramètres corrects", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/light/${ITEM_IN_A}?preset=p720&audioStreamIndex=2`,
      headers: { authorization: "Bearer tok-full" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("LIGHTDATA");
    expect(res.headers["x-tentacle-play-session"]).toBeTruthy();
    expect(res.headers["x-tentacle-device-id"]).toContain("tentacle-dl-");
    expect(streamCapture.lastUrl).toContain("static=false");
    expect(streamCapture.lastUrl).toContain("videoCodec=h264");
    expect(streamCapture.lastUrl).toContain("videoBitRate=4000000");
    expect(streamCapture.lastUrl).toContain("maxHeight=720");
    expect(streamCapture.lastUrl).toContain("audioStreamIndex=2");
    expect(streamCapture.lastUrl).not.toContain("subtitleMethod");
  });

  it("burn-in demandé → subtitleStreamIndex + subtitleMethod=Encode transmis", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/light/${ITEM_IN_A}?preset=p480&burnSubtitleIndex=5`,
      headers: { authorization: "Bearer tok-full" },
    });
    expect(res.statusCode).toBe(200);
    expect(streamCapture.lastUrl).toContain("subtitleStreamIndex=5");
    expect(streamCapture.lastUrl).toContain("subtitleMethod=Encode");
  });

  it("sans droit de conversion → 404 générique (même avec droit de téléchargement)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/light/${ITEM_IN_A}?preset=p720`,
      headers: { authorization: "Bearer tok-noconv" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Not found" });
  });

  it("preset inconnu → 404 générique", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/light/${ITEM_IN_A}?preset=p4000`,
      headers: { authorization: "Bearer tok-full" },
    });
    expect(res.statusCode).toBe(404);
  });
});
