import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ config: new Map<string, string>(), personal: true, checks: 0 }));

vi.mock("../middleware/auth", () => ({
  requirePersonalAdmin: async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => {
    if (!h.personal) return reply.status(403).send({ message: "Forbidden" });
  },
}));
vi.mock("../services/configStore", () => ({
  getConfigValue: (key: string) => h.config.get(key),
  setConfigValue: async (key: string, value: string) => void h.config.set(key, value),
  deleteConfigValue: async (key: string) => void h.config.delete(key),
  getDirectStreamingConfig: () => ({ enabled: false, publicUrl: null, privateUrl: null }),
  getPublicUrl: () => "https://tv.example.com",
  getJellyfinUrl: () => undefined,
}));
vi.mock("./remoteCheck", async (original) => ({
  ...(await original<typeof import("./remoteCheck")>()),
  runRemoteCheck: async () => {
    h.checks += 1;
    return { checkedAt: "t", outcome: "service_unavailable", publicIp: { v4: null, v6: null }, items: [] };
  },
}));

import { remoteAccessRoutes } from "./remoteAccessRoutes";

async function app() {
  const server = Fastify();
  await server.register(remoteAccessRoutes);
  return server;
}

beforeEach(() => {
  h.config.clear();
  h.personal = true;
  h.checks = 0;
});

describe("routes de l'accès à distance", () => {
  it("GET : l'état, les réglages par défaut et le lien public réglé (publié, donc « enabled »)", async () => {
    const res = await (await app()).inject({ method: "GET", url: "/remote-access" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      settings: { enabled: true, proxy: "none", localUrl: null, routerId: null },
      publicUrl: "https://tv.example.com",
      checkServiceUrl: "https://check.tentacletv.app",
      lastCheck: null,
    });
  });

  it("PUT : enregistre ce qui est donné, et rien d'autre", async () => {
    const server = await app();
    const res = await server.inject({ method: "PUT", url: "/remote-access", payload: { enabled: true, proxy: "caddy", localUrl: "http://192.168.1.20:3000/" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().settings).toEqual({ enabled: true, proxy: "caddy", localUrl: "http://192.168.1.20:3000", routerId: null });
    await server.inject({ method: "PUT", url: "/remote-access", payload: { localUrl: "" } });
    expect(h.config.has("remote_access_local_url")).toBe(false);
    expect(h.config.get("remote_access_proxy")).toBe("caddy");
  });

  it("PUT : l'ancien interrupteur est accepté mais ignoré — ce qui est réglé reste publié", async () => {
    const res = await (await app()).inject({ method: "PUT", url: "/remote-access", payload: { enabled: false } });
    expect(res.statusCode).toBe(200);
    expect(res.json().settings.enabled).toBe(true);
    expect(h.config.has("remote_access_enabled")).toBe(false);
  });

  it.each([
    { proxy: "nginx" },
    { localUrl: "javascript:alert(1)" },
    { localUrl: "http://user:pass@192.168.1.20" },
    { routerId: "../../x" },
    { enabled: true, extra: 1 },
  ])("PUT : refuse une entrée mal formée (%o)", async (payload) => {
    const res = await (await app()).inject({ method: "PUT", url: "/remote-access", payload });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid_input" });
  });

  it("POST check : le test, et une TV jumelée n'y a pas droit", async () => {
    const server = await app();
    expect((await server.inject({ method: "POST", url: "/remote-access/check" })).json().outcome).toBe("service_unavailable");
    h.personal = false;
    expect((await server.inject({ method: "POST", url: "/remote-access/check" })).statusCode).toBe(403);
    expect((await server.inject({ method: "GET", url: "/remote-access" })).statusCode).toBe(403);
    expect(h.checks).toBe(1);
  });
});
