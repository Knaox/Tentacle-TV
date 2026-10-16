/**
 * « Les invités peuvent demander des films », décidé par l'ADMINISTRATION (1.30.0,
 * `family.guestRequestsAdmin`), par les vraies routes : l'interrupteur — COUPÉ par défaut,
 * mise à jour comprise —, le droit du compte qui coche (défaut NON, administrateur d'office),
 * la case d'un invité SUSPENDUE sans ce droit, gardée, et qui revit quand il revient. Avec
 * les tentatives : un parent sans le droit, un appel direct l'interrupteur coupé.
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
import { setRequestExtensionForTests } from "../src/services/pluginRequests";

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
  // Vigie (ou toute extension qui sait demander un titre) est installé et actif.
  setRequestExtensionForTests(true);
  tokens = seedUsers(h.state);
});

const send = (method: "GET" | "POST" | "PUT", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const rights = (token: string, userId: string, requestTitles: boolean) => send("PUT", `/api/family/guests/${userId}/rights`, token, { requestTitles });
const adminSwitch = (guestRequests: boolean) => send("PUT", "/api/admin/family", tokens.damien, { guestRequests });
const accountRight = (userId: string, grantGuestRequests: string) =>
  send("PUT", `/api/admin/family/accounts/${userId}`, tokens.damien, { grantGuestRequests });
const refusal = (res: { statusCode: number; json: () => { code?: string } }) => [res.statusCode, res.json().code];
const EXTENSION = "/api/plugins/seer/requests";

/** Damien (administrateur Jellyfin) propriétaire, Léa membre PARENT (pas administratrice), Zoé
 *  invitée de Damien, et la session de Zoé ouverte sur la TV de Damien. */
async function family(): Promise<{ zoe: string; session: string; pairing: string }> {
  const id = (await send("POST", "/api/family/invitations", tokens.damien, { userId: IDS.lea })).json().id;
  await send("POST", "/api/family/invitations/accept", tokens.lea, { id });
  await send("PUT", `/api/family/members/${IDS.lea}/role`, tokens.damien, { parent: true });
  const zoe = (await send("POST", "/api/family/guests", tokens.damien, { name: "Zoé", color: "teal" })).json().userId as string;
  const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
  const session = (await openProfile(app, pairing, { profileId: zoe })).json().token as string;
  return { zoe, session, pairing };
}

const guestView = async (token: string, zoe: string) =>
  (await send("GET", "/api/family", token)).json().family.profiles.find((p: { userId: string }) => p.userId === zoe).guestRights;

describe("l'interrupteur de l'administration — coupé par défaut", () => {
  it("après la mise à jour : coupé, annoncé coupé, et personne ne coche — administrateur compris", async () => {
    const { zoe } = await family();
    expect((await send("GET", "/api/admin/family", tokens.damien)).json()).toMatchObject({ guestRequests: false, requestExtension: true });
    expect((await send("GET", "/api/family", tokens.damien)).json().account.creation.grantGuestRequests).toBe(false);
    expect(refusal(await rights(tokens.damien, zoe, true))).toEqual([403, "family.guest_requests_denied"]);
  });

  it("une case cochée AVANT la mise à jour est suspendue, gardée — et revit à l'allumage", async () => {
    const { zoe, session, pairing } = await family();
    // Une ligne d'avant la 1.30.0 : cochée, sans `requestTitlesGrantedBy` (le créateur, Damien, la tient).
    await h.state!.db.client.familyMember.update({ where: { userId: zoe }, data: { canRequestTitles: true } });
    expect(refusal(await send("GET", EXTENSION, session))).toEqual([403, "family.guest_account"]);
    expect(await guestView(tokens.damien, zoe)).toEqual({ requestTitles: false, suspended: true });
    const tv = (await send("GET", "/api/family/tv/profiles", pairing)).json().profiles.find((p: { userId: string }) => p.userId === zoe);
    expect(tv.guestRights).toEqual({ requestTitles: false, suspended: true });

    h.state!.socket.length = 0;
    expect((await adminSwitch(true)).json()).toMatchObject({ guestRequests: true, requestExtension: true });
    // Chaque compte d'une famille relit — l'invité compris, sa TV relit son droit.
    expect(h.state!.socket.some((s) => s.userId === zoe && s.msg.type === "family:update")).toBe(true);
    expect((await send("GET", EXTENSION, session)).json().user).toMatchObject({ userId: zoe, isAdmin: false });
    expect(await guestView(tokens.damien, zoe)).toEqual({ requestTitles: true });
  });

  it("couper suspend ce qui était en vigueur ; rallumer le rend, sans rien régler de nouveau", async () => {
    const { zoe, session } = await family();
    await adminSwitch(true);
    expect((await rights(tokens.damien, zoe, true)).json()).toEqual({ requestTitles: true });
    expect((await send("GET", EXTENSION, session)).statusCode).toBe(200);
    await adminSwitch(false);
    expect(refusal(await send("GET", EXTENSION, session))).toEqual([403, "family.guest_account"]);
    expect((await send("GET", "/api/family", tokens.damien)).json().family.profiles.length).toBe(3);
    expect(await guestView(tokens.damien, zoe)).toEqual({ requestTitles: false, suspended: true });
    await adminSwitch(true);
    expect((await send("GET", EXTENSION, session)).statusCode).toBe(200);
  });

  it("sans extension qui sait demander : rien ne se coche, l'administration ne montre pas l'interrupteur", async () => {
    const { zoe } = await family();
    await adminSwitch(true);
    setRequestExtensionForTests(false);
    expect((await send("GET", "/api/admin/family", tokens.damien)).json()).toMatchObject({ guestRequests: true, requestExtension: false });
    expect(refusal(await rights(tokens.damien, zoe, true))).toEqual([403, "family.guest_requests_denied"]);
  });
});

describe("le droit du compte qui coche", () => {
  it("un parent sans le droit ne coche pas — même par un appel direct ; le défaut est NON", async () => {
    const { zoe, session } = await family();
    await adminSwitch(true);
    expect((await send("GET", "/api/family", tokens.lea)).json().account.creation.grantGuestRequests).toBe(false);
    expect(refusal(await rights(tokens.lea, zoe, true))).toEqual([403, "family.guest_requests_denied"]);
    expect(refusal(await send("GET", EXTENSION, session))).toEqual([403, "family.guest_account"]);
    // Décocher n'exige rien : retirer un droit reste toujours possible.
    expect((await rights(tokens.lea, zoe, false)).json()).toEqual({ requestTitles: false });
  });

  it("accordé à Léa par l'administration : elle coche ; retiré, la case qu'ELLE a cochée est suspendue, puis revit", async () => {
    const { zoe, session } = await family();
    await adminSwitch(true);
    const fiche = (await accountRight(IDS.lea, "allow")).json();
    expect(fiche).toMatchObject({ rights: { grantGuestRequests: "allow" }, allowed: { grantGuestRequests: true }, requestExtension: true });
    expect((await rights(tokens.lea, zoe, true)).json()).toEqual({ requestTitles: true });
    expect((await send("GET", EXTENSION, session)).statusCode).toBe(200);

    h.state!.socket.length = 0;
    await accountRight(IDS.lea, "deny");
    expect(h.state!.socket.some((s) => s.userId === zoe && s.msg.type === "family:update")).toBe(true);
    expect(refusal(await send("GET", EXTENSION, session))).toEqual([403, "family.guest_account"]);
    // Damien voit la case suspendue ; Léa ne peut plus la cocher.
    expect(await guestView(tokens.damien, zoe)).toEqual({ requestTitles: false, suspended: true });
    expect(refusal(await rights(tokens.lea, zoe, true))).toEqual([403, "family.guest_requests_denied"]);

    await accountRight(IDS.lea, "inherit");
    expect(refusal(await send("GET", EXTENSION, session))).toEqual([403, "family.guest_account"]);
    // Le défaut à OUI (Admin › Comptes) le lui rend : la case revit telle quelle.
    await send("PUT", "/api/admin/family/creation", tokens.damien, { grantGuestRequests: true });
    expect((await send("GET", EXTENSION, session)).statusCode).toBe(200);
  });

  it("un administrateur Jellyfin l'a d'office, même refusé dans sa fiche ; cocher reprend la case à son nom", async () => {
    const { zoe, session } = await family();
    await adminSwitch(true);
    await accountRight(IDS.lea, "allow");
    await rights(tokens.lea, zoe, true);
    await accountRight(IDS.lea, "deny");
    expect(await guestView(tokens.damien, zoe)).toEqual({ requestTitles: false, suspended: true });
    await accountRight(IDS.damien, "deny");
    expect((await rights(tokens.damien, zoe, true)).json()).toEqual({ requestTitles: true });
    expect((await send("GET", EXTENSION, session)).statusCode).toBe(200);
    const row = await h.state!.db.client.familyMember.findUnique({ where: { userId: zoe } });
    expect(row?.requestTitlesGrantedBy).toBe(IDS.damien);
  });

  it("la fiche refuse une valeur inconnue, et un invité ne se règle pas", async () => {
    const { zoe } = await family();
    expect(refusal(await accountRight(IDS.lea, "peut-être"))).toEqual([400, "family.invalid_input"]);
    expect(refusal(await accountRight(zoe, "allow"))).toEqual([403, "family.guest_account"]);
    expect(refusal(await send("PUT", "/api/admin/family", tokens.lea, { guestRequests: true }))[0]).toBe(403);
  });
});
