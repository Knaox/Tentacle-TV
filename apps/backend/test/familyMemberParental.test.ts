/**
 * Le contrôle parental d'un MEMBRE mineur (1.30.0), par les vraies routes : écrit dans
 * SA politique Jellyfin (base ∩ voulu), la base gardée, mise à jour par ce que
 * l'administrateur change (depuis Tentacle ou dans Jellyfin), puis RENDUE à
 * l'identique — retrait, départ, retrait par le propriétaire, dissolution, même
 * après un Jellyfin muet. Ses invités suivent sa politique effective.
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
import { clearUserRightsOptions } from "../src/services/userRights/userRightsOptions";
import { updateUserRights } from "../src/services/userRights/userRightsService";
import { resyncMemberParental } from "../src/services/family/memberParentalSync";

let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;

beforeAll(async () => {
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => {
    // Jellyfin muet pour les écritures de politique (panne simulée).
    if (h.mute && (init?.method ?? "GET") === "POST" && /\/Policy$/.test(new URL(String(input)).pathname)) {
      return Promise.reject(new Error("Jellyfin muet"));
    }
    return h.fetch!(input, init);
  });
  app = await buildFamilyApp();
});
afterAll(async () => {
  await app.close();
  vi.unstubAllGlobals();
});

/** La politique de base de Hugo, réglée par l'administrateur. */
const HUGO_BASE = {
  MaxParentalRating: 16,
  MaxParentalSubRating: null,
  BlockUnratedItems: ["Book"],
  BlockedTags: ["gore"],
  AllowedTags: [],
  AccessSchedules: [{ DayOfWeek: "Everyday", StartHour: 6, EndHour: 23, UserId: IDS.hugo }],
};

let snapshot: Record<string, unknown>;

beforeEach(async () => {
  h.state = freshState();
  h.fetch = withParentalOptions(fakeJellyfinUsersFetch(h.state.jf));
  h.mute = false;
  resetCaches();
  clearUserRightsOptions();
  tokens = seedUsers(h.state);
  Object.assign(h.state.jf.users.get(IDS.hugo)!.Policy, HUGO_BASE);
  snapshot = structuredClone(h.state.jf.users.get(IDS.hugo)!.Policy);
  await accept(tokens.damien, IDS.lea, tokens.lea);
  await accept(tokens.damien, IDS.hugo, tokens.hugo);
});

const send = (method: "POST" | "PUT" | "DELETE", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const get = (url: string, token: string) => app.inject({ method: "GET", url, headers: bearer(token) });
async function accept(from: string, userId: string, token: string) {
  const id = (await send("POST", "/api/family/invitations", from, { userId })).json().id;
  return send("POST", "/api/family/invitations/accept", token, { id });
}
const parental = (token: string, userId: string, body: unknown) => send("PUT", `/api/family/members/${userId}/parental`, token, body);
const policyOf = (userId: string) => h.state!.jf.users.get(userId)!.Policy;
const hugoView = async (token: string) =>
  ((await get("/api/family", token)).json().family.profiles as Record<string, unknown>[]).find((p) => p.userId === IDS.hugo)!;
const refusal = (res: { statusCode: number; json: () => { code?: string } }) => [res.statusCode, res.json().code];

const SIX = {
  maxParentalRating: 6,
  maxParentalSubRating: null,
  blockUnratedItems: ["Movie"],
  blockedTags: ["guerre"],
  accessSchedules: [{ dayOfWeek: "Weekday", startHour: 16, endHour: 20 }],
};

describe("poser le contrôle parental d'un membre", () => {
  it("écrit l'intersection dans SA politique Jellyfin, garde la base, ne touche à rien d'autre", async () => {
    const res = await parental(tokens.damien, IDS.hugo, SIX);
    expect(res.statusCode).toBe(200);
    expect(res.json().parental).toEqual(SIX);
    expect(res.json().parentalCeiling).toEqual({
      maxParentalRating: 16, maxParentalSubRating: null, blockUnratedItems: ["Book"], blockedTags: ["gore"], allowedTags: [],
      accessSchedules: [{ dayOfWeek: "Everyday", startHour: 6, endHour: 23 }],
    });
    const policy = policyOf(IDS.hugo);
    expect(policy).toMatchObject({ MaxParentalRating: 6, BlockUnratedItems: ["Book", "Movie"], BlockedTags: ["gore", "guerre"] });
    expect(policy.AccessSchedules).toEqual(
      ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => ({ DayOfWeek: day, StartHour: 16, EndHour: 20, UserId: IDS.hugo })),
    );
    for (const key of ["AuthenticationProviderId", "PasswordResetProviderId", "EnableAllFolders", "IsAdministrator", "EnableRemoteAccess"]) {
      expect(policy[key]).toEqual(snapshot[key]);
    }
  });

  it("l'état se lit par le propriétaire et les parents — ni par le membre lui-même, ni par un autre membre", async () => {
    await parental(tokens.damien, IDS.hugo, SIX);
    expect((await hugoView(tokens.damien)).parental).toEqual(SIX);
    expect((await hugoView(tokens.lea)).parental).toBeUndefined();
    expect((await hugoView(tokens.hugo)).parental).toBeUndefined();
    await send("PUT", `/api/family/members/${IDS.lea}/role`, tokens.damien, { parent: true });
    expect((await hugoView(tokens.lea)).parentalCeiling).toMatchObject({ maxParentalRating: 16 });
  });

  it("retiré : la base rendue à l'identique, la ligne effacée", async () => {
    await parental(tokens.damien, IDS.hugo, SIX);
    const res = await parental(tokens.damien, IDS.hugo, GUEST_PARENTAL_NONE);
    expect(res.json()).toMatchObject({ parental: GUEST_PARENTAL_NONE, parentalCeiling: { maxParentalRating: 16 } });
    expect(policyOf(IDS.hugo)).toEqual(snapshot);
    expect(h.state!.db.data.familyMemberParental).toHaveLength(0);
  });
});

describe("qui pose, sur qui", () => {
  it("un parent pose ; un simple membre, non", async () => {
    await send("PUT", `/api/family/members/${IDS.lea}/role`, tokens.damien, { parent: true });
    expect((await parental(tokens.lea, IDS.hugo, SIX)).statusCode).toBe(200);
    await send("PUT", `/api/family/members/${IDS.lea}/role`, tokens.damien, { parent: false });
    expect(refusal(await parental(tokens.lea, IDS.hugo, SIX))).toEqual([403, "family.not_owner"]);
    expect(refusal(await parental(tokens.cache, IDS.hugo, SIX))).toEqual([404, "family.not_found"]);
  });

  it("jamais sur le propriétaire, un parent, un administrateur Jellyfin ni un invité", async () => {
    await send("PUT", `/api/family/members/${IDS.lea}/role`, tokens.damien, { parent: true });
    expect(refusal(await parental(tokens.damien, IDS.lea, SIX))).toEqual([409, "family.member_parental_refused"]);
    expect(refusal(await parental(tokens.lea, IDS.damien, SIX))).toEqual([409, "family.member_parental_refused"]);
    const lili = (await send("POST", "/api/family/guests", tokens.damien, { name: "Lili", color: "teal" })).json().userId as string;
    expect(refusal(await parental(tokens.damien, lili, SIX))).toEqual([409, "family.member_parental_refused"]);
    policyOf(IDS.hugo).IsAdministrator = true;
    expect(refusal(await parental(tokens.damien, IDS.hugo, SIX))).toEqual([409, "family.member_parental_refused"]);
    expect((await hugoView(tokens.damien)).parental).toBeUndefined();
  });

  it("un membre restreint ne devient parent qu'une fois son contrôle retiré", async () => {
    await parental(tokens.damien, IDS.hugo, SIX);
    expect(refusal(await send("PUT", `/api/family/members/${IDS.hugo}/role`, tokens.damien, { parent: true }))).toEqual([
      409, "family.member_parental_refused",
    ]);
    await parental(tokens.damien, IDS.hugo, GUEST_PARENTAL_NONE);
    expect((await send("PUT", `/api/family/members/${IDS.hugo}/role`, tokens.damien, { parent: true })).json()).toEqual({ parent: true });
  });

  it("refuse un corps incomplet et une note inconnue de Jellyfin", async () => {
    expect(refusal(await parental(tokens.damien, IDS.hugo, { maxParentalRating: 6 }))).toEqual([400, "family.invalid_input"]);
    expect(refusal(await parental(tokens.damien, IDS.hugo, { ...SIX, maxParentalRating: 7 }))).toEqual([400, "family.invalid_input"]);
  });
});

describe("la base suit l'administrateur", () => {
  it("changée depuis Tentacle : la valeur de l'administrateur devient la base, la famille la recoupe", async () => {
    await parental(tokens.damien, IDS.hugo, SIX);
    const dto = await updateUserRights({ userId: IDS.damien, username: "Damien" }, IDS.hugo, {
      maxParentalRating: 18,
      blockedTags: ["gore", "guerre", "zombies"],
    });
    expect(dto.rights).toMatchObject({ maxParentalRating: 6, blockedTags: ["gore", "zombies", "guerre"] });
    expect(policyOf(IDS.hugo).MaxParentalRating).toBe(6);
    await parental(tokens.damien, IDS.hugo, GUEST_PARENTAL_NONE);
    expect(policyOf(IDS.hugo)).toMatchObject({ MaxParentalRating: 18, BlockedTags: ["gore", "zombies"], BlockUnratedItems: ["Book"] });
  });

  it("changée directement dans Jellyfin : le guet en fait la base et repose le contrôle", async () => {
    await parental(tokens.damien, IDS.hugo, SIX);
    policyOf(IDS.hugo).MaxParentalRating = null;
    expect(await resyncMemberParental()).toBe(1);
    expect(policyOf(IDS.hugo).MaxParentalRating).toBe(6);
    expect(await resyncMemberParental()).toBe(0);
    await parental(tokens.damien, IDS.hugo, GUEST_PARENTAL_NONE);
    expect(policyOf(IDS.hugo)).toEqual({ ...snapshot, MaxParentalRating: null });
  });
});

describe("la base rendue quand le membre quitte la famille", () => {
  it("il part", async () => {
    await parental(tokens.damien, IDS.hugo, SIX);
    const familyId = (await get("/api/family", tokens.hugo)).json().family.id;
    expect((await send("POST", `/api/family/memberships/${familyId}/leave`, tokens.hugo)).statusCode).toBe(200);
    expect(policyOf(IDS.hugo)).toEqual(snapshot);
  });

  it("le propriétaire le retire", async () => {
    await parental(tokens.damien, IDS.hugo, SIX);
    expect((await send("DELETE", `/api/family/members/${IDS.hugo}`, tokens.damien)).statusCode).toBe(200);
    expect(policyOf(IDS.hugo)).toEqual(snapshot);
  });

  it("la famille est dissoute", async () => {
    await parental(tokens.damien, IDS.hugo, SIX);
    expect((await send("DELETE", "/api/family", tokens.damien, { confirm: "dissolve" })).statusCode).toBe(200);
    expect(policyOf(IDS.hugo)).toEqual(snapshot);
    expect(h.state!.db.data.familyMemberParental).toHaveLength(0);
  });

  it("Jellyfin muet au départ : la base reste à rendre, le guet la rend à son retour", async () => {
    await parental(tokens.damien, IDS.hugo, SIX);
    h.mute = true;
    expect((await send("DELETE", `/api/family/members/${IDS.hugo}`, tokens.damien)).statusCode).toBe(200);
    expect(policyOf(IDS.hugo).MaxParentalRating).toBe(6);
    expect(h.state!.db.data.familyMemberParental).toMatchObject([{ userId: IDS.hugo, controls: null, restorePending: true }]);
    h.mute = false;
    await resyncMemberParental();
    expect(policyOf(IDS.hugo)).toEqual(snapshot);
    expect(h.state!.db.data.familyMemberParental).toHaveLength(0);
  });
});

describe("ses invités suivent sa politique effective", () => {
  it("restreint, ses invités le sont aussi ; rendu, ils retrouvent sa base", async () => {
    await send("PUT", `/api/family/members/${IDS.hugo}/rights`, tokens.damien, { createGuests: true });
    const tom = (await send("POST", "/api/family/guests", tokens.hugo, { name: "Tom", color: "blue" })).json().userId as string;
    expect(policyOf(tom).MaxParentalRating).toBe(16);
    await parental(tokens.damien, IDS.hugo, SIX);
    expect(policyOf(tom)).toMatchObject({ MaxParentalRating: 6, BlockedTags: ["gore", "guerre"] });
    await parental(tokens.damien, IDS.hugo, GUEST_PARENTAL_NONE);
    expect(policyOf(tom)).toMatchObject({ MaxParentalRating: 16, BlockedTags: ["gore"] });
  });
});
