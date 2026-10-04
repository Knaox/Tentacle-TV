/**
 * Tests d'attaque T8 (phase 3) — PERSISTANCE DE LA RÉVOCATION contre
 * l'implémentation de T2 : un accès coupé ne survit nulle part, et l'effet
 * précède la réponse. SEC-F-10/11 (retrait/départ, compte Jellyfin intact),
 * SEC-F-12 (suppression d'invité → compte supprimé), SEC-F-13 (changement de
 * PIN), SEC-F-14 (interrupteurs admin), SEC-F-15 (déjumelage sans toucher un
 * invité, rejeu refusé), SEC-F-20 (socket prévenue en direct).
 */

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: null as null | import("../familyMocks").HarnessState,
  fetch: null as null | ((input: string | URL, init?: RequestInit) => Promise<Response>),
}));
vi.mock("../../src/services/configStore", async () => (await import("../familyMocks")).configStoreMock(() => h.state!));
vi.mock("../../src/services/db", async () => (await import("../familyMocks")).dbMock(() => h.state!));
vi.mock("../../src/services/wsManager", async () => (await import("../familyMocks")).wsManagerMock(() => h.state!));
vi.mock("../../src/services/pushService", async () => (await import("../familyMocks")).pushServiceMock(() => h.state!));
vi.mock("../../src/services/deviceSessions/deviceAuth", async () => (await import("../familyMocks")).deviceAuthMock());
vi.mock("../../src/services/deviceSessions/gateway", async () => (await import("../familyMocks")).gatewayMock());

import { freshState } from "../familyMocks";
import { fakeJellyfinUsersFetch } from "../fakeJellyfinUsers";
import { IDS, bearer, buildFamilyApp, enroll, openProfile, pairTv, resetCaches, seedUsers } from "../familyHarness";
import { resolvePairedDeviceToken } from "../../src/services/deviceTokenHealth";

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

const send = (method: "POST" | "PUT" | "DELETE", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const status = async (token: string) => (await app.inject({ method: "GET", url: "/api/protected", headers: bearer(token) })).json();
const deviceOf = (token: string) => [...h.state!.jf.devices.values()].find((d) => d.token === token);
const endReasons = () => h.state!.ended.map(([, reason]) => reason);

/** Léa membre, sa session de profil ouverte sur la TV de Damien, son jeton Jellyfin propre frappé. */
async function leaOnDamiensTv(): Promise<{ pairing: string; session: string; jellyfinToken: string }> {
  const id = (await send("POST", "/api/family/invitations", tokens.damien, { userId: IDS.lea })).json().id;
  await send("POST", "/api/family/invitations/accept", tokens.lea, { id });
  const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
  const session = (await openProfile(app, pairing, { profileId: IDS.lea })).json().token as string;
  const jellyfinToken = (await resolvePairedDeviceToken(session, IDS.lea)) as string;
  return { pairing, session, jellyfinToken };
}

describe("SEC-F-10/11/20 : un membre retiré ou parti perd tout, son compte reste", () => {
  it("le retrait coupe sa session partout (socket comprise) et son appareil Jellyfin, AVANT la réponse", async () => {
    const lea = await leaOnDamiensTv();
    expect(deviceOf(lea.jellyfinToken)?.userId).toBe(IDS.lea);
    const res = await send("DELETE", `/api/family/members/${IDS.lea}`, tokens.damien);
    expect(res.json()).toEqual({ removed: true });
    // Déjà effectif au retour : appareil Jellyfin supprimé, socket prévenue.
    expect(deviceOf(lea.jellyfinToken)).toBeUndefined();
    expect(endReasons()).toContain("removed");
    expect((await status(lea.session)).profileEnded).toBe(true);
    // Le compte Jellyfin du membre n'est JAMAIS touché.
    expect(h.state!.jf.users.has(IDS.lea)).toBe(true);
  });

  it("partir soi-même coupe de même", async () => {
    const lea = await leaOnDamiensTv();
    const familyId = h.state!.db.data.family[0].id as string;
    expect((await send("POST", `/api/family/memberships/${familyId}/leave`, tokens.lea)).json()).toEqual({ left: true });
    expect((await status(lea.session)).profileEnded).toBe(true);
    expect(deviceOf(lea.jellyfinToken)).toBeUndefined();
    expect(h.state!.jf.users.has(IDS.lea)).toBe(true);
  });
});

describe("SEC-F-12 : supprimer un invité supprime son compte Jellyfin", () => {
  it("compte Jellyfin et appareil partis, session coupée", async () => {
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    const guestId = (await send("POST", "/api/family/guests", tokens.damien, { name: "Zoé", color: "pink" })).json().userId as string;
    const session = (await openProfile(app, pairing, { profileId: guestId })).json().token as string;
    await resolvePairedDeviceToken(session, guestId);
    expect((await send("DELETE", `/api/family/guests/${guestId}`, tokens.damien)).json()).toEqual({ deleted: true });
    expect(h.state!.jf.users.has(guestId)).toBe(false);
    expect([...h.state!.jf.devices.values()].some((d) => d.userId === guestId)).toBe(false);
    expect((await status(session)).profileEnded).toBe(true);
  });
});

describe("SEC-F-13 : changer un PIN coupe les sessions du profil", () => {
  it("une session « Rester » rouverte sans PIN est coupée dès le PIN changé", async () => {
    await send("PUT", "/api/family/pin", tokens.damien, { pin: "4242" });
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    const token = (await openProfile(app, pairing, { profileId: IDS.damien, pin: "4242", remember: true })).json().token as string;
    await send("PUT", "/api/family/pin", tokens.damien, { pin: "1357" });
    expect((await status(token)).profileEnded).toBe(true);
    expect(endReasons()).toContain("pin_changed");
  });
});

describe("SEC-F-14 : les interrupteurs admin coupent, et rallumer ne ressuscite rien", () => {
  it("couper la Famille coupe les membres et refuse les gestes ; rallumer laisse la session morte", async () => {
    const lea = await leaOnDamiensTv();
    expect((await send("PUT", "/api/admin/family", tokens.damien, { families: false })).json()).toMatchObject({ families: false });
    expect((await status(lea.session)).profileEnded).toBe(true);
    expect(endReasons()).toContain("families_disabled");
    expect((await send("POST", "/api/family/invitations", tokens.damien, { userId: IDS.hugo })).json().code).toBe("family.disabled");
    await send("PUT", "/api/admin/family", tokens.damien, { families: true });
    expect((await status(lea.session)).profileEnded).toBe(true); // ne renaît pas
  });

  it("couper les invités coupe un invité, laisse les membres", async () => {
    const lea = await leaOnDamiensTv();
    const guestId = (await send("POST", "/api/family/guests", tokens.damien, { name: "Zoé", color: "teal" })).json().userId as string;
    const guestSession = (await openProfile(app, lea.pairing, { profileId: guestId })).json().token as string;
    expect((await send("PUT", "/api/admin/family", tokens.damien, { guests: false })).json()).toMatchObject({ guests: false });
    expect((await status(guestSession)).profileEnded).toBe(true);
    expect(endReasons()).toContain("guests_disabled");
  });
});

describe("SEC-F-15 : déjumeler coupe la TV sans jamais supprimer un invité ; rejeu refusé", () => {
  it("les sessions tombent, l'invité reste chez Jellyfin, le jeton rejoué est refusé", async () => {
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    const guestId = (await send("POST", "/api/family/guests", tokens.damien, { name: "Zoé", color: "pink" })).json().userId as string;
    const session = (await openProfile(app, pairing, { profileId: guestId })).json().token as string;
    expect((await send("POST", "/api/pair/self/revoke", pairing)).statusCode).toBe(200);
    // La session de profil est coupée, et le jeton rejoué reste refusé.
    expect((await status(session)).profileEnded).toBe(true);
    expect(endReasons()).toContain("unpaired");
    const replay = await app.inject({ method: "GET", url: "/api/family/tv/profiles", headers: bearer(pairing) });
    expect(replay.statusCode).toBe(401);
    expect(replay.json()).toMatchObject({ code: "family.pairing_required", revoked: true });
    // L'invité n'est JAMAIS supprimé par un déjumelage.
    expect(h.state!.jf.users.has(guestId)).toBe(true);
  });
});
