/**
 * Les BIBLIOTHÈQUES qu'une famille permet (1.30.0, `family.libraryLimits`), par les
 * vraies routes : écrites dans la politique Jellyfin du profil (plafond ∩ voulu),
 * jamais plus larges que le créateur d'un invité ou la base d'un membre ; la base
 * d'un membre RENDUE à l'identique au départ et à la dissolution, avec ce que
 * l'administrateur y a changé entre-temps. Et les refus : un membre simple, un
 * parent sur le propriétaire ou un autre parent, un compte hors famille, un corps forgé.
 */

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: null as null | import("./familyMocks").HarnessState,
  fetch: null as null | ((input: string | URL, init?: RequestInit) => Promise<Response>),
  mute: false,
}));
vi.mock("../src/services/configStore", async () => (await import("./familyMocks")).configStoreMock(() => h.state!));
vi.mock("../src/services/db", async () => (await import("./familyMocks")).dbMock(() => h.state!));
vi.mock("../src/services/wsManager", async () => (await import("./familyMocks")).wsManagerMock(() => h.state!));
vi.mock("../src/services/pushService", async () => (await import("./familyMocks")).pushServiceMock(() => h.state!));
vi.mock("../src/services/deviceSessions/deviceAuth", async () => (await import("./familyMocks")).deviceAuthMock());
vi.mock("../src/services/deviceSessions/gateway", async () => (await import("./familyMocks")).gatewayMock());
vi.mock("../src/services/jellyfinLibrary", () => ({ adminUserParam: async () => "" }));

import { freshState } from "./familyMocks";
import { fakeJellyfinUsersFetch } from "./fakeJellyfinUsers";
import { withParentalOptions } from "./fakeJellyfinParental";
import { IDS, bearer, buildFamilyApp, resetCaches, seedUsers } from "./familyHarness";
import { GUEST_PARENTAL_NONE } from "../src/family/familyParental";
import { FAMILY_ROUTES } from "../src/family/familyRoutes";
import { clearUserRightsOptions } from "../src/services/userRights/userRightsOptions";
import { resyncGuests } from "../src/services/family/guestPolicySync";
import { resyncMemberParental } from "../src/services/family/memberParentalSync";

const FILMS = "f1".repeat(16);
const SERIES = "5e".repeat(16);
const KIDS = "c1".repeat(16);
const FOLDERS = [
  { Name: "Films", ItemId: FILMS, CollectionType: "movies" },
  { Name: "Séries", ItemId: SERIES, CollectionType: "tvshows" },
  { Name: "Enfants", ItemId: KIDS, CollectionType: "movies" },
];

let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;

beforeAll(async () => {
  // L'heure figée, comme le banc des membres mineurs : aucune plage ne ferme un compte pendant le test.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 14, 17, 0));
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/Library/VirtualFolders") {
      return Promise.resolve(new Response(JSON.stringify(FOLDERS), { status: 200, headers: { "content-type": "application/json" } }));
    }
    if (h.mute && (init?.method ?? "GET") === "POST" && /\/Policy$/.test(url.pathname)) return Promise.reject(new Error("Jellyfin muet"));
    return h.fetch!(input, init);
  });
  app = await buildFamilyApp();
});
afterAll(async () => {
  await app.close();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

beforeEach(() => {
  h.state = freshState();
  h.fetch = withParentalOptions(fakeJellyfinUsersFetch(h.state.jf));
  h.mute = false;
  resetCaches();
  clearUserRightsOptions();
  tokens = seedUsers(h.state);
});

const send = (method: "POST" | "PUT" | "DELETE", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const get = (url: string, token: string) => app.inject({ method: "GET", url, headers: bearer(token) });
const libraries = (token: string, userId: string) => get(`/api/family/profiles/${userId}/libraries`, token);
const setLibraries = (token: string, userId: string, body: unknown) => send("PUT", `/api/family/profiles/${userId}/libraries`, token, body);
const guest = async (token: string, name: string) => (await send("POST", "/api/family/guests", token, { name, color: "teal" })).json().userId as string;
const policyOf = (userId: string) => h.state!.jf.users.get(userId)!.Policy;
const folders = (userId: string) => ({ all: policyOf(userId).EnableAllFolders, ids: policyOf(userId).EnabledFolders });
const refusal = (res: { statusCode: number; json: () => { code?: string } }) => [res.statusCode, res.json().code];
async function join(userId: string, token: string) {
  const id = (await send("POST", "/api/family/invitations", tokens.damien, { userId })).json().id;
  return send("POST", "/api/family/invitations/accept", token, { id });
}
/** La base de Hugo, réglée par l'administrateur : deux bibliothèques sur trois. */
function restrictHugo() {
  Object.assign(policyOf(IDS.hugo), { EnableAllFolders: false, EnabledFolders: [FILMS, SERIES] });
}

describe("un invité", () => {
  it("le propriétaire voit ses bibliothèques, en restreint une liste, puis rend « toutes »", async () => {
    const lili = await guest(tokens.damien, "Lili");
    const read = await libraries(tokens.damien, lili);
    expect(read.statusCode).toBe(200);
    expect(read.json()).toEqual({
      available: [
        { id: FILMS, name: "Films", collectionType: "movies" },
        { id: SERIES, name: "Séries", collectionType: "tvshows" },
        { id: KIDS, name: "Enfants", collectionType: "movies" },
      ],
      allowed: null,
    });
    const res = await setLibraries(tokens.damien, lili, { allowed: [KIDS] });
    expect(res.statusCode).toBe(200);
    expect(res.json().allowed).toEqual([KIDS]);
    expect(folders(lili)).toEqual({ all: false, ids: [KIDS] });
    // Le contrôle parental de l'âge, réglé ensuite, ne rouvre pas les bibliothèques.
    await send("PUT", `/api/family/guests/${lili}/parental`, tokens.damien, { ...GUEST_PARENTAL_NONE, maxParentalRating: 6 });
    expect(folders(lili)).toEqual({ all: false, ids: [KIDS] });
    expect(policyOf(lili).MaxParentalRating).toBe(6);
    expect((await setLibraries(tokens.damien, lili, { allowed: null })).statusCode).toBe(200);
    expect(policyOf(lili).EnableAllFolders).toBe(true);
    expect((await libraries(tokens.damien, lili)).json().allowed).toBeNull();
  });

  it("jamais plus large que son créateur : hors de son plafond, refusé ; le créateur restreint, l'invité suit", async () => {
    await join(IDS.lea, tokens.lea);
    await send("PUT", `/api/family/members/${IDS.lea}/rights`, tokens.damien, { createGuests: true });
    Object.assign(policyOf(IDS.lea), { EnableAllFolders: false, EnabledFolders: [FILMS, KIDS] });
    const zoe = await guest(tokens.lea, "Zoé");
    expect((await libraries(tokens.lea, zoe)).json().available.map((library: { id: string }) => library.id)).toEqual([FILMS, KIDS]);
    expect(refusal(await setLibraries(tokens.lea, zoe, { allowed: [SERIES] }))).toEqual([400, "family.invalid_input"]);
    expect((await setLibraries(tokens.lea, zoe, { allowed: [KIDS] })).statusCode).toBe(200);
    expect(folders(zoe)).toEqual({ all: false, ids: [KIDS] });
    // L'administrateur retire « Enfants » à Léa dans Jellyfin : Zoé n'a plus rien, rien ne s'élargit.
    policyOf(IDS.lea).EnabledFolders = [FILMS];
    await resyncGuests();
    expect(folders(zoe)).toEqual({ all: false, ids: [] });
  });
});

describe("un membre mineur", () => {
  beforeEach(async () => {
    restrictHugo();
    await join(IDS.lea, tokens.lea);
    await join(IDS.hugo, tokens.hugo);
  });

  it("restreint dans SA politique, puis sa base RENDUE à son départ", async () => {
    expect((await libraries(tokens.damien, IDS.hugo)).json().available.map((library: { id: string }) => library.id)).toEqual([FILMS, SERIES]);
    expect((await setLibraries(tokens.damien, IDS.hugo, { allowed: [SERIES] })).statusCode).toBe(200);
    expect(folders(IDS.hugo)).toEqual({ all: false, ids: [SERIES] });
    const familyId = (await get("/api/family", tokens.hugo)).json().family.id as string;
    expect((await send("POST", `/api/family/memberships/${familyId}/leave`, tokens.hugo)).statusCode).toBe(200);
    expect(folders(IDS.hugo)).toEqual({ all: false, ids: [FILMS, SERIES] });
  });

  it("l'administrateur prime : ce qu'il change pendant la restriction devient la base, rendue à la dissolution", async () => {
    await setLibraries(tokens.damien, IDS.hugo, { allowed: [SERIES] });
    policyOf(IDS.hugo).EnabledFolders = [FILMS];
    await resyncMemberParental();
    expect(folders(IDS.hugo)).toEqual({ all: false, ids: [] });
    expect((await send("DELETE", "/api/family", tokens.damien, { confirm: "dissolve" })).statusCode).toBe(200);
    expect(folders(IDS.hugo)).toEqual({ all: false, ids: [FILMS] });
  });

  it("l'âge et les bibliothèques vivent ensemble : retirer l'un garde l'autre", async () => {
    await setLibraries(tokens.damien, IDS.hugo, { allowed: [FILMS] });
    await send("PUT", `/api/family/members/${IDS.hugo}/parental`, tokens.damien, { ...GUEST_PARENTAL_NONE, maxParentalRating: 10 });
    expect(policyOf(IDS.hugo)).toMatchObject({ MaxParentalRating: 10, EnableAllFolders: false, EnabledFolders: [FILMS] });
    await send("PUT", `/api/family/members/${IDS.hugo}/parental`, tokens.damien, GUEST_PARENTAL_NONE);
    expect(policyOf(IDS.hugo)).toMatchObject({ EnabledFolders: [FILMS] });
    expect(policyOf(IDS.hugo).MaxParentalRating).not.toBe(10);
    await setLibraries(tokens.damien, IDS.hugo, { allowed: null });
    expect(folders(IDS.hugo)).toEqual({ all: false, ids: [FILMS, SERIES] });
  });

  it("Jellyfin muet au départ : la base est rendue par le guet, à son retour", async () => {
    await setLibraries(tokens.damien, IDS.hugo, { allowed: [SERIES] });
    h.mute = true;
    await send("DELETE", `/api/family/members/${IDS.hugo}`, tokens.damien);
    expect(folders(IDS.hugo)).toEqual({ all: false, ids: [SERIES] });
    h.mute = false;
    await resyncMemberParental();
    expect(folders(IDS.hugo)).toEqual({ all: false, ids: [FILMS, SERIES] });
  });

  it("un parent règle un mineur et un invité ; jamais le propriétaire ni un autre parent", async () => {
    await send("PUT", `/api/family/members/${IDS.lea}/role`, tokens.damien, { parent: true });
    const lili = await guest(tokens.damien, "Lili");
    expect((await setLibraries(tokens.lea, IDS.hugo, { allowed: [FILMS] })).statusCode).toBe(200);
    expect((await setLibraries(tokens.lea, lili, { allowed: [KIDS] })).statusCode).toBe(200);
    expect(refusal(await setLibraries(tokens.lea, IDS.damien, { allowed: [KIDS] }))).toEqual([409, "family.member_parental_refused"]);
    await send("PUT", `/api/family/members/${IDS.hugo}/parental`, tokens.damien, GUEST_PARENTAL_NONE);
    await setLibraries(tokens.lea, IDS.hugo, { allowed: null });
    await send("PUT", `/api/family/members/${IDS.hugo}/role`, tokens.damien, { parent: true });
    expect(refusal(await libraries(tokens.lea, IDS.hugo))).toEqual([409, "family.member_parental_refused"]);
  });
});

describe("les refus", () => {
  it("un membre simple : ni l'invité d'un autre, ni un mineur", async () => {
    await join(IDS.lea, tokens.lea);
    await join(IDS.hugo, tokens.hugo);
    const lili = await guest(tokens.damien, "Lili");
    expect(refusal(await setLibraries(tokens.hugo, lili, { allowed: [KIDS] }))).toEqual([403, "family.not_owner"]);
    expect(refusal(await libraries(tokens.hugo, lili))).toEqual([403, "family.not_owner"]);
    expect(refusal(await setLibraries(tokens.hugo, IDS.lea, { allowed: [KIDS] }))).toEqual([403, "family.not_owner"]);
    expect(policyOf(lili).EnableAllFolders).toBe(true);
  });

  it("hors de la famille : introuvable ; un administrateur Jellyfin : jamais", async () => {
    const lili = await guest(tokens.damien, "Lili");
    expect(refusal(await libraries(tokens.cache, lili))).toEqual([404, "family.not_found"]);
    await join(IDS.hugo, tokens.hugo);
    policyOf(IDS.hugo).IsAdministrator = true;
    expect(refusal(await setLibraries(tokens.damien, IDS.hugo, { allowed: [FILMS] }))).toEqual([409, "family.member_parental_refused"]);
  });

  it("un corps forgé : vide, clé en plus, identifiant inventé ou en double", async () => {
    const lili = await guest(tokens.damien, "Lili");
    for (const body of [{ allowed: [] }, { allowed: [KIDS], userId: IDS.lea }, { allowed: ["enfants"] }, { allowed: [KIDS, KIDS] }, {}]) {
      expect(refusal(await setLibraries(tokens.damien, lili, body))).toEqual([400, "family.invalid_input"]);
    }
    expect(refusal(await setLibraries(tokens.damien, lili, { allowed: ["0".repeat(32)] }))).toEqual([400, "family.invalid_input"]);
  });

  it("le contrat : ni une TV sans gestion, ni un profil de bureau, ni un jumelage", () => {
    for (const name of ["profileLibraries", "setProfileLibraries"] as const) {
      expect(FAMILY_ROUTES[name].callers).toEqual(["personal", "ownerProfile", "memberProfile"]);
    }
  });
});
