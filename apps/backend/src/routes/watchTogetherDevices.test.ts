/**
 * L'adhésion par appareil, côté REST (1.31.1) : un appareil = le jeton qui
 * appelle. Le compte d'Alice a deux jetons (son PC « pc », son web « web ») :
 * la salle créée depuis le PC n'existe pas pour le web (`GET /group` → null),
 * qui en reçoit l'avis (`/group/elsewhere`), ne peut ni la quitter ni y
 * inviter, et peut s'y AJOUTER (`/group/join-here`).
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modernJellyfinToken } from "../../test/jellyfinFakeAuth";

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "cle-admin",
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
const sent = vi.hoisted(() => [] as Array<{ to: string; msg: { type: string; inviteId?: string } }>);
vi.mock("../services/wsManager", () => ({
  sendToUser: (to: string, msg: { type: string; inviteId?: string }) => sent.push({ to, msg }),
  sendToDevices: () => undefined,
  sendToOtherDevices: () => undefined,
  isUserOnline: () => true,
  isDeviceOnline: () => true,
  deviceKeyOfSocket: () => undefined,
  onPresenceChange: () => undefined,
  onDevicePresenceChange: () => undefined,
}));
vi.mock("../services/family/familyGuestMarkers", () => ({
  withoutFamilyGuests: async <T>(list: T[]) => list,
}));
vi.mock("../services/itemAccess/itemVisibility", () => ({ isItemVisibleTo: async () => true }));
vi.mock("../services/watchTogether/hostSettings", () => ({ refreshHostSettings: async () => undefined }));

import { watchTogetherRoutes } from "./watchTogether";
import { watchTogetherAffinityRoutes } from "./watchTogetherAffinity";
import { watchTogetherInviteRoutes } from "./watchTogetherInvites";
import { getRoomOf } from "../services/watchTogether/roomRegistry";
import { removeMemberAndSync } from "../services/watchTogether/sync";
import { invalidateJellyfinUsers } from "../services/watchTogether/usersCache";

const NAMES: Record<string, string> = { a: "Alice", b: "Bob" };

beforeEach(() => {
  invalidateJellyfinUsers();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const token = modernJellyfinToken(init?.headers, url);
    if (url.endsWith("/Users") && token === "cle-admin") {
      return Response.json(Object.keys(NAMES).map((id) => ({ Id: id, Name: NAMES[id], Policy: { SyncPlayAccess: "CreateAndJoinGroups" } })));
    }
    // « jeton-a-pc », « jeton-a-web » : deux appareils du compte « a ».
    const who = token.replace("jeton-", "").split("-")[0];
    return NAMES[who] ? Response.json({ Id: who, Name: NAMES[who], Policy: { IsAdministrator: false } }) : new Response("{}", { status: 401 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const id of Object.keys(NAMES)) removeMemberAndSync(id);
});

async function makeApp() {
  const app = Fastify();
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof ZodError) return reply.status(400).send({ message: "Validation error" });
    return reply.status(500).send({ message: err instanceof Error ? err.message : "Erreur" });
  });
  await app.register(watchTogetherRoutes, { prefix: "/api/watch-together" });
  await app.register(watchTogetherAffinityRoutes, { prefix: "/api/watch-together" });
  await app.register(watchTogetherInviteRoutes, { prefix: "/api/watch-together" });
  return (device: string, method: "GET" | "POST", url: string, payload?: object) =>
    app.inject({ method, url: `/api/watch-together${url}`, headers: { "x-emby-token": `jeton-${device}` }, ...(payload ? { payload } : {}) });
}

describe("Watch Together — l'adhésion par appareil (REST)", () => {
  it("la salle du PC n'existe pas pour le web du même compte, qui en a l'avis", async () => {
    const call = await makeApp();
    const created = await call("a-pc", "POST", "/group", {});
    expect(created.statusCode).toBe(200);
    expect((await call("a-pc", "GET", "/group")).json()).toMatchObject({ groupId: created.json().groupId });
    expect((await call("a-web", "GET", "/group")).json()).toBeNull();
    expect((await call("a-pc", "GET", "/group/elsewhere")).json()).toBeNull();
    expect((await call("a-web", "GET", "/group/elsewhere")).json()).toEqual({
      groupId: created.json().groupId, hostUsername: "Alice", itemId: null, memberCount: 1, deviceCount: 1,
    });
  });

  it("le web ne peut ni quitter la salle, ni y inviter, ni toucher à son affinité — rien ne bouge", async () => {
    const call = await makeApp();
    await call("a-pc", "POST", "/group", {});
    expect((await call("a-web", "POST", "/group/leave", {})).statusCode).toBe(404);
    expect((await call("a-web", "POST", "/group/invites", { userIds: ["b"] })).statusCode).toBe(404);
    expect((await call("a-web", "GET", "/affinity")).json()).toEqual({ code: "not_in_group" });
    expect((await call("a-web", "POST", "/affinity/leave", {})).statusCode).toBe(404);
    expect(getRoomOf("a")!.members.get("a")!.devices.size).toBe(1);
  });

  it("« Rejoindre ici » ajoute le web ; « Quitter » sur le web ne retire que lui", async () => {
    const call = await makeApp();
    await call("a-pc", "POST", "/group", {});
    const joined = await call("a-web", "POST", "/group/join-here", {});
    expect(joined.statusCode).toBe(200);
    expect([...getRoomOf("a")!.members.get("a")!.devices.keys()].sort()).toEqual(["jeton-a-pc", "jeton-a-web"]);
    expect((await call("a-web", "POST", "/group/join-here", {})).json()).toEqual({ code: "not_elsewhere" });
    expect((await call("a-web", "POST", "/group/leave", {})).json()).toEqual({ success: true });
    expect([...getRoomOf("a")!.members.get("a")!.devices.keys()]).toEqual(["jeton-a-pc"]);
    // Le dernier appareil : le compte quitte la salle.
    expect((await call("a-pc", "POST", "/group/leave", {})).json()).toEqual({ success: true });
    expect(getRoomOf("a")).toBeNull();
  });

  it("une invitation répondue sur un appareil est retirée de TOUS ceux du compte", async () => {
    const call = await makeApp();
    await call("a-pc", "POST", "/group", {});
    sent.length = 0;
    await call("a-pc", "POST", "/group/invites", { userIds: ["b"] });
    const invite = sent.find((s) => s.msg.type === "wt:invite");
    expect(invite?.to).toBe("b");
    const inviteId = (invite!.msg as unknown as { invite: { inviteId: string } }).invite.inviteId;
    expect((await call("b-web", "POST", `/invites/${inviteId}/respond`, { accept: false })).statusCode).toBe(200);
    expect(sent).toContainEqual({ to: "b", msg: { type: "wt:inviteGone", inviteId } });
  });

  it("hors salle, rien à rejoindre", async () => {
    const call = await makeApp();
    expect((await call("b-web", "POST", "/group/join-here", {})).statusCode).toBe(409);
    expect((await call("b-web", "GET", "/group/elsewhere")).json()).toBeNull();
  });
});
