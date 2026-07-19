/**
 * Tests /api/admin/downloads — LE point critique : POST /Users/{id}/Policy est
 * un remplacement intégral côté Jellyfin ; on vérifie que le corps envoyé est
 * TOUJOURS la policy complète (tous les champs d'origine préservés, y compris
 * AuthenticationProviderId dont l'absence crashe Jellyfin) + relecture.
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "admin-key",
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
