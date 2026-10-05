import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/configStore", () => ({ getJellyfinUrl: () => "http://jellyfin:8096" }));
vi.mock("../services/jwt", () => ({ verifyImpersonationToken: async () => null }));
vi.mock("../services/pairedDeviceStatus", () => ({
  PROFILE_ENDED_REPLY: {},
  REVOKED_REPLY: {},
  pairedDeviceStatus: async (token: string) =>
    token === "tv-admin"
      ? { status: "paired", payload: { userId: "u1", username: "Damien", isAdmin: true, scope: "legacy" }, tokenHash: "h" }
      : { status: "not_device" },
}));

import { requirePersonalAdmin } from "./auth";

function fakeReply() {
  const reply = { statusCode: 200, status(code: number) { reply.statusCode = code; return reply; }, send: () => reply };
  return reply;
}

afterEach(() => vi.unstubAllGlobals());

describe("administrateur en session personnelle", () => {
  it("une TV jumelée par un administrateur n'administre pas l'accès distant", async () => {
    const reply = fakeReply();
    await requirePersonalAdmin({ headers: { authorization: "Bearer tv-admin" } } as never, reply as never);
    expect(reply.statusCode).toBe(403);
  });

  it("le jeton Jellyfin d'un administrateur passe ; celui d'un simple compte non", async () => {
    vi.stubGlobal("fetch", async (_url: string, init: { headers: { Authorization: string } }) => ({
      ok: true,
      status: 200,
      json: async () => ({ Id: "u1", Name: "Damien", Policy: { IsAdministrator: init.headers.Authorization.includes("admin") } }),
    }));
    const admin = fakeReply();
    const request = { headers: { authorization: "Bearer jeton-admin" } } as { headers: Record<string, string>; user?: unknown };
    await requirePersonalAdmin(request as never, admin as never);
    expect(admin.statusCode).toBe(200);
    expect(request.user).toMatchObject({ userId: "u1", session: "personal", isAdmin: true });
    const plain = fakeReply();
    await requirePersonalAdmin({ headers: { authorization: "Bearer jeton-simple" } } as never, plain as never);
    expect(plain.statusCode).toBe(403);
  });
});
