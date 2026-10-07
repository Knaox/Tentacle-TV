/**
 * La lecture directe réglée par l'administration : l'adresse PRIVÉE suffit à
 * l'allumer ; la publique est facultative, et `null` l'efface. Une chaîne
 * vide (clients d'avant) la laisse telle quelle.
 */
import Fastify from "fastify";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ config: new Map<string, string>() }));
vi.mock("../services/configStore", () => ({
  getConfigValue: (key: string) => h.config.get(key),
  setConfigValue: async (key: string, value: string) => void h.config.set(key, value),
  deleteConfigValue: async (key: string) => void h.config.delete(key),
  getJellyfinUrl: () => null,
  getJellyfinApiKey: () => null,
  getPublicUrl: () => null,
  getDirectStreamingConfig: () => ({
    enabled: h.config.get("direct_streaming_enabled") === "true",
    publicUrl: h.config.get("jellyfin_public_url") ?? null,
    privateUrl: h.config.get("jellyfin_private_url") ?? null,
  }),
}));

import { adminDirectStreamingRoutes } from "./adminDirectStreaming";

const app = Fastify();
beforeAll(async () => {
  await app.register(adminDirectStreamingRoutes);
});
const put = (payload: object) => app.inject({ method: "PUT", url: "/direct-streaming", payload });

beforeEach(() => h.config.clear());

describe("PUT /api/admin/direct-streaming", () => {
  it("l'adresse privée seule suffit à l'allumer", async () => {
    expect((await put({ enabled: true, privateUrl: "http://192.168.1.20:8096" })).statusCode).toBe(200);
    expect(h.config.get("direct_streaming_enabled")).toBe("true");
    expect(h.config.get("jellyfin_private_url")).toBe("http://192.168.1.20:8096");
    expect(h.config.has("jellyfin_public_url")).toBe(false);
  });

  it("sans adresse privée (ni envoyée, ni gardée) : refusé", async () => {
    expect((await put({ enabled: true, publicUrl: "https://jf.example.com" })).statusCode).toBe(400);
  });

  it("la publique : posée, puis effacée par `null` — une chaîne vide la garde (clients d'avant)", async () => {
    await put({ enabled: true, privateUrl: "http://192.168.1.20:8096", publicUrl: "https://jf.example.com/" });
    expect(h.config.get("jellyfin_public_url")).toBe("https://jf.example.com");
    await put({ enabled: true, privateUrl: "http://192.168.1.20:8096", publicUrl: "" });
    expect(h.config.get("jellyfin_public_url")).toBe("https://jf.example.com");
    await put({ enabled: true, publicUrl: null });
    expect(h.config.has("jellyfin_public_url")).toBe(false);
  });

  it("GET rend ce qui est réglé", async () => {
    await put({ enabled: true, privateUrl: "http://192.168.1.20:8096" });
    expect((await app.inject({ method: "GET", url: "/direct-streaming" })).json()).toEqual({ enabled: true, publicUrl: "", privateUrl: "http://192.168.1.20:8096" });
  });
});
