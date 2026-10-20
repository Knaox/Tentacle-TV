/**
 * La route de ce que la session peut faire : nourrie des droits que chaque porte
 * applique, fermée à l'échec droit par droit, et au nom du PROFIL d'une session de profil.
 */

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ guest: false, downloads: true, wtFails: false, extension: "denied" as unknown }));

vi.mock("../middleware/auth", () => ({
  getTokenFromRequest: () => "jeton",
  requireAuth: async (request: { headers: Record<string, string>; user?: unknown }, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => {
    const id = request.headers["x-test-user"];
    if (!id) return reply.status(401).send({ message: "Unauthorized" });
    request.user = { userId: id, username: id, isAdmin: request.headers["x-admin"] === "1", session: request.headers["x-session"] ?? "personal" };
  },
}));
vi.mock("../services/family/familyGuestMarkers", () => ({ isFamilyGuest: async () => h.guest }));
vi.mock("../services/family/familyGuestExtensions", () => ({ guestExtensionAccess: async () => h.extension }));
vi.mock("../services/jellyfinPolicy", () => ({ getDownloadCapabilities: async () => ({ downloads: h.downloads }) }));
vi.mock("../services/libraryDelete/libraryDeletion", () => ({ readDeletionRights: async () => ({ everywhere: false, libraryIds: [] }) }));
vi.mock("../services/networkUtils", () => ({ getRealClientIp: () => "10.0.0.2" }));
vi.mock("../services/playbackRights", () => ({ playbackRightsFor: async () => ({ mediaPlayback: true }) }));
vi.mock("../services/share/publicSharingRight", () => ({ mayShareInPublic: async () => true }));
vi.mock("../services/watchTogether/accountAccess", () => ({
  wtAccessOf: async () => {
    if (h.wtFails) throw new Error("muet");
    return "full";
  },
}));

import { accountAbilitiesRoutes } from "./accountAbilities";

async function get(headers: Record<string, string>) {
  const app = Fastify();
  await app.register(accountAbilitiesRoutes, { prefix: "/api/account" });
  return app.inject({ method: "GET", url: "/api/account/abilities", headers });
}

beforeEach(() => Object.assign(h, { guest: false, downloads: true, wtFails: false, extension: "denied" }));

describe("GET /api/account/abilities", () => {
  it("session personnelle : les droits du compte, réponse privée", async () => {
    const res = await get({ "x-test-user": "u" });
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.json()).toMatchObject({ session: "personal", keepOffline: true, watchTogether: "full", publicSharing: true, deleteTitles: false });
    h.downloads = false;
    expect((await get({ "x-test-user": "u" })).json().keepOffline).toBe(false);
  });

  it("session de profil d'un invité : rien de ce qu'un invité ne peut pas faire", async () => {
    h.guest = true;
    expect((await get({ "x-test-user": "g", "x-session": "tvProfile" })).json()).toMatchObject({
      session: "guest", keepOffline: false, watchTogether: "none", tickets: false, publicSharing: false, extensions: false, push: false,
    });
    h.extension = { accountName: "petit" };
    expect((await get({ "x-test-user": "g", "x-session": "tvProfile" })).json().extensions).toBe(true);
  });

  it("une source muette vaut « non », sans faire tomber la réponse", async () => {
    h.wtFails = true;
    expect((await get({ "x-test-user": "u" })).json().watchTogether).toBe("none");
  });

  it("sans session : 401", async () => {
    expect((await get({})).statusCode).toBe(401);
  });
});
