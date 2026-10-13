/**
 * Le jeton Jellyfin d'une session de profil : une TV le reçoit (son jeton
 * PROPRE, lecture directe), un BUREAU jamais — la personne au clavier
 * repartirait avec un vrai jeton du compte du profil (celui d'un
 * administrateur ouvert sans PIN par un membre…). Le bureau lit par le proxy,
 * et garde l'identité d'appareil à adopter (docs/FAMILLE.md, « Le bureau »).
 */
import Fastify from "fastify";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ desktopHosts: new Set<string>(), hostLookupFails: false, minted: [] as string[] }));

vi.mock("../services/configStore", () => ({
  getDirectStreamingConfig: () => ({ enabled: true, publicUrl: "https://media.example", privateUrl: "http://192.168.1.2:8096" }),
  getJellyfinUrl: () => "http://jellyfin.test",
  getPublicUrl: () => null,
}));
vi.mock("../services/jellyfinSystemConfig", () => ({ getMaxResumePct: async () => 90 }));
vi.mock("../middleware/auth", () => ({ requireAuth: async () => {} }));
vi.mock("../services/jwt", () => ({
  verifyDeviceToken: async (token: string) => {
    const [kind, pairingId] = token.split(".");
    if (kind === "profil") return { userId: "u-zoe", username: "Zoé", isAdmin: false, deviceId: "d", type: "paired_device", scope: "profile", pairingId };
    if (kind === "tv") return { userId: "u-damien", username: "Damien", isAdmin: true, deviceId: "d", type: "paired_device" };
    return null;
  },
}));
vi.mock("../services/deviceTokenHealth", () => ({
  resolvePairedDeviceToken: async (token: string) => {
    state.minted.push(token);
    return "jeton-jellyfin-propre";
  },
}));
vi.mock("../services/deviceSessions/deviceAuth", () => ({ pairedJellyfinDeviceId: async (token: string) => `derive-${token}` }));
vi.mock("../services/jellyfinLegacyAuth", () => ({ jellyfinAcceptsLegacyAuth: async () => true }));
vi.mock("../services/family/familyPickerHosts", () => ({
  isPickerProfileSession: async (pairingId: string | undefined) => {
    if (state.hostLookupFails) throw new Error("base tombée");
    return pairingId !== undefined && state.desktopHosts.has(pairingId);
  },
}));

import { configRoutes } from "./config";

const app = Fastify();
beforeAll(async () => {
  await app.register(configRoutes, { prefix: "/api" });
});
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  state.desktopHosts = new Set(["hote-bureau"]);
  state.hostLookupFails = false;
  state.minted = [];
});
afterEach(() => vi.unstubAllGlobals());

async function streaming(token: string) {
  const res = await app.inject({
    method: "GET",
    url: "/api/config/streaming?jellyfinAuth=modern",
    headers: { authorization: `Bearer ${token}` },
  });
  return (res.json() as { directStreaming: Record<string, unknown> }).directStreaming;
}

describe("GET /api/config/streaming — sessions de profil", () => {
  it("une session de profil de TV reçoit son jeton Jellyfin propre (inchangé)", async () => {
    expect(await streaming("profil.jumelage-tv.sig")).toMatchObject({ enabled: true, jellyfinToken: "jeton-jellyfin-propre" });
    expect(await streaming("tv.x.sig")).toMatchObject({ enabled: true, jellyfinToken: "jeton-jellyfin-propre" });
  });

  it("une session de profil du BUREAU : aucun jeton, aucune frappe — le proxy, et son identité d'appareil", async () => {
    const config = await streaming("profil.hote-bureau.sig");
    expect(config).toEqual({ enabled: false, mediaBaseUrl: null, jellyfinToken: null, deviceId: "derive-profil.hote-bureau.sig" });
    expect(state.minted).toEqual([]);
  });

  it("base muette : pas de jeton non plus (on ferme)", async () => {
    state.hostLookupFails = true;
    expect(await streaming("profil.hote-bureau.sig")).toMatchObject({ enabled: false, jellyfinToken: null });
    expect(state.minted).toEqual([]);
  });
});
