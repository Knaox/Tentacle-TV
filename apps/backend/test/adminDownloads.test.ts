/**
 * Tests /api/admin/downloads — LE point critique : POST /Users/{id}/Policy est
 * un remplacement intégral côté Jellyfin ; on vérifie que le corps envoyé est
 * TOUJOURS la policy complète (tous les champs d'origine préservés, y compris
 * AuthenticationProviderId dont l'absence crashe Jellyfin) + relecture.
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** La table de configuration, réduite à une Map : ce que les routes y écrivent s'y relit. */
const configStore = vi.hoisted(() => new Map<string, string>());
vi.mock("../src/services/configStore", async () => {
  const { parseCap } = await import("../src/services/downloadBandwidth/caps");
  return {
    getJellyfinUrl: () => "http://jf.test",
    getJellyfinApiKey: () => "admin-key",
    setConfigValue: async (key: string, value: string) => {
      configStore.set(key, value);
    },
    deleteConfigValue: async (key: string) => {
      configStore.delete(key);
    },
    getDownloadBandwidthConfig: () => ({
      external: parseCap(configStore.get("download_bandwidth_external_bps")),
      internal: parseCap(configStore.get("download_bandwidth_internal_bps")),
    }),
  };
});
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

import { adminDownloadRoutes } from "../src/routes/adminDownloads";

const USER_ID = "c".repeat(32);

/** Policy riche — le merge doit préserver TOUT ce qui n'est pas patché. */
const basePolicy = () => ({
  IsAdministrator: false,
  IsDisabled: false,
  EnableContentDownloading: true,
  EnableMediaConversion: true,
  EnableAllFolders: false,
  EnabledFolders: ["1111aaaa-bbbb-cccc-dddd-eeeeffff0000"],
  BlockedMediaFolders: [],
  EnableVideoPlaybackTranscoding: true,
  RemoteClientBitrateLimit: 12_000_000,
  AuthenticationProviderId: "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
  PasswordResetProviderId: "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider",
});

let serverPolicy: Record<string, unknown>;
let lastPostedPolicy: Record<string, unknown> | null;

function fakeJellyfin(input: RequestInfo | URL, init?: RequestInit): Response {
  const url = String(input);
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  const auth = headers.get("authorization") ?? "";
  const token = auth.match(/Token="([^"]+)"/)?.[1] ?? headers.get("x-emby-token");

  // Auth du middleware requireAdmin (Users/Me avec le token utilisateur).
  if (url.endsWith("/Users/Me")) {
    if (token === "tok-admin") {
      return Response.json({ Id: "admin-1", Name: "Admin", Policy: { IsAdministrator: true } });
    }
    if (token === "tok-user") {
      return Response.json({ Id: "user-1", Name: "User", Policy: { IsAdministrator: false } });
    }
    return new Response("", { status: 401 });
  }

  if (token !== "admin-key") return new Response("", { status: 401 });

  if (url.endsWith("/Users") && method === "GET") {
    return Response.json([{ Id: USER_ID, Name: "Alice", Policy: serverPolicy }]);
  }
  if (url.includes(`/Users/${USER_ID}/Policy`) && method === "POST") {
    lastPostedPolicy = JSON.parse(String(init?.body)) as Record<string, unknown>;
    serverPolicy = lastPostedPolicy;
    // 204 = statut sans corps : le constructeur Response exige null.
    return new Response(null, { status: 204 });
  }
  if (url.includes(`/Users/${USER_ID}`) && method === "GET") {
    return Response.json({ Id: USER_ID, Name: "Alice", Policy: serverPolicy });
  }
  return new Response("", { status: 404 });
}

async function buildApp() {
  const app = Fastify();
  await app.register(adminDownloadRoutes, { prefix: "/api/admin/downloads" });
  return app;
}

beforeEach(() => {
  serverPolicy = basePolicy();
  lastPostedPolicy = null;
  configStore.clear();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    fakeJellyfin(input, init),
  ));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/api/admin/downloads", () => {
  it("liste les utilisateurs avec leurs droits", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: "/api/admin/downloads/users",
      headers: { authorization: "Bearer tok-admin" },
    });
    expect(res.statusCode).toBe(200);
    const users = res.json() as Array<Record<string, unknown>>;
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      id: USER_ID,
      name: "Alice",
      enableContentDownloading: true,
      enableMediaConversion: true,
      enableAllFolders: false,
      enabledFoldersCount: 1,
    });
  });

  it("PUT envoie TOUJOURS la policy complète mergée (jamais un objet partiel)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/downloads/users/${USER_ID}`,
      headers: { authorization: "Bearer tok-admin" },
      payload: { enableContentDownloading: false },
    });
    expect(res.statusCode).toBe(200);
    expect(lastPostedPolicy).not.toBeNull();
    const posted = lastPostedPolicy as Record<string, unknown>;
    // Champ patché…
    expect(posted.EnableContentDownloading).toBe(false);
    // …et TOUS les autres préservés à l'identique.
    expect(posted.EnableMediaConversion).toBe(true);
    expect(posted.EnabledFolders).toEqual(["1111aaaa-bbbb-cccc-dddd-eeeeffff0000"]);
    expect(posted.RemoteClientBitrateLimit).toBe(12_000_000);
    expect(posted.AuthenticationProviderId).toBe(
      "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
    );
    expect(posted.PasswordResetProviderId).toBe(
      "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider",
    );
    // La réponse reflète la RELECTURE Jellyfin.
    expect(res.json()).toMatchObject({ enableContentDownloading: false, enableMediaConversion: true });
  });

  it("toggle Allégé seul → EnableMediaConversion écrit, téléchargement intact", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/downloads/users/${USER_ID}`,
      headers: { authorization: "Bearer tok-admin" },
      payload: { enableMediaConversion: false },
    });
    expect(res.statusCode).toBe(200);
    const posted = lastPostedPolicy as Record<string, unknown>;
    expect(posted.EnableMediaConversion).toBe(false);
    expect(posted.EnableContentDownloading).toBe(true);
  });

  it("non-admin → 403 ; patch vide → 400", async () => {
    const app = await buildApp();
    const forbidden = await app.inject({
      method: "PUT",
      url: `/api/admin/downloads/users/${USER_ID}`,
      headers: { authorization: "Bearer tok-user" },
      payload: { enableContentDownloading: false },
    });
    expect(forbidden.statusCode).toBe(403);

    const empty = await app.inject({
      method: "PUT",
      url: `/api/admin/downloads/users/${USER_ID}`,
      headers: { authorization: "Bearer tok-admin" },
      payload: {},
    });
    expect(empty.statusCode).toBe(400);
  });
});

describe("/api/admin/downloads/bandwidth", () => {
  const MIB = 1024 * 1024;
  const put = async (payload: unknown, token = "tok-admin") => {
    const app = await buildApp();
    return app.inject({
      method: "PUT",
      url: "/api/admin/downloads/bandwidth",
      headers: { authorization: `Bearer ${token}` },
      payload: payload as Record<string, unknown>,
    });
  };

  it("par défaut, les deux plafonds sont illimités", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: "/api/admin/downloads/bandwidth",
      headers: { authorization: "Bearer tok-admin" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ external: null, internal: null });
  });

  it("PUT écrit les plafonds, efface l'illimité, et répond par la relecture", async () => {
    const res = await put({ external: 6 * MIB, internal: null });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ external: 6 * MIB, internal: null });
    expect(configStore.get("download_bandwidth_external_bps")).toBe(String(6 * MIB));
    expect(configStore.has("download_bandwidth_internal_bps")).toBe(false);

    const cleared = await put({ external: null, internal: 2 * MIB });
    expect(cleared.json()).toEqual({ external: null, internal: 2 * MIB });
    expect(configStore.has("download_bandwidth_external_bps")).toBe(false);
  });

  it("refuse ce qui n'est pas un entier borné, ou un état incomplet", async () => {
    for (const payload of [
      { external: MIB + 0.5, internal: null },
      { external: 1, internal: null },
      { external: "6", internal: null },
      { external: null },
      { external: 10 * 1024 ** 3 + 1, internal: null },
    ]) {
      const res = await put(payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(res.json()).toEqual({ error: "invalid-bandwidth" });
    }
    expect(configStore.size).toBe(0);
  });

  it("non-admin → 403", async () => {
    const res = await put({ external: 6 * MIB, internal: null }, "tok-user");
    expect(res.statusCode).toBe(403);
  });
});
