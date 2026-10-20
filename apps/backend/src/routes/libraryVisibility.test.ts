/**
 * La route du verdict des titres gardés : corps défendu, réponse privée, et
 * ouverte aux sessions de profil (le profil d'un enfant sur le téléphone du
 * parent doit pouvoir être jugé — `/api/downloads`, lui, leur reste fermé).
 */

import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { headers: Record<string, string>; user?: unknown }, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => {
    const id = request.headers["x-test-user"];
    if (!id) return reply.status(401).send({ message: "Unauthorized" });
    request.user = { userId: id, username: id, isAdmin: false };
  },
}));
vi.mock("../services/itemAccess/libraryVisibility", () => ({
  libraryVisibilityFor: async (userId: string, ids: string[]) => ({ visible: userId === "libre" ? ids : [], hidden: userId === "libre" ? [] : ids, gone: [] }),
}));
vi.mock("../services/family/familyGuestMarkers", () => ({ isFamilyGuest: async () => true }));
vi.mock("../services/family/familyGuestExtensions", () => ({ EXTENSIONS_PREFIX: "/api/plugins", guestExtensionAccess: async () => null }));

import { libraryVisibilityRoutes } from "./libraryVisibility";
import { profileSessionScope } from "../services/family/profileSessionLimits";

const ID = "0123456789abcdef0123456789abcdef";

async function makeApp() {
  const app = Fastify();
  await app.register(libraryVisibilityRoutes, { prefix: "/api/library" });
  return app;
}

describe("POST /api/library/visibility", () => {
  it("juge pour l'identité en session", async () => {
    const app = await makeApp();
    const post = (user: string) => app.inject({ method: "POST", url: "/api/library/visibility", headers: { "x-test-user": user }, payload: { itemIds: [ID, ID] } });
    const child = await post("enfant");
    expect(child.json()).toEqual({ visible: [], hidden: [ID], gone: [] });
    expect(child.headers["cache-control"]).toBe("private, no-store");
    expect((await post("libre")).json()).toEqual({ visible: [ID], hidden: [], gone: [] });
  });

  it("refuse un corps forgé, et sans session", async () => {
    const app = await makeApp();
    const post = (payload: unknown, headers: Record<string, string> = { "x-test-user": "u" }) =>
      app.inject({ method: "POST", url: "/api/library/visibility", headers, payload: payload as object });
    expect((await post({ itemIds: ["../etc"] })).statusCode).toBe(400);
    expect((await post({ itemIds: [ID], extra: 1 })).statusCode).toBe(400);
    expect((await post({ itemIds: Array.from({ length: 201 }, () => ID) })).statusCode).toBe(400);
    expect((await post({ itemIds: [ID] }, {})).statusCode).toBe(401);
  });

  it("une session de profil (invité) y entre ; les téléchargements lui restent fermés", async () => {
    const profile = { userId: "g", username: "g", session: "tvProfile" };
    expect((await profileSessionScope("/api/library/visibility", profile)).kind).toBe("pass");
    expect((await profileSessionScope("/api/downloads/original/x", profile)).kind).toBe("refuse");
  });
});
