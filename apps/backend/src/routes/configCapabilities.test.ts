/**
 * `GET /api/config` déclare les capacités du serveur : la liste que les
 * clients lisent pour décider de ce qu'ils montrent (`serverCapabilities.ts`).
 */
import Fastify from "fastify";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../services/configStore", () => ({
  getDirectStreamingConfig: () => ({ enabled: false, publicUrl: null, privateUrl: null }),
  getJellyfinUrl: () => null,
  getPublicUrl: () => null,
}));
vi.mock("../services/jellyfinSystemConfig", () => ({ getMaxResumePct: async () => 90 }));
vi.mock("../middleware/auth", () => ({ requireAuth: async () => {} }));
vi.mock("../services/jwt", () => ({ verifyDeviceToken: async () => null }));
vi.mock("../services/deviceTokenHealth", () => ({ resolvePairedDeviceToken: async () => null }));
vi.mock("../services/deviceSessions/deviceAuth", () => ({ pairedJellyfinDeviceId: async () => null }));
vi.mock("../services/jellyfinLegacyAuth", () => ({ jellyfinAcceptsLegacyAuth: async () => true }));
vi.mock("../services/family/familyConfig", () => ({ familyCapability: () => ({ v: 1, enabled: true, guests: true, guestRequests: false }) }));
vi.mock("../remoteAccess/serverAddresses", () => ({ serverAddresses: () => ({}) }));
vi.mock("../remoteAccess/exposure", () => ({ pairingUrl: () => null, directMediaBaseUrl: () => null }));
const version = vi.hoisted(() => ({ value: "1.41.0+preview.fab15c3" }));
vi.mock("../services/version", () => ({
  get BACKEND_VERSION() {
    return version.value;
  },
}));

import { configRoutes } from "./config";
import { SERVER_CAPABILITIES, SERVER_CAPABILITY_KEYS } from "../serverCapabilities/serverCapabilities";

const app = Fastify();
beforeAll(async () => {
  await app.register(configRoutes, { prefix: "/api" });
});

describe("GET /api/config › capabilities", () => {
  it("déclare chaque capacité du contrat, sans authentification", async () => {
    const res = await app.inject({ method: "GET", url: "/api/config" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { capabilities: string[]; features: object };
    expect(body.capabilities).toEqual(SERVER_CAPABILITY_KEYS);
    expect(body.features).toBeDefined();
  });

  it("dit la version fixée au build, et un serveur 1.31.4 tait les capacités de 1.40.0 et 1.41.0", async () => {
    expect((await app.inject({ method: "GET", url: "/api/config" })).json()).toMatchObject({ version: "1.41.0+preview.fab15c3" });
    version.value = "1.31.4";
    const body = (await app.inject({ method: "GET", url: "/api/config" })).json() as { version: string; capabilities: string[] };
    expect(body.version).toBe("1.31.4");
    expect(body.capabilities).not.toContain("music.library");
    expect(body.capabilities).toContain("family.webProfiles");
    expect(body.capabilities.every((key) => SERVER_CAPABILITIES[key as keyof typeof SERVER_CAPABILITIES] !== "1.40.0" && SERVER_CAPABILITIES[key as keyof typeof SERVER_CAPABILITIES] !== "1.41.0")).toBe(true);
    version.value = "1.41.0+preview.fab15c3";
  });

  it("un serveur 1.40.0 tait les capacités de 1.41.0 (lot fl : l'ajout en tête)", async () => {
    version.value = "1.40.0";
    const body = (await app.inject({ method: "GET", url: "/api/config" })).json() as { capabilities: string[] };
    expect(body.capabilities).toContain("music.libraryFavorites");
    expect(body.capabilities).not.toContain("music.addOnTop");
    version.value = "1.41.0+preview.fab15c3";
  });
});
