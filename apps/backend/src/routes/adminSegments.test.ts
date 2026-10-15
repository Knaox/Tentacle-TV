/**
 * L'ancienne route admin de l'analyse audio, figée pour les bureaux livrés :
 * « coupée, sans outil », réservée aux administrateurs, et plus d'écriture.
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modernJellyfinToken } from "../../test/jellyfinFakeAuth";

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "admin-key",
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/db", () => ({
  hasPrisma: () => false,
  getPrisma: () => {
    throw new Error("pas de prisma dans ce banc");
  },
}));

import { adminSegmentRoutes } from "./adminSegments";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const token = modernJellyfinToken(init?.headers);
      if (url.endsWith("/Users/Me")) {
        if (token === "tok-admin") return Response.json({ Id: "admin-1", Name: "Admin", Policy: { IsAdministrator: true } });
        if (token === "tok-user") return Response.json({ Id: "user-1", Name: "Banc", Policy: { IsAdministrator: false } });
        return new Response("{}", { status: 401 });
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function call(method: "GET" | "PUT", token: string, body?: unknown) {
  const app = Fastify();
  await app.register(adminSegmentRoutes, { prefix: "/api/admin" });
  const response = await app.inject({
    method,
    url: "/api/admin/audio-analysis",
    headers: { "x-emby-token": token, "content-type": "application/json" },
    ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
  });
  await app.close();
  return response;
}

describe("GET /api/admin/audio-analysis (figée)", () => {
  it("rend « coupée, sans outil », compteurs à zéro : la forme que lisent les bureaux livrés", async () => {
    const response = await call("GET", "tok-admin");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      enabled: false,
      tool: null,
      counters: { jobs: 0, windows: 0, bytes: 0, seconds: 0, verdicts: 0, silent: 0, deferred: 0 },
    });
  });

  it("refuse un utilisateur qui n'est pas administrateur", async () => {
    expect((await call("GET", "tok-user")).statusCode).toBe(403);
    expect((await call("GET", "tok-inconnu")).statusCode).toBe(401);
  });
});

describe("PUT /api/admin/audio-analysis", () => {
  it("n'existe plus : plus rien à allumer", async () => {
    expect((await call("PUT", "tok-admin", { enabled: true })).statusCode).toBe(404);
  });
});
