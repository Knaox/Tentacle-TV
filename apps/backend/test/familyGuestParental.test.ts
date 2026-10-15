/**
 * Le contrôle parental d'un invité (1.30.0), par les vraies routes de la Famille :
 * qui peut le régler, jamais plus large que le créateur, écrit dans la politique
 * Jellyfin de l'invité, l'état lu avec lui (à qui peut le régler seulement), et
 * l'invité qui suit son créateur quand celui-ci change.
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
vi.mock("../src/services/jellyfinLibrary", () => ({ adminUserParam: async () => "" }));

import { freshState } from "./familyMocks";
import { fakeJellyfinUsersFetch } from "./fakeJellyfinUsers";
import { IDS, bearer, buildFamilyApp, resetCaches, seedUsers } from "./familyHarness";
import { GUEST_PARENTAL_NONE } from "../src/family/familyParental";
import { clearUserRightsOptions } from "../src/services/userRights/userRightsOptions";
import { resyncGuests } from "../src/services/family/guestPolicySync";

let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;

const RATINGS = [0, 6, 10, 12, 16, 18].map((score) => ({ Name: String(score), RatingScore: { score, subScore: null } }));

/** Le faux Jellyfin des comptes, plus ce que le réglage lit (notes, bibliothèques). */
function withOptions(base: (input: string | URL, init?: RequestInit) => Promise<Response>) {
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const path = new URL(String(input)).pathname;
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (path === "/Localization/ParentalRatings") return json(RATINGS);
    if (path === "/Library/VirtualFolders") return json([]);
    if (path === "/Channels") return json({ Items: [] });
    if (path === "/Items/Filters") return json({ Tags: [] });
    return base(input, init);
  };
}

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
  h.fetch = withOptions(fakeJellyfinUsersFetch(h.state.jf));
  resetCaches();
  clearUserRightsOptions();
  tokens = seedUsers(h.state);
});

const send = (method: "POST" | "PUT", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const get = (url: string, token: string) => app.inject({ method: "GET", url, headers: bearer(token) });
const guest = async (token: string, name: string) => (await send("POST", "/api/family/guests", token, { name, color: "teal" })).json().userId as string;
const parental = (token: string, userId: string, body: unknown) => send("PUT", `/api/family/guests/${userId}/parental`, token, body);
const policyOf = (userId: string) => h.state!.jf.users.get(userId)!.Policy;
const profileOf = async (token: string, userId: string) =>
  ((await get("/api/family", token)).json().family.profiles as Record<string, unknown>[]).find((profile) => profile.userId === userId)!;
const inviteAccept = async (from: string, userId: string, token: string) => {
  const id = (await send("POST", "/api/family/invitations", from, { userId })).json().id;
  return send("POST", "/api/family/invitations/accept", token, { id });
};

describe("le contrôle parental d'un invité", () => {
  it("l'invité naît avec les restrictions de son créateur, et le propriétaire les voit comme plafond", async () => {
    const lili = await guest(tokens.damien, "Lili");
    expect(policyOf(lili)).toMatchObject({ MaxParentalRating: 12, BlockedTags: ["horreur"] });
    const profile = await profileOf(tokens.damien, lili);
    expect(profile.parental).toEqual(GUEST_PARENTAL_NONE);
    expect(profile.parentalCeiling).toMatchObject({ maxParentalRating: 12, blockedTags: ["horreur"], allowedTags: [] });
  });

  it("posé par le propriétaire : écrit dans SA politique Jellyfin, recoupé avec le créateur", async () => {
    const lili = await guest(tokens.damien, "Lili");
    const body = {
      maxParentalRating: 10,
      maxParentalSubRating: null,
      blockUnratedItems: ["Movie"],
      blockedTags: ["guerre"],
      accessSchedules: [{ dayOfWeek: "Weekend", startHour: 9, endHour: 19.5 }],
    };
    const res = await parental(tokens.damien, lili, body);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ parental: body, parentalCeiling: { maxParentalRating: 12 } });
    expect(policyOf(lili)).toMatchObject({
      MaxParentalRating: 10,
      BlockUnratedItems: ["Movie"],
      BlockedTags: ["horreur", "guerre"],
      IsAdministrator: false,
      IsHidden: true,
    });
    // Le créateur n'a aucune plage : celles voulues passent telles quelles.
    expect(policyOf(lili).AccessSchedules).toEqual([{ DayOfWeek: "Weekend", StartHour: 9, EndHour: 19.5, UserId: lili }]);
    expect((await profileOf(tokens.damien, lili)).parental).toEqual(body);
  });

  it("jamais plus large : une note voulue au-dessus de celle du créateur reste à celle du créateur", async () => {
    const lili = await guest(tokens.damien, "Lili");
    await parental(tokens.damien, lili, { ...GUEST_PARENTAL_NONE, maxParentalRating: 16 });
    expect(policyOf(lili).MaxParentalRating).toBe(12);
  });

  it("refuse un corps incomplet, un champ de plus, une note que Jellyfin ne connaît pas", async () => {
    const lili = await guest(tokens.damien, "Lili");
    for (const body of [{ maxParentalRating: 10 }, { ...GUEST_PARENTAL_NONE, allowedTags: [] }, { ...GUEST_PARENTAL_NONE, maxParentalRating: 11 }]) {
      const res = await parental(tokens.damien, lili, body);
      expect([res.statusCode, res.json().code]).toEqual([400, "family.invalid_input"]);
    }
  });

  it("un membre règle SES invités, jamais ceux d'un autre ; il ne voit l'état que des siens", async () => {
    await inviteAccept(tokens.damien, IDS.lea, tokens.lea);
    await send("PUT", `/api/family/members/${IDS.lea}/rights`, tokens.damien, { createGuests: true });
    await inviteAccept(tokens.damien, IDS.hugo, tokens.hugo);
    const lili = await guest(tokens.damien, "Lili");
    const zoe = await guest(tokens.lea, "Zoé");
    expect((await parental(tokens.lea, zoe, GUEST_PARENTAL_NONE)).statusCode).toBe(200);
    expect((await parental(tokens.lea, lili, GUEST_PARENTAL_NONE)).json().code).toBe("family.not_owner");
    expect((await parental(tokens.hugo, zoe, GUEST_PARENTAL_NONE)).json().code).toBe("family.not_owner");
    expect((await profileOf(tokens.lea, zoe)).parental).toEqual(GUEST_PARENTAL_NONE);
    expect((await profileOf(tokens.lea, lili)).parental).toBeUndefined();
    expect((await profileOf(tokens.hugo, zoe)).parentalCeiling).toBeUndefined();
    expect((await profileOf(tokens.damien, zoe)).parentalCeiling).toMatchObject({ maxParentalRating: null });
  });

  it("les options : au propriétaire, au membre qui a un invité, à personne d'autre", async () => {
    await inviteAccept(tokens.damien, IDS.hugo, tokens.hugo);
    const res = await get("/api/family/parental/options", tokens.damien);
    expect(res.statusCode).toBe(200);
    expect(res.json().parentalRatings).toContainEqual({ name: "12", score: 12, subScore: null });
    expect(Object.keys(res.json()).sort()).toEqual(["knownTags", "parentalRatings", "unratedItemTypes"]);
    expect((await get("/api/family/parental/options", tokens.hugo)).json().code).toBe("family.not_owner");
    expect((await get("/api/family/parental/options", tokens.cache)).json().code).toBe("family.not_owner");
  });

  it("le créateur change dans Jellyfin : l'invité suit au guet, sans jamais dépasser son contrôle", async () => {
    const lili = await guest(tokens.damien, "Lili");
    await parental(tokens.damien, lili, { ...GUEST_PARENTAL_NONE, maxParentalRating: 10 });
    policyOf(IDS.damien).MaxParentalRating = 6;
    expect(await resyncGuests()).toBe(1);
    expect(policyOf(lili).MaxParentalRating).toBe(6);
    policyOf(IDS.damien).MaxParentalRating = 16;
    await resyncGuests();
    expect(policyOf(lili).MaxParentalRating).toBe(10);
    expect(await resyncGuests()).toBe(0);
  });

  it("des plages qui ne se recoupent pas : jamais, pas « à toute heure »", async () => {
    policyOf(IDS.damien).AccessSchedules = [{ Id: 1, UserId: IDS.damien, DayOfWeek: "Weekday", StartHour: 8, EndHour: 12 }];
    const lili = await guest(tokens.damien, "Lili");
    await parental(tokens.damien, lili, { ...GUEST_PARENTAL_NONE, accessSchedules: [{ dayOfWeek: "Weekend", startHour: 8, endHour: 12 }] });
    expect(policyOf(lili).AccessSchedules).toEqual([{ DayOfWeek: "Sunday", StartHour: 24, EndHour: 24, UserId: lili }]);
  });
});
