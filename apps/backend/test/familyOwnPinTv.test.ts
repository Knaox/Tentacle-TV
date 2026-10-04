/**
 * Son code PIN depuis SON profil sur la TV (`setOwnPin`, demande de Damien du
 * 04/10), par les vraies routes : poser, changer, retirer — la session de TV
 * qui agit reste, avec son « Ne plus proposer à l'ouverture » ; ailleurs, les
 * sessions de ce profil tombent et le sien s'efface. Le PIN actuel est exigé
 * dès qu'il existe, sur toute session, et compté comme à l'ouverture d'un
 * profil. L'acteur est la session, jamais le corps. Jamais un invité, ni le
 * compte de démonstration, ni le jeton de la TV, ni « voir en tant que ».
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
import { signImpersonationToken } from "../src/services/jwt";

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

const setPin = (token: string, body: Record<string, unknown>) =>
  app.inject({ method: "PUT", url: "/api/family/pin", headers: bearer(token), payload: body });
const post = (url: string, token: string, payload: unknown) => app.inject({ method: "POST", url, headers: bearer(token), payload: payload as object });
const tv = async () => enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
const alive = async (token: string) => (await app.inject({ method: "GET", url: "/api/protected", headers: bearer(token) })).statusCode === 200;
const sticky = async (pairing: string) =>
  (await app.inject({ method: "GET", url: "/api/family/tv/profiles", headers: bearer(pairing) })).json().stickyProfileId as string | null;
const pinOf = (userId: string) => h.state!.db.data.profilePin.some((row) => row.userId === userId);

async function open(pairing: string, profileId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await openProfile(app, pairing, { profileId, ...extra });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().token as string;
}

describe("son PIN depuis son profil sur la TV", () => {
  it("se pose, se change, se retire : la session qui agit reste, les autres tombent", async () => {
    const salon = await tv();
    const chambre = await tv();
    const here = await open(salon, IDS.damien, { remember: true });
    const there = await open(chambre, IDS.damien, { remember: true });

    expect((await setPin(here, { pin: "4242" })).json()).toEqual({ hasPin: true });
    expect(await alive(here)).toBe(true);
    expect(await alive(there)).toBe(false);
    expect(h.state!.ended).toContainEqual([expect.any(String), "pin_changed"]);
    // « Ne plus proposer à l'ouverture » : gardé sur CETTE TV, effacé ailleurs.
    expect(await sticky(salon)).toBe(IDS.damien);
    expect(await sticky(chambre)).toBeNull();

    // Le changer, puis le retirer, exige le PIN actuel ; la session reste.
    expect((await setPin(here, { pin: "1357" })).json().code).toBe("family.pin_required");
    expect((await setPin(here, { pin: "1357", currentPin: "4242" })).json()).toEqual({ hasPin: true });
    expect((await setPin(here, { pin: null, currentPin: "1357" })).json()).toEqual({ hasPin: false });
    expect(pinOf(IDS.damien)).toBe(false);
    expect(await alive(here)).toBe(true);
    // Sa session personnelle ne dépend pas du PIN.
    expect(await alive(tokens.damien)).toBe(true);
  });

  it("le PIN actuel suit le compteur de l'ouverture d'un profil : mêmes essais, même blocage", async () => {
    expect((await setPin(tokens.damien, { pin: "4242" })).json()).toEqual({ hasPin: true });
    const salon = await tv();
    const here = await open(salon, IDS.damien, { pin: "4242" });
    // Une faute de frappe dans le NOUVEAU PIN ne coûte pas d'essai.
    expect((await setPin(here, { pin: "12", currentPin: "0000" })).json().code).toBe("family.pin_format");
    expect((await setPin(here, { pin: "1111", currentPin: "0000" })).json()).toMatchObject({ code: "family.pin_invalid", attemptsLeft: 4 });
    // Le même compteur qu'à l'ouverture, sur une autre TV comme sur le web.
    const chambre = await tv();
    expect((await openProfile(app, chambre, { profileId: IDS.damien, pin: "0000" })).json()).toMatchObject({ attemptsLeft: 3 });
    expect((await setPin(tokens.damien, { pin: "1111", currentPin: "0000" })).json()).toMatchObject({ attemptsLeft: 2 });
    expect((await setPin(here, { pin: "1111", currentPin: "0000" })).json()).toMatchObject({ attemptsLeft: 1 });
    const locked = await setPin(here, { pin: "1111", currentPin: "0000" });
    expect(locked.statusCode).toBe(423);
    expect(locked.json().lockedUntil).toBeTruthy();
    // Pendant le blocage, même le bon PIN échoue — et le PIN n'a pas bougé.
    expect((await setPin(here, { pin: "1111", currentPin: "4242" })).statusCode).toBe(423);
    expect((await openProfile(app, chambre, { profileId: IDS.damien, pin: "4242" })).statusCode).toBe(423);
  });

  it("le PIN actuel est exigé sur toute session, web compris ; sans PIN posé, rien à présenter", async () => {
    expect((await setPin(tokens.damien, { pin: "4242" })).json()).toEqual({ hasPin: true });
    expect((await setPin(tokens.damien, { pin: "1357" })).json().code).toBe("family.pin_required");
    expect((await setPin(tokens.damien, { pin: null })).json().code).toBe("family.pin_required");
    expect((await setPin(tokens.damien, { pin: "1357", currentPin: "4242" })).json()).toEqual({ hasPin: true });
  });

  it("un membre, sur la TV du propriétaire : son PIN à lui — l'acteur est la session, jamais le corps", async () => {
    const id = (await post("/api/family/invitations", tokens.damien, { userId: IDS.lea })).json().id;
    await post("/api/family/invitations/accept", tokens.lea, { id });
    const salon = await tv();
    const lea = await open(salon, IDS.lea);
    expect((await setPin(lea, { pin: "2468", userId: IDS.damien })).json()).toEqual({ hasPin: true });
    expect(pinOf(IDS.lea)).toBe(true);
    expect(pinOf(IDS.damien)).toBe(false);
    expect(await alive(lea)).toBe(true);
  });

  it("jamais un invité, ni le jeton de la TV, ni « voir en tant que »", async () => {
    const zoe = (await post("/api/family/guests", tokens.damien, { name: "Zoé", color: "teal" })).json().userId as string;
    const salon = await tv();
    const guest = await setPin(await open(salon, zoe), { pin: "1111" });
    expect(guest.statusCode).toBe(403);
    expect(guest.json().code).toBe("family.guest_account");
    expect(pinOf(zoe)).toBe(false);

    // Le jeton « profils seuls » de la TV, puis celui d'une TV d'avant les profils.
    expect((await setPin(salon, { pin: "1111" })).statusCode).toBe(401);
    const legacy = await setPin(await pairTv(h.state!, IDS.damien, "Damien"), { pin: "1111" });
    expect(legacy.json().code).toBe("family.personal_session_required");

    const viewAs = await signImpersonationToken({ userId: IDS.lea, username: "Léa", adminUserId: IDS.damien, adminUsername: "Damien" });
    expect((await setPin(viewAs, { pin: "1111" })).json().code).toBe("family.personal_session_required");
    expect(pinOf(IDS.lea)).toBe(false);
  });

  it("le compte de démonstration n'en pose jamais : un relecteur fermerait le profil au suivant", async () => {
    await h.state!.db.client.provisioningCode.create({ data: { code: "X".repeat(12), jellyfinUserId: IDS.demo, username: "Demo" } });
    const res = await setPin(tokens.demo, { pin: "1111" });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("family.review_account");
    expect(pinOf(IDS.demo)).toBe(false);
  });
});
