/**
 * Famille v2 sur les TV, par les vraies routes : la TV de N'IMPORTE QUEL
 * membre montre toute la famille, avec les mêmes règles partout (PIN,
 * révocations) ; un membre qui part perd les autres profils sur ses TV et
 * quitte celles des autres ; la dissolution ne laisse à chaque TV que son
 * compte ; « Gérer les profils » sur la TV d'un membre : SES droits, derrière
 * SON PIN.
 */

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: null as null | import("./familyMocks").HarnessState,
  fetch: null as null | ((input: string | URL, init?: RequestInit) => Promise<Response>),
}));
vi.mock("../src/services/configStore", async () => (await import("./familyMocks")).configStoreMock(() => h.state!));
vi.mock("../src/services/db", async () => (await import("./familyMocks")).dbMock(() => h.state!));
vi.mock("../src/services/wsManager", async () => (await import("./familyMocks")).wsManagerMock(() => h.state!));
vi.mock("../src/services/pushService", async () => (await import("./familyMocks")).pushServiceMock(() => h.state!));
vi.mock("../src/services/deviceSessions/deviceAuth", async () => (await import("./familyMocks")).deviceAuthMock());
vi.mock("../src/services/deviceSessions/gateway", async () => (await import("./familyMocks")).gatewayMock());

import { freshState } from "./familyMocks";
import { fakeJellyfinUsersFetch } from "./fakeJellyfinUsers";
import { IDS, bearer, buildFamilyApp, enroll, openProfile, pairTv, resetCaches, seedUsers } from "./familyHarness";
import { sweepFamily } from "../src/services/family/familySweep";

let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;

beforeAll(async () => {
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => h.fetch!(input, init));
  app = await buildFamilyApp();
});
afterAll(async () => {
  await app.close();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  h.state = freshState();
  h.fetch = fakeJellyfinUsersFetch(h.state.jf);
  resetCaches();
  tokens = seedUsers(h.state);
});

const send = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const ended = async (token: string) => (await send("GET", "/api/protected", token)).json().profileEnded === true;
const profiles = async (pairing: string) => (await send("GET", "/api/family/tv/profiles", pairing)).json();
const session = async (pairing: string, profileId: string, pin?: string) =>
  (await openProfile(app, pairing, { profileId, ...(pin && { pin }) })).json().token as string;

/** La famille de Damien : Léa et Hugo membres, Zoé invitée ; une TV pour Damien, une pour Léa. */
async function family(): Promise<{ damienTv: string; leaTv: string; zoe: string }> {
  for (const [userId, token] of [[IDS.lea, tokens.lea], [IDS.hugo, tokens.hugo]] as const) {
    const id = (await send("POST", "/api/family/invitations", tokens.damien, { userId })).json().id;
    expect((await send("POST", "/api/family/invitations/accept", token, { id })).statusCode).toBe(200);
  }
  const zoe = (await send("POST", "/api/family/guests", tokens.damien, { name: "Zoé", color: "teal" })).json().userId as string;
  const damienTv = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien", "Salon"));
  const leaTv = await enroll(app, await pairTv(h.state!, IDS.lea, "Léa", "Chambre"));
  return { damienTv, leaTv, zoe };
}

describe("la TV d'un membre", () => {
  it("montre TOUTE la famille, avec ce que chacun y gérerait", async () => {
    const { leaTv, zoe } = await family();
    const listing = await profiles(leaTv);
    expect(listing.pairedBy).toEqual({ userId: IDS.lea, name: "Léa" });
    expect(listing.profiles.map((p: { userId: string; kind: string }) => [p.userId, p.kind])).toEqual([
      [IDS.damien, "owner"],
      [IDS.lea, "member"],
      [IDS.hugo, "member"],
      [zoe, "guest"],
    ]);
    const byId = new Map(listing.profiles.map((p: { userId: string }) => [p.userId, p]));
    expect(byId.get(IDS.damien)).toMatchObject({ createdBy: null, manage: { manageMembers: true, manageGuests: "all" } });
    expect(byId.get(IDS.lea)).toMatchObject({ manage: { manageMembers: false, createGuests: false, manageGuests: "own" } });
    expect(byId.get(zoe)).toMatchObject({ createdBy: IDS.damien, manage: null });
    expect(listing.canManage).toBe(true);
  });

  it("ouvre le profil du propriétaire selon SON PIN, compté pour toutes les TV", async () => {
    const { damienTv, leaTv } = await family();
    await send("PUT", "/api/family/pin", tokens.damien, { pin: "4242" });
    expect((await openProfile(app, leaTv, { profileId: IDS.damien })).json().code).toBe("family.pin_required");
    expect((await openProfile(app, leaTv, { profileId: IDS.damien, pin: "0000" })).json()).toMatchObject({ attemptsLeft: 4 });
    expect((await openProfile(app, damienTv, { profileId: IDS.damien, pin: "0000" })).json()).toMatchObject({ attemptsLeft: 3 });
    expect((await openProfile(app, leaTv, { profileId: IDS.damien, pin: "4242" })).statusCode).toBe(200);
  });
});

describe("les coupures de la famille partagée", () => {
  it("un membre retiré : ses TV perdent les AUTRES profils, celles des autres perdent le sien", async () => {
    const { damienTv, leaTv } = await family();
    const damienOnLeaTv = await session(leaTv, IDS.damien);
    const leaOnDamienTv = await session(damienTv, IDS.lea);
    const leaSecondTv = await enroll(app, await pairTv(h.state!, IDS.lea, "Léa", "Bureau"));
    const leaAtHome = await session(leaSecondTv, IDS.lea);
    expect((await send("DELETE", `/api/family/members/${IDS.lea}`, tokens.damien)).json()).toEqual({ removed: true });
    expect(await ended(damienOnLeaTv)).toBe(true);
    expect(await ended(leaOnDamienTv)).toBe(true);
    expect(await ended(leaAtHome)).toBe(false);
    expect((await profiles(leaTv)).profiles.map((p: { userId: string }) => p.userId)).toEqual([IDS.lea]);
  });

  it("un membre qui part : de même", async () => {
    const { damienTv, leaTv } = await family();
    const hugoOnLeaTv = await session(leaTv, IDS.hugo);
    const leaOnDamienTv = await session(damienTv, IDS.lea);
    const familyId = h.state!.db.data.family[0].id as string;
    expect((await send("POST", `/api/family/memberships/${familyId}/leave`, tokens.lea)).json()).toEqual({ left: true });
    expect(await ended(hugoOnLeaTv)).toBe(true);
    expect(await ended(leaOnDamienTv)).toBe(true);
    expect(h.state!.ended.map(([, reason]) => reason)).toContain("left");
  });

  it("la dissolution ne laisse à chaque TV que son propre compte", async () => {
    const { damienTv, leaTv } = await family();
    const damienAtHome = await session(damienTv, IDS.damien);
    const damienOnLeaTv = await session(leaTv, IDS.damien);
    expect((await send("DELETE", "/api/family", tokens.damien, { confirm: "dissolve" })).json()).toEqual({ dissolved: true });
    expect(await ended(damienOnLeaTv)).toBe(true);
    expect(await ended(damienAtHome)).toBe(false);
    expect((await profiles(leaTv)).profiles.map((p: { userId: string }) => p.userId)).toEqual([IDS.lea]);
  });

  it("« Familles » coupé par l'administration : chaque TV ne garde que son compte", async () => {
    const { leaTv } = await family();
    const damienOnLeaTv = await session(leaTv, IDS.damien);
    expect((await send("PUT", "/api/admin/family", tokens.damien, { families: false })).json()).toMatchObject({ families: false });
    expect(await ended(damienOnLeaTv)).toBe(true);
    expect((await profiles(leaTv)).profiles.map((p: { userId: string; kind: string }) => [p.userId, p.kind])).toEqual([[IDS.lea, "member"]]);
  });

  it("le balayage coupe une session qu'aucune TV ne devrait plus montrer", async () => {
    const { leaTv } = await family();
    const hugoOnLeaTv = await session(leaTv, IDS.hugo);
    // Comme après une fusion de la migration : Hugo n'est plus dans la famille de la TV.
    const rows = h.state!.db.data.familyMember;
    rows.splice(rows.findIndex((row) => row.userId === IDS.hugo), 1);
    await sweepFamily();
    expect(await ended(hugoOnLeaTv)).toBe(true);
    expect(h.state!.ended.map(([, reason]) => reason)).toContain("family_changed");
  });
});

describe("« Gérer les profils » sur la TV d'un membre", () => {
  async function leaManaging(): Promise<{ manage: string; zoe: string }> {
    const { leaTv, zoe } = await family();
    await send("PUT", "/api/family/pin", tokens.lea, { pin: "1357" });
    const manage = await session(leaTv, IDS.lea, "1357");
    return { manage, zoe };
  }
  const unlock = (token: string, pin?: string) => send("POST", "/api/family/tv/manage/unlock", token, pin ? { pin } : {});

  it("derrière SON PIN, avec SES droits", async () => {
    const { manage } = await leaManaging();
    expect((await send("GET", "/api/family", manage)).json().code).toBe("family.manage_locked");
    expect((await unlock(manage, "4242")).json().code).toBe("family.pin_invalid");
    expect((await unlock(manage, "1357")).json()).toMatchObject({ rights: { manageMembers: false, createGuests: false, manageGuests: "own" } });
    expect((await send("GET", "/api/family", manage)).json().family).toMatchObject({ role: "member" });
  });

  it("ses invités seulement, et jamais un geste de propriétaire", async () => {
    const { manage, zoe } = await leaManaging();
    await unlock(manage, "1357");
    expect((await send("POST", "/api/family/guests", manage, { name: "Léo", color: "pink" })).json().code).toBe("family.guest_right_required");
    await send("PUT", `/api/family/members/${IDS.lea}/rights`, tokens.damien, { createGuests: true });
    const leo = (await send("POST", "/api/family/guests", manage, { name: "Léo", color: "pink" })).json();
    expect(leo).toMatchObject({ createdBy: IDS.lea });
    expect((await send("DELETE", `/api/family/guests/${zoe}`, manage)).json().code).toBe("family.not_owner");
    expect((await send("DELETE", `/api/family/guests/${leo.userId}`, manage)).json()).toEqual({ deleted: true });
    expect((await send("POST", "/api/family/invitations", manage, { userId: IDS.cache })).json().code).toBe("family.not_owner");
    expect((await send("DELETE", `/api/family/members/${IDS.hugo}`, manage)).json().code).toBe("family.not_owner");
    expect((await send("PUT", `/api/family/members/${IDS.hugo}/rights`, manage, { createGuests: true })).json().code).toBe("family.not_owner");
  });

  it("le propriétaire, sur la TV d'un membre, gère avec SES droits ; un invité, jamais", async () => {
    const { leaTv, zoe } = await family();
    const owner = await session(leaTv, IDS.damien);
    expect((await unlock(owner)).json()).toMatchObject({ rights: { manageMembers: true, manageGuests: "all" } });
    expect((await send("POST", "/api/family/invitations", owner, { userId: IDS.cache })).statusCode).toBe(200);
    const guest = await session(leaTv, zoe);
    expect((await unlock(guest)).json().code).toBe("family.not_owner");
  });
});
