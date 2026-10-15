/**
 * Watch Together face à `SyncPlayAccess` (docs/DROITS-UTILISATEURS.md § 9.2), de
 * bout en bout : vraies salles en mémoire, auth réelle contre un faux Jellyfin
 * dont `/Users` porte la politique de chaque compte. « Créer et rejoindre » crée
 * et invite ; « Rejoindre seulement » est invité et entre ; « Interdit » n'est ni
 * candidat, ni invité, ni prévenu, n'entre pas, et sort d'un salon s'il y était.
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modernJellyfinToken } from "../../test/jellyfinFakeAuth";

type Sent = { type: string; reason?: string; invite?: unknown };
const sent: Array<{ to: string; msg: Sent }> = [];

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "cle-admin",
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/wsManager", () => ({
  sendToUser: (to: string, msg: Sent) => sent.push({ to, msg }),
  isUserOnline: () => true,
  onPresenceChange: () => undefined,
}));
vi.mock("../services/family/familyGuestMarkers", () => ({
  withoutFamilyGuests: async <T>(list: T[]) => list,
}));
vi.mock("../services/itemAccess/itemVisibility", () => ({ isItemVisibleTo: async () => true }));
vi.mock("../services/watchTogether/hostSettings", () => ({ refreshHostSettings: async () => undefined }));

import { watchTogetherRoutes } from "./watchTogether";
import { watchTogetherInviteRoutes } from "./watchTogetherInvites";
import { watchTogetherUsersRoutes } from "./watchTogetherUsers";
import { getRoomOf } from "../services/watchTogether/roomRegistry";
import { createInvite } from "../services/watchTogether/roomInvites";
import { removeMemberAndSync } from "../services/watchTogether/sync";
import { invalidateJellyfinUsers } from "../services/watchTogether/usersCache";
import { sweepRevokedMembers } from "../services/watchTogether/accessWatch";

type Who = "a" | "b" | "c" | "d";
const ACCESS: Record<Who, string> = { a: "CreateAndJoinGroups", b: "JoinGroups", c: "None", d: "CreateAndJoinGroups" };
const NAMES: Record<Who, string> = { a: "Alice", b: "Bob", c: "Chloé", d: "David" };

beforeEach(() => {
  sent.length = 0;
  ACCESS.a = "CreateAndJoinGroups";
  ACCESS.b = "JoinGroups";
  invalidateJellyfinUsers();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const token = modernJellyfinToken(init?.headers, url);
    if (url.endsWith("/Users") && token === "cle-admin") {
      return Response.json((Object.keys(ACCESS) as Who[]).map((id) => ({ Id: id, Name: NAMES[id], Policy: { SyncPlayAccess: ACCESS[id] } })));
    }
    const who = token.replace("jeton-", "") as Who;
    return ACCESS[who] ? Response.json({ Id: who, Name: NAMES[who], Policy: { IsAdministrator: false } }) : new Response("{}", { status: 401 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const id of ["a", "b", "c", "d"]) removeMemberAndSync(id);
});

async function makeApp() {
  const app = Fastify();
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof ZodError) return reply.status(400).send({ message: "Validation error" });
    return reply.status(500).send({ message: err instanceof Error ? err.message : "Erreur" });
  });
  for (const routes of [watchTogetherRoutes, watchTogetherInviteRoutes, watchTogetherUsersRoutes]) {
    await app.register(routes, { prefix: "/api/watch-together" });
  }
  return (who: Who, method: "GET" | "POST", url: string, payload?: object) =>
    app.inject({ method, url: `/api/watch-together${url}`, headers: { "x-emby-token": `jeton-${who}` }, ...(payload ? { payload } : {}) });
}

describe("Watch Together — l'accès de chaque compte", () => {
  it("GET /access dit l'accès tiré de SyncPlayAccess", async () => {
    const call = await makeApp();
    expect((await call("a", "GET", "/access")).json()).toEqual({ access: "full" });
    expect((await call("b", "GET", "/access")).json()).toEqual({ access: "joinOnly" });
    expect((await call("c", "GET", "/access")).json()).toEqual({ access: "none" });
  });

  it("seul « Créer et rejoindre » crée un salon", async () => {
    const call = await makeApp();
    expect((await call("b", "POST", "/group", {})).json()).toMatchObject({ code: "access_denied" });
    expect((await call("c", "POST", "/group", {})).statusCode).toBe(403);
    expect(getRoomOf("b")).toBeNull();
    expect((await call("a", "POST", "/group", {})).statusCode).toBe(200);
  });

  it("« Interdit » n'est ni candidat, ni invité, ni prévenu", async () => {
    const call = await makeApp();
    const candidates = (await call("a", "GET", "/users")).json() as Array<{ id: string }>;
    expect(candidates.map((u) => u.id).sort()).toEqual(["b", "d"]);
    await call("a", "POST", "/group", {});
    expect((await call("a", "POST", "/group/invites", { userIds: ["b", "c"] })).json()).toEqual({ invited: ["b"] });
    expect(sent.filter((s) => s.msg.type === "wt:invite").map((s) => s.to)).toEqual(["b"]);
  });

  it("« Rejoindre seulement » entre ; « Interdit » ne voit ni n'accepte rien", async () => {
    const call = await makeApp();
    await call("a", "POST", "/group", {});
    await call("a", "POST", "/group/invites", { userIds: ["b"] });
    const [invite] = (await call("b", "GET", "/invites")).json() as Array<{ inviteId: string }>;
    expect((await call("b", "POST", `/invites/${invite.inviteId}/respond`, { accept: true })).statusCode).toBe(200);
    expect(getRoomOf("b")).toBe(getRoomOf("a"));

    // Une invitation posée avant le retrait du droit ne vaut plus rien.
    const forged = createInvite(getRoomOf("a")!, { userId: "a", username: "Alice" }, "c", null, null);
    expect((await call("c", "GET", "/invites")).json()).toEqual([]);
    expect((await call("c", "POST", `/invites/${forged.inviteId}/respond`, { accept: true })).json()).toMatchObject({ code: "access_denied" });
    expect(getRoomOf("c")).toBeNull();
  });

  it("un hôte qui perd « Créer » garde son salon, sans plus inviter", async () => {
    const call = await makeApp();
    await call("a", "POST", "/group", {});
    ACCESS.a = "JoinGroups";
    invalidateJellyfinUsers();
    expect((await call("a", "POST", "/group/invites", { userIds: ["d"] })).statusCode).toBe(403);
    expect(await sweepRevokedMembers()).toBe(0);
    expect(getRoomOf("a")).not.toBeNull();
  });

  it("un membre passé à « Interdit » sort de son salon, et lui seul l'apprend", async () => {
    const call = await makeApp();
    await call("a", "POST", "/group", {});
    await call("a", "POST", "/group/invites", { userIds: ["b"] });
    const [invite] = (await call("b", "GET", "/invites")).json() as Array<{ inviteId: string }>;
    await call("b", "POST", `/invites/${invite.inviteId}/respond`, { accept: true });
    sent.length = 0;

    ACCESS.b = "None";
    invalidateJellyfinUsers();
    expect(await sweepRevokedMembers()).toBe(1);
    expect(getRoomOf("b")).toBeNull();
    expect(getRoomOf("a")?.members.size).toBe(1);
    expect(sent.find((s) => s.to === "b" && s.msg.type === "wt:dissolved")?.msg.reason).toBe("access_revoked");
    expect(sent.some((s) => s.to === "a" && s.msg.type === "wt:dissolved")).toBe(false);
  });
});
