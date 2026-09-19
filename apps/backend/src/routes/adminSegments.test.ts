/**
 * La route admin de l'analyse audio : lecture (interrupteur, outil, compteurs),
 * écriture de l'interrupteur, refus d'un corps illisible et d'un non-admin.
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const configStore = vi.hoisted(() => new Map<string, string>());
vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "admin-key",
  isAudioAnalysisEnabled: () => configStore.get("audio_analysis_enabled") !== "false",
  setConfigValue: async (key: string, value: string) => {
    configStore.set(key, value);
  },
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
vi.mock("../services/audioFingerprintTool", () => ({
  detectFingerprintTool: async () => ({ kind: "fpcalc", command: "fpcalc" }),
}));
vi.mock("../services/audioAnalysis", () => ({
  audioAnalysisCounters: () => ({ jobs: 2, windows: 5, bytes: 14_500_000, seconds: 16, verdicts: 1, silent: 1, deferred: 0 }),
}));

import { adminSegmentRoutes } from "./adminSegments";

beforeEach(() => {
  configStore.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const token = new Headers(init?.headers).get("x-emby-token");
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

describe("GET /api/admin/audio-analysis", () => {
  it("rend l'interrupteur (actif par défaut), l'outil et les compteurs", async () => {
    const response = await call("GET", "tok-admin");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      enabled: true,
      tool: "fpcalc",
      counters: { jobs: 2, windows: 5, bytes: 14_500_000, seconds: 16, verdicts: 1, silent: 1, deferred: 0 },
    });
  });

  it("refuse un utilisateur qui n'est pas administrateur", async () => {
    expect((await call("GET", "tok-user")).statusCode).toBe(403);
    expect((await call("GET", "tok-inconnu")).statusCode).toBe(401);
  });
});

describe("PUT /api/admin/audio-analysis", () => {
  it("écrit l'interrupteur, et la lecture le reflète", async () => {
    const off = await call("PUT", "tok-admin", { enabled: false });
    expect(off.statusCode).toBe(200);
    expect(off.json()).toEqual({ success: true, enabled: false });
    expect(configStore.get("audio_analysis_enabled")).toBe("false");
    expect((await call("GET", "tok-admin")).json().enabled).toBe(false);
    await call("PUT", "tok-admin", { enabled: true });
    expect((await call("GET", "tok-admin")).json().enabled).toBe(true);
  });

  it("refuse un corps illisible", async () => {
    expect((await call("PUT", "tok-admin", { enabled: "oui" })).statusCode).toBe(400);
    expect((await call("PUT", "tok-admin", {})).statusCode).toBe(400);
  });

  it("refuse un non-admin sans rien écrire", async () => {
    expect((await call("PUT", "tok-user", { enabled: false })).statusCode).toBe(403);
    expect(configStore.has("audio_analysis_enabled")).toBe(false);
  });
});
