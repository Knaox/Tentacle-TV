/**
 * Les routes d'une playlist partagée entre comptes : seul le propriétaire partage, change un droit, retire ; un
 * membre quitte ; ni « voir en tant que », ni un invité de la Famille ; un compte qui n'est pas candidat (invité,
 * désactivé, soi) n'est jamais ajouté ; la capacité absente = aucune route.
 */

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberRow } from "./memberStore";

const ME = "1".repeat(32);
const BOB = "2".repeat(32);
const GUEST = "3".repeat(32);
const PL = "0123456789abcdef0123456789abcdef";

const state = vi.hoisted(() => ({
  session: "personal" as string,
  guest: false,
  declared: true,
  right: "owner" as string | null,
  members: [] as MemberRow[],
  noticed: [] as string[],
}));

vi.mock("../routes/requestView", () => ({ userOf: () => ({ userId: "1".repeat(32), username: "Knaoxtest", isAdmin: false, session: state.session }) }));
vi.mock("../../serverCapabilities/declaredCapabilities", () => ({
  capabilityGate: () => async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => (state.declared ? undefined : reply.status(404).send({ error: "not_available" })),
}));
vi.mock("../../services/family/familyGuestMarkers", () => ({ isFamilyGuest: async () => state.guest }));
vi.mock("./playlistAccess", () => ({
  playlistAccess: async () => (state.right === undefined ? null : { playlist: { Id: PL, Name: "Été" }, readerId: "1".repeat(32), right: state.right }),
}));
vi.mock("./memberPeople", () => ({
  shareCandidates: async () => [{ userId: "2".repeat(32), name: "Knaoxtest2", imageTag: null }],
  mayReceive: async (_owner: string, member: string) => member === "2".repeat(32),
}));
vi.mock("./memberViews", () => ({
  sharingFor: async () => ({ role: "owner", right: "owner", owner: { userId: "1".repeat(32), name: "Knaoxtest", imageTag: null }, members: state.members.map((m) => ({ userId: m.memberId, name: "x", imageTag: null, right: m.right })) }),
}));
vi.mock("./memberEvents", () => ({ tellAccountsAbout: () => undefined, tellPlaylistPeople: async () => undefined }));
vi.mock("./memberNotice", () => ({ noticeShared: async (member: string) => void state.noticed.push(member) }));
vi.mock("./memberStore", () => ({
  membersOf: async () => state.members,
  membershipOf: async (_p: string, m: string) => state.members.find((x) => x.memberId === m) ?? null,
  putMember: async (playlistId: string, ownerUserId: string, memberId: string, right: MemberRow["right"]) => {
    const before = state.members.find((m) => m.memberId === memberId);
    if (before) before.right = right;
    else state.members.push({ playlistId, ownerUserId, memberId, right, createdAt: 0 });
    return !before;
  },
  dropMember: async (_p: string, memberId: string) => {
    const before = state.members.length;
    state.members = state.members.filter((m) => m.memberId !== memberId);
    return state.members.length < before;
  },
}));

import { musicPlaylistMemberRoutes } from "./memberRoutes";

async function call(method: "GET" | "PUT" | "PATCH" | "DELETE", url: string, payload?: object) {
  const app = Fastify();
  await app.register(async (scope) => musicPlaylistMemberRoutes(scope), { prefix: "/api/music" });
  const res = await app.inject({ method, url, payload });
  await app.close();
  return res;
}

beforeEach(() => {
  Object.assign(state, { session: "personal", guest: false, declared: true, right: "owner", members: [], noticed: [] });
});

describe("partager une playlist avec un compte du serveur", () => {
  it("le propriétaire partage : le membre est gardé avec son droit, et la cloche ne sonne qu'une fois", async () => {
    expect((await call("PUT", `/api/music/playlists/${PL}/members`, { userId: BOB, right: "add" })).statusCode).toBe(200);
    expect(state.members.map((m) => [m.memberId, m.right])).toEqual([[BOB, "add"]]);
    expect((await call("PATCH", `/api/music/playlists/${PL}/members/${BOB}`, { right: "remove" })).statusCode).toBe(200);
    expect(state.members[0]!.right).toBe("remove");
    expect(state.noticed).toEqual([BOB]);
  });

  it("un compte qui n'est pas candidat (invité de la Famille, soi, désactivé) : 404, rien de gardé", async () => {
    expect((await call("PUT", `/api/music/playlists/${PL}/members`, { userId: GUEST, right: "read" })).statusCode).toBe(404);
    expect((await call("PUT", `/api/music/playlists/${PL}/members`, { userId: ME, right: "read" })).statusCode).toBe(404);
    expect(state.members).toEqual([]);
  });

  it("un droit inconnu ou un identifiant mal formé : 400", async () => {
    expect((await call("PUT", `/api/music/playlists/${PL}/members`, { userId: BOB, right: "owner" })).statusCode).toBe(400);
    expect((await call("PUT", `/api/music/playlists/${PL}/members`, { userId: "x", right: "read" })).statusCode).toBe(400);
  });

  it("un membre ne partage pas, ne change pas un droit, ne retire personne", async () => {
    state.right = "remove";
    state.members = [{ playlistId: PL, memberId: BOB, ownerUserId: ME, right: "read", createdAt: 0 }];
    expect((await call("PUT", `/api/music/playlists/${PL}/members`, { userId: BOB, right: "remove" })).statusCode).toBe(403);
    expect((await call("PATCH", `/api/music/playlists/${PL}/members/${BOB}`, { right: "remove" })).statusCode).toBe(403);
    expect((await call("DELETE", `/api/music/playlists/${PL}/members/${BOB}`)).statusCode).toBe(403);
    expect(state.members[0]!.right).toBe("read");
  });

  it("une playlist vue sans droit (publique de Jellyfin) : 404, comme une inconnue", async () => {
    state.right = null;
    expect((await call("GET", `/api/music/playlists/${PL}/members`)).statusCode).toBe(404);
  });

  it("« voir en tant que » et un invité de la Famille : 403 avant tout", async () => {
    state.session = "impersonation";
    expect((await call("PUT", `/api/music/playlists/${PL}/members`, { userId: BOB, right: "read" })).statusCode).toBe(403);
    expect((await call("GET", "/api/music/playlist-members/candidates")).statusCode).toBe(403);
    state.session = "personal";
    state.guest = true;
    expect((await call("DELETE", `/api/music/playlists/${PL}/membership`)).statusCode).toBe(403);
  });

  it("le propriétaire retire un membre ; un membre quitte (404 s'il ne l'était pas)", async () => {
    state.members = [{ playlistId: PL, memberId: BOB, ownerUserId: ME, right: "read", createdAt: 0 }];
    expect((await call("DELETE", `/api/music/playlists/${PL}/members/${BOB}`)).statusCode).toBe(200);
    expect(state.members).toEqual([]);
    state.members = [{ playlistId: PL, memberId: ME, ownerUserId: BOB, right: "read", createdAt: 0 }];
    expect((await call("DELETE", `/api/music/playlists/${PL}/membership`)).json()).toEqual({ ok: true });
    expect((await call("DELETE", `/api/music/playlists/${PL}/membership`)).statusCode).toBe(404);
  });

  it("les candidats ; sans la capacité, aucune route", async () => {
    expect((await call("GET", "/api/music/playlist-members/candidates")).json()).toEqual([{ userId: BOB, name: "Knaoxtest2", imageTag: null }]);
    state.declared = false;
    expect((await call("GET", "/api/music/playlist-members/candidates")).statusCode).toBe(404);
  });
});
