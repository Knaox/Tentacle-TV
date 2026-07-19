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

const LIB_A_DASHED = "1111aaaa-bbbb-cccc-dddd-eeeeffff0000";
const LIB_A_PLAIN = "1111aaaabbbbccccddddeeeeffff0000";
const LIB_B_PLAIN = "2222aaaabbbbccccddddeeeeffff0000";
const ITEM_IN_A = "a".repeat(32);
const ITEM_IN_B = "b".repeat(32);

interface FakePolicy {
  EnableContentDownloading: boolean;
  EnableMediaConversion: boolean;
  EnableVideoPlaybackTranscoding: boolean;
  EnableAudioPlaybackTranscoding: boolean;
  EnablePlaybackRemuxing: boolean;
  EnableAllFolders: boolean;
  EnabledFolders: string[];
  BlockedMediaFolders: string[] | null;
}

const basePolicy: FakePolicy = {
  EnableContentDownloading: true,
  EnableMediaConversion: true,
  EnableVideoPlaybackTranscoding: true,
  EnableAudioPlaybackTranscoding: true,
  EnablePlaybackRemuxing: true,
  EnableAllFolders: true,
  EnabledFolders: [],
  BlockedMediaFolders: null,
};

const POLICIES: Record<string, FakePolicy> = {
  "tok-full": { ...basePolicy },
  "tok-nodl": { ...basePolicy, EnableContentDownloading: false },
  "tok-noconv": { ...basePolicy, EnableMediaConversion: false },
  "tok-scoped": {
    ...basePolicy,
    EnableAllFolders: false,
    // Forme AVEC tirets côté policy, SANS tirets côté ancêtres → doit matcher.
    EnabledFolders: [LIB_A_DASHED],
  },
  "tok-blocked": { ...basePolicy, BlockedMediaFolders: [LIB_A_PLAIN] },
};

function tokenFromHeaders(headers: Headers): string | null {
  const emby = headers.get("x-emby-token");
  if (emby) return emby;
  const auth = headers.get("authorization") ?? "";
  const match = auth.match(/Token="([^"]+)"/);
  return match ? match[1] : null;
}

function fakeJellyfin(input: RequestInfo | URL, init?: RequestInit): Response {
  const url = String(input);
  const headers = new Headers(init?.headers);
  const token = tokenFromHeaders(headers);
  const policy = token ? POLICIES[token] : undefined;

  if (url.includes("/Users/Me")) {
    if (!policy) return new Response("", { status: 401 });
    return Response.json({ Id: `user-${token}`, Name: token, Policy: policy });
  }

  if (url.includes("/Ancestors")) {
    if (!policy) return new Response("", { status: 401 });
    const lib = url.includes(ITEM_IN_A) ? LIB_A_PLAIN : LIB_B_PLAIN;
    return Response.json([
      { Id: "season-1", Type: "Season" },
      { Id: "series-1", Type: "Series" },
      { Id: lib, Type: "CollectionFolder" },
    ]);
  }

  if (url.includes("/Download")) {
    if (!policy?.EnableContentDownloading) return new Response("", { status: 403 });
    const range = headers.get("range");
    if (range) {
      return new Response("KEDA", {
        status: 206,
        headers: {
          "content-type": "video/x-matroska",
          "content-length": "4",
          "content-range": "bytes 2-5/8",
          "accept-ranges": "bytes",
        },
      });
    }
    return new Response("FAKEDATA", {
      status: 200,
      headers: {
        "content-type": "video/x-matroska",
        "content-length": "8",
        "accept-ranges": "bytes",
        "content-disposition": 'attachment; filename="film.mkv"',
      },
    });
  }

  return new Response("", { status: 404 });
}

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
    expect(res.json()).toEqual({ downloads: true, lightDownloads: true });
  });

  it("sans droit de téléchargement → tout à false (indiscernable d'une feature éteinte)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: "/api/downloads/capabilities",
      headers: { authorization: "Bearer tok-nodl" },
    });
    expect(res.json()).toEqual({ downloads: false, lightDownloads: false });
  });

  it("téléchargement OK mais conversion refusée → lightDownloads false", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: "/api/downloads/capabilities",
      headers: { authorization: "Bearer tok-noconv" },
    });
    expect(res.json()).toEqual({ downloads: true, lightDownloads: false });
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
