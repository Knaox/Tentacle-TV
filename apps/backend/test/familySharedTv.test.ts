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
import { allowGuestRequests, IDS, bearer, buildFamilyApp, enroll, openProfile, pairTv, resetCaches, seedUsers } from "./familyHarness";
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
  // 1.30.0 : l'administration laisse les invités demander (le sens de ce banc, d'avant ce réglage).
  allowGuestRequests(h.state!, { everyone: true });
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
    // Sans code, personne ne gère depuis un profil (1.30.0) : qui aurait un geste apprend qu'un code le
    // lui ouvrirait ; un membre sans droit ni invité à lui n'a RIEN à y faire — pas même « posez un code ».
    const before = new Map(listing.profiles.map((p: { userId: string }) => [p.userId, p]));
    expect(before.get(IDS.damien)).toMatchObject({ manage: null, manageNeedsPin: true });
    expect(before.get(IDS.lea)).toMatchObject({ manage: null, manageNeedsPin: false });
    await send("PUT", `/api/family/members/${IDS.lea}/rights`, tokens.damien, { createGuests: true });
    const granted = new Map((await profiles(leaTv)).profiles.map((p: { userId: string }) => [p.userId, p]));
    expect(granted.get(IDS.lea)).toMatchObject({ manage: null, manageNeedsPin: true });
    expect(before.get(zoe)).toMatchObject({ createdBy: IDS.damien, manage: null, manageNeedsPin: false });
    expect(listing.canManage).toBe(false);

    await send("PUT", "/api/family/pin", tokens.damien, { pin: "4242" });
    await send("PUT", "/api/family/pin", tokens.lea, { pin: "1357" });
    const after = await profiles(leaTv);
    const byId = new Map(after.profiles.map((p: { userId: string }) => [p.userId, p]));
    expect(byId.get(IDS.damien)).toMatchObject({ createdBy: null, manage: { manageMembers: true, manageGuests: "all" }, manageNeedsPin: false });
    expect(byId.get(IDS.lea)).toMatchObject({ manage: { manageMembers: false, createGuests: true, manageGuests: "own" } });
    expect(after.canManage).toBe(true);
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
  // Léa a un geste réel (« peut créer des invités ») : sans lui, rien ne lui est ouvert (`rightsReachSomething`).
  async function leaManaging(): Promise<{ manage: string; zoe: string }> {
    const { leaTv, zoe } = await family();
    await send("PUT", `/api/family/members/${IDS.lea}/rights`, tokens.damien, { createGuests: true });
    await send("PUT", "/api/family/pin", tokens.lea, { pin: "1357" });
    const manage = await session(leaTv, IDS.lea, "1357");
    return { manage, zoe };
  }
  const unlock = (token: string, pin?: string) => send("POST", "/api/family/tv/manage/unlock", token, pin ? { pin } : {});

  it("ouvert par SON code : la gestion s'ouvre avec la session, avec SES droits", async () => {
    const { manage } = await leaManaging();
    expect((await send("GET", "/api/family", manage)).json().family).toMatchObject({ role: "member", rights: { manageGuests: "own" } });
  });

  it("ouvert sans code (« Rester sur ce profil ») : verrouillé jusqu'à SON PIN", async () => {
    const { leaTv } = await family();
    await send("PUT", `/api/family/members/${IDS.lea}/rights`, tokens.damien, { createGuests: true });
    await send("PUT", "/api/family/pin", tokens.lea, { pin: "1357" });
    await openProfile(app, leaTv, { profileId: IDS.lea, pin: "1357", remember: true });
    const sticky = await session(leaTv, IDS.lea);
    expect((await send("GET", "/api/family", sticky)).json().code).toBe("family.manage_locked");
    expect((await unlock(sticky, "4242")).json().code).toBe("family.pin_invalid");
    expect((await unlock(sticky, "1357")).json()).toMatchObject({ rights: { manageMembers: false, createGuests: true, manageGuests: "own" } });
    expect((await send("GET", "/api/family", sticky)).json().family).toMatchObject({ role: "member" });
  });

  it("ses invités seulement, et jamais un geste de propriétaire", async () => {
    const { manage, zoe } = await leaManaging();
    const leo = (await send("POST", "/api/family/guests", manage, { name: "Léo", color: "pink" })).json();
    expect(leo).toMatchObject({ createdBy: IDS.lea });
    // Le droit retiré : elle garde la main sur Léo, mais n'en crée plus.
    await send("PUT", `/api/family/members/${IDS.lea}/rights`, tokens.damien, { createGuests: false });
    expect((await send("POST", "/api/family/guests", manage, { name: "Max", color: "teal" })).json().code).toBe("family.guest_right_required");
    expect((await send("DELETE", `/api/family/guests/${zoe}`, manage)).json().code).toBe("family.not_owner");
    expect((await send("DELETE", `/api/family/guests/${leo.userId}`, manage)).json()).toEqual({ deleted: true });
    expect((await send("POST", "/api/family/invitations", manage, { userId: IDS.cache })).json().code).toBe("family.not_owner");
    expect((await send("DELETE", `/api/family/members/${IDS.hugo}`, manage)).json().code).toBe("family.not_owner");
    expect((await send("PUT", `/api/family/members/${IDS.hugo}/rights`, manage, { createGuests: true })).json().code).toBe("family.not_owner");
  });

  it("un parent, sur la TV du propriétaire, gère les enfants depuis SON profil (1.30.0) ; jamais un geste personnel", async () => {
    const { damienTv, zoe } = await family();
    expect((await send("PUT", `/api/family/members/${IDS.lea}/role`, tokens.damien, { parent: true })).statusCode).toBe(200);
    await send("PUT", "/api/family/pin", tokens.lea, { pin: "1357" });
    expect((await profiles(damienTv)).profiles.find((p: { userId: string }) => p.userId === IDS.lea)).toMatchObject({ parent: true });
    expect((await profiles(damienTv)).profiles.find((p: { userId: string }) => p.userId === IDS.hugo).parent).toBeUndefined();
    const parent = await session(damienTv, IDS.lea, "1357");
    expect((await send("GET", "/api/family", parent)).json().family).toMatchObject({ parent: true, rights: { manageGuests: "all", manageMinors: true } });
    expect((await send("PUT", `/api/family/guests/${zoe}/rights`, parent, { requestTitles: true })).json()).toEqual({ requestTitles: true });
    expect((await send("PUT", `/api/family/guests/${zoe}/pin`, parent, { pin: "2468" })).json()).toEqual({ hasPin: true });
    expect((await send("DELETE", `/api/family/guests/${zoe}`, parent)).json()).toEqual({ deleted: true });
    expect((await send("PUT", `/api/family/members/${IDS.hugo}/rights`, parent, { createGuests: true })).json().code).toBe("family.not_owner");
    const familyId = h.state!.db.data.family[0].id as string;
    expect((await send("POST", `/api/family/memberships/${familyId}/leave`, parent)).json().code).toBe("family.personal_session_required");
  });

  it("le propriétaire, sur la TV d'un membre, gère avec SES droits ; un invité, jamais", async () => {
    const { leaTv, zoe } = await family();
    const unprotected = await session(leaTv, IDS.damien);
    expect((await unlock(unprotected)).json().code).toBe("family.manage_pin_required");
    expect((await send("GET", "/api/family", unprotected)).json().code).toBe("family.manage_pin_required");
    await send("PUT", "/api/family/pin", tokens.damien, { pin: "4242" });
    const owner = await session(leaTv, IDS.damien, "4242");
    expect((await unlock(owner, "4242")).json()).toMatchObject({ rights: { manageMembers: true, manageGuests: "all" } });
    expect((await send("POST", "/api/family/invitations", owner, { userId: IDS.cache })).statusCode).toBe(200);
    const guest = await session(leaTv, zoe);
    expect((await unlock(guest)).json().code).toBe("family.not_owner");
  });
});
