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
vi.mock("../remoteAccess/exposure", () => ({ publishedPublicUrl: () => null, directMediaBaseUrl: () => null }));

import { configRoutes } from "./config";
import { SERVER_CAPABILITY_KEYS } from "../serverCapabilities/serverCapabilities";

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
});
