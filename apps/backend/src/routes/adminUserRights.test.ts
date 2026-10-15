/**
 * Les droits d'un compte par l'administration : session personnelle exigée,
 * validation stricte, politique relue → seuls les champs demandés changent → relue,
 * et les refus du contrat (invité, dernier administrateur, s'enfermer dehors).
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Policy = Record<string, unknown>;

const state = vi.hoisted(() => ({
  personal: true,
  actor: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  down: false,
  guests: new Set<string>(),
  users: new Map<string, { Id: string; Name: string; Policy: Record<string, unknown> }>(),
  posts: [] as { id: string; body: Record<string, unknown> }[],
}));

vi.mock("../middleware/auth", () => ({
  requirePersonalAdmin: async (request: { user?: unknown }, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) => {
    if (!state.personal) return reply.status(403).send({ message: "Forbidden" });
    request.user = { userId: state.actor, username: "Admin", isAdmin: true, session: "personal" };
  },
}));
vi.mock("../services/family/familyGuestMarkers", () => ({ isFamilyGuest: async (id: string) => state.guests.has(id) }));
vi.mock("../services/watchTogether/usersCache", () => ({ invalidateJellyfinUsers: () => undefined }));
vi.mock("../services/jellyfinLibrary", () => ({ adminUserParam: async () => "" }));
vi.mock("../services/jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: async (path: string, options: { method?: string; body?: Record<string, unknown> } = {}) => {
    if (state.down) return { ok: false, failure: "unreachable" };
    if (path === "/Users") return { ok: true, data: [...state.users.values()] };
    const policy = /^\/Users\/([0-9a-f]+)\/Policy$/.exec(path);
    if (policy && options.method === "POST") {
      state.posts.push({ id: policy[1], body: options.body ?? {} });
      const user = state.users.get(policy[1]);
      if (user) user.Policy = structuredClone(options.body ?? {});
      return { ok: true, data: null };
    }
    const one = /^\/Users\/([0-9a-f]+)$/.exec(path);
    if (one) {
      const user = state.users.get(one[1]);
      return user ? { ok: true, data: structuredClone(user) } : { ok: false, failure: "invalid", status: 404 };
    }
    if (path === "/Library/VirtualFolders") return { ok: true, data: [{ Name: "Films", ItemId: LIB, CollectionType: "movies" }] };
    if (path === "/Localization/ParentalRatings") {
      return { ok: true, data: [{ Name: "12", RatingScore: { score: 12, subScore: null } }, { Name: "16", RatingScore: { score: 16, subScore: null } }] };
    }
    if (path.startsWith("/Items/Filters")) return { ok: true, data: { Tags: ["horreur"] } };
    return { ok: false, failure: "invalid", status: 404 };
  },
}));

const LIB = "f137a2dd21bbc1b99aa5c0f6bf02a805";

import { adminUserRightsRoutes } from "./adminUserRights";
import { clearUserRightsOptions } from "../services/userRights/userRightsOptions";

const ADMIN = state.actor;
const ALICE = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function basePolicy(extra: Policy = {}): Policy {
  return {
    IsAdministrator: false,
    IsDisabled: false,
    EnableAllFolders: true,
    EnabledFolders: [],
    MaxParentalRating: null,
    AuthenticationProviderId: "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
    PasswordResetProviderId: "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider",
    FutureField: { kept: true },
    ...extra,
  };
}

async function app() {
  const server = Fastify();
  await server.register(adminUserRightsRoutes, { prefix: "/api/admin" });
  return server;
}

beforeEach(() => {
  state.users.set(ADMIN, { Id: ADMIN, Name: "Admin", Policy: basePolicy({ IsAdministrator: true }) });
  state.users.set(ALICE, { Id: ALICE, Name: "Alice", Policy: basePolicy() });
  clearUserRightsOptions();
});

afterEach(() => {
  state.personal = true;
  state.down = false;
  state.guests.clear();
  state.users.clear();
  state.posts = [];
  vi.restoreAllMocks();
});

describe("les droits d'un compte (admin)", () => {
  it("lit les droits dans la politique Jellyfin", async () => {
    const res = await (await app()).inject({ method: "GET", url: `/api/admin/users/${ALICE}/rights` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ userId: ALICE, name: "Alice", rights: { isAdministrator: false, enableAllFolders: true, maxParentalRating: null } });
  });

  it("refuse hors session personnelle, un compte inconnu, un invité de la Famille", async () => {
    state.personal = false;
    expect((await (await app()).inject({ method: "GET", url: `/api/admin/users/${ALICE}/rights` })).statusCode).toBe(403);
    state.personal = true;
    const unknown = await (await app()).inject({ method: "GET", url: `/api/admin/users/${"c".repeat(32)}/rights` });
    expect([unknown.statusCode, unknown.json()]).toEqual([404, { error: "unknown_user" }]);
    expect((await (await app()).inject({ method: "GET", url: "/api/admin/users/..%2Fx/rights" })).json()).toEqual({ error: "unknown_user" });
    state.guests.add(ALICE);
    const guest = await (await app()).inject({ method: "PATCH", url: `/api/admin/users/${ALICE}/rights`, payload: { isDisabled: true } });
    expect([guest.statusCode, guest.json()]).toEqual([409, { error: "family_guest" }]);
    expect(state.posts).toEqual([]);
  });

  it("ne change QUE les champs du correctif, garde le reste à l'octet, rend l'état relu", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const res = await (await app()).inject({
      method: "PATCH",
      url: `/api/admin/users/${ALICE}/rights`,
      payload: { enableAllFolders: false, enabledFolders: [LIB], maxParentalRating: 12, blockedTags: ["horreur"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rights).toMatchObject({ enableAllFolders: false, enabledFolders: [LIB], maxParentalRating: 12, blockedTags: ["horreur"] });
    const written = state.posts[0].body;
    expect(written).toEqual({ ...basePolicy(), EnableAllFolders: false, EnabledFolders: [LIB], MaxParentalRating: 12, BlockedTags: ["horreur"] });
    const line = log.mock.calls.map((call) => String(call[0])).find((entry) => entry.startsWith("[user-rights]"));
    expect(line).toBe("[user-rights] Admin → Alice : enableAllFolders, enabledFolders, maxParentalRating, blockedTags");
    expect(line).not.toContain("horreur");
  });

  it("valide strictement : valeur fausse nommée, clé inconnue, bibliothèque ou note inconnues", async () => {
    const patch = (payload: unknown) => app().then((server) => server.inject({ method: "PATCH", url: `/api/admin/users/${ALICE}/rights`, payload: payload as object }));
    expect((await patch({ maxActiveSessions: "3" })).json()).toEqual({ error: "invalid_value", fields: ["maxActiveSessions"] });
    expect((await patch({ Policy: {} })).json()).toEqual({ error: "invalid_value" });
    expect((await patch({ enabledFolders: ["d".repeat(32)] })).json()).toEqual({ error: "invalid_value", fields: ["enabledFolders"] });
    expect((await patch({ maxParentalRating: 13 })).json()).toEqual({ error: "invalid_value", fields: ["maxParentalRating"] });
    expect((await patch({})).statusCode).toBe(400);
    expect(state.posts).toEqual([]);
  });

  it("un administrateur ne se retire ni l'administration ni l'accès", async () => {
    state.users.set(ALICE, { Id: ALICE, Name: "Alice", Policy: basePolicy({ IsAdministrator: true }) });
    for (const payload of [{ isAdministrator: false }, { isDisabled: true }]) {
      const res = await (await app()).inject({ method: "PATCH", url: `/api/admin/users/${ADMIN}/rights`, payload });
      expect([res.statusCode, res.json()]).toEqual([409, { error: "self_lockout" }]);
    }
  });

  it("un administrateur ne se pose pas un programme d'accès qui l'exclut maintenant ; un autre compte, si", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 15, 10, 0)); // un jeudi, 10 h, heure locale du serveur
    try {
      const own = (accessSchedules: unknown) =>
        app().then((server) => server.inject({ method: "PATCH", url: `/api/admin/users/${ADMIN}/rights`, payload: { accessSchedules } }));
      const weekend = [{ dayOfWeek: "Weekend", startHour: 8, endHour: 20 }];
      expect((await own(weekend)).json()).toEqual({ error: "self_lockout" });
      expect(state.posts).toEqual([]);
      expect((await own([{ dayOfWeek: "Weekday", startHour: 8, endHour: 20 }])).statusCode).toBe(200);
      expect((await own([])).statusCode).toBe(200);
      const other = await (await app()).inject({ method: "PATCH", url: `/api/admin/users/${ALICE}/rights`, payload: { accessSchedules: weekend } });
      expect(other.statusCode).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it("le dernier administrateur actif garde l'administration ; avec un autre, elle se retire", async () => {
    state.actor = ALICE;
    try {
      const alone = await (await app()).inject({ method: "PATCH", url: `/api/admin/users/${ADMIN}/rights`, payload: { isAdministrator: false } });
      expect([alone.statusCode, alone.json()]).toEqual([409, { error: "last_admin" }]);
      state.users.set(ALICE, { Id: ALICE, Name: "Alice", Policy: basePolicy({ IsAdministrator: true }) });
      const res = await (await app()).inject({ method: "PATCH", url: `/api/admin/users/${ADMIN}/rights`, payload: { isAdministrator: false } });
      expect(res.statusCode).toBe(200);
      expect(res.json().rights.isAdministrator).toBe(false);
    } finally {
      state.actor = ADMIN;
    }
  });

  it("Jellyfin muet : 503, rien d'écrit", async () => {
    state.down = true;
    const res = await (await app()).inject({ method: "PATCH", url: `/api/admin/users/${ALICE}/rights`, payload: { enableRemoteAccess: false } });
    expect([res.statusCode, res.json()]).toEqual([503, { error: "jellyfin_unreachable" }]);
  });

  it("les options : bibliothèques, notes, types non classés, étiquettes", async () => {
    const res = await (await app()).inject({ method: "GET", url: "/api/admin/users/rights/options" });
    expect(res.json()).toMatchObject({
      libraries: [{ id: LIB, name: "Films", collectionType: "movies" }],
      parentalRatings: [{ name: "12", score: 12, subScore: null }, { name: "16", score: 16, subScore: null }],
      knownTags: ["horreur"],
    });
    expect(res.json().unratedItemTypes).toContain("Movie");
  });
});
