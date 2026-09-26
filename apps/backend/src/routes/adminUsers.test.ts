/**
 * La liste admin des comptes : ce que l'écran « Utilisateurs » reçoit de
 * Jellyfin, et les deux refus qu'il distingue (Jellyfin non configuré,
 * Jellyfin injoignable).
 *
 * La route n'a pas de garde propre — elle hérite de `requireAdmin` par
 * `adminRoutes` : le banc l'enregistre donc seule.
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jellyfin = vi.hoisted(() => ({ url: "http://jf.test" as string | null }));
vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => jellyfin.url,
  getJellyfinApiKey: () => "admin-key",
}));
vi.mock("../services/jwt", () => ({
  signImpersonationToken: async () => "jeton",
}));

import { adminUsersRoutes } from "./adminUsers";

const JELLYFIN_USERS = [
  {
    Id: "a1",
    Name: "Alice",
    PrimaryImageTag: "tag-alice",
    LastActivityDate: "2026-09-26T10:00:00.0000000Z",
    LastLoginDate: "2026-09-25T08:00:00.0000000Z",
    Policy: { IsAdministrator: true, IsDisabled: false },
  },
  { Id: "b2", Name: "Bruno", Policy: { IsDisabled: true } },
];

let upstream: () => Response;

beforeEach(() => {
  jellyfin.url = "http://jf.test";
  upstream = () => Response.json(JELLYFIN_USERS);
  vi.stubGlobal("fetch", vi.fn(async () => upstream()));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function getUsers() {
  const app = Fastify();
  await app.register(adminUsersRoutes, { prefix: "/api/admin" });
  const response = await app.inject({ method: "GET", url: "/api/admin/users" });
  await app.close();
  return response;
}

describe("GET /api/admin/users", () => {
  it("rend l'étiquette de la photo et la dernière connexion, sans retirer les anciens champs", async () => {
    const response = await getUsers();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: "a1",
        name: "Alice",
        hasAvatar: true,
        imageTag: "tag-alice",
        lastActivityDate: "2026-09-26T10:00:00.0000000Z",
        lastLoginDate: "2026-09-25T08:00:00.0000000Z",
        isAdministrator: true,
        isDisabled: false,
      },
      {
        id: "b2",
        name: "Bruno",
        hasAvatar: false,
        imageTag: null,
        lastActivityDate: null,
        lastLoginDate: null,
        isAdministrator: false,
        isDisabled: true,
      },
    ]);
  });

  it("répond 503 quand Jellyfin n'est pas configuré — l'écran le distingue d'une panne", async () => {
    jellyfin.url = null;
    const response = await getUsers();
    expect(response.statusCode).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("répond 502 quand Jellyfin refuse ou ne répond pas", async () => {
    upstream = () => new Response("{}", { status: 401 });
    expect((await getUsers()).statusCode).toBe(502);

    upstream = () => {
      throw new TypeError("fetch failed");
    };
    expect((await getUsers()).statusCode).toBe(502);
  });
});
