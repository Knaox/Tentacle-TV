/**
 * Un droit de la Famille réglé sur le MOBILE (mêmes routes que le bureau)
 * s'applique partout aussitôt : bibliothèques, âge d'un invité ou d'un membre
 * mineur, « peut demander » — chaque geste annonce `rights:changed` au profil
 * concerné (les écritures de politique par le socle, la case d'un invité
 * directement), et ses appareils relisent ce qu'ils montrent (`useRightsLive`).
 */

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: null as null | import("./familyMocks").HarnessState,
  fetch: null as null | ((input: string | URL, init?: RequestInit) => Promise<Response>),
  announced: [] as string[],
}));
vi.mock("../src/services/configStore", async () => (await import("./familyMocks")).configStoreMock(() => h.state!));
vi.mock("../src/services/db", async () => (await import("./familyMocks")).dbMock(() => h.state!));
vi.mock("../src/services/wsManager", async () => (await import("./familyMocks")).wsManagerMock(() => h.state!));
vi.mock("../src/services/pushService", async () => (await import("./familyMocks")).pushServiceMock(() => h.state!));
vi.mock("../src/services/deviceSessions/deviceAuth", async () => (await import("./familyMocks")).deviceAuthMock());
vi.mock("../src/services/deviceSessions/gateway", async () => (await import("./familyMocks")).gatewayMock());
vi.mock("../src/services/jellyfinLibrary", () => ({ adminUserParam: async () => "" }));
// L'annonce elle-même (et son branchement sur le socle) est éprouvée par rightsLive.test.ts.
vi.mock("../src/services/rightsLive/rightsLive", () => ({ announceRightsChanged: (userId: string | null) => h.announced.push(String(userId)) }));

import { freshState } from "./familyMocks";
import { fakeJellyfinUsersFetch } from "./fakeJellyfinUsers";
import { withParentalOptions } from "./fakeJellyfinParental";
import { allowGuestRequests, bearer, buildFamilyApp, resetCaches, seedUsers } from "./familyHarness";
import { GUEST_PARENTAL_NONE } from "../src/family/familyParental";
import { onContentPolicyInvalidated } from "../src/services/contentPolicy";
import { clearUserRightsOptions } from "../src/services/userRights/userRightsOptions";

const FILMS = "f1".repeat(16);
const KIDS = "c1".repeat(16);
const FOLDERS = [
  { Name: "Films", ItemId: FILMS, CollectionType: "movies" },
  { Name: "Enfants", ItemId: KIDS, CollectionType: "movies" },
];

let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;
const norm = (id: string) => id.replace(/-/g, "").toLowerCase();

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 14, 17, 0));
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/Library/VirtualFolders") {
      return Promise.resolve(new Response(JSON.stringify(FOLDERS), { status: 200, headers: { "content-type": "application/json" } }));
    }
    return h.fetch!(input, init);
  });
  // Le branchement de `watchRightsLive` : chaque écriture de politique vue par le socle.
  onContentPolicyInvalidated((userId) => h.announced.push(String(userId)));
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
  h.announced = [];
  resetCaches();
  clearUserRightsOptions();
  tokens = seedUsers(h.state);
});

const send = (method: "POST" | "PUT", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const guest = async (name: string) => (await send("POST", "/api/family/guests", tokens.damien, { name, color: "teal" })).json().userId as string;
const announcedFor = (userId: string) => h.announced.some((id) => norm(id) === norm(userId));

describe("un droit de la Famille réglé sur le mobile s'applique partout aussitôt", () => {
  it("les bibliothèques d'un invité", async () => {
    const lili = await guest("Lili");
    h.announced = [];
    expect((await send("PUT", `/api/family/profiles/${lili}/libraries`, tokens.damien, { allowed: [KIDS] })).statusCode).toBe(200);
    expect(announcedFor(lili)).toBe(true);
  });

  it("l'âge maximal d'un invité", async () => {
    const lili = await guest("Lili");
    h.announced = [];
    expect((await send("PUT", `/api/family/guests/${lili}/parental`, tokens.damien, { ...GUEST_PARENTAL_NONE, maxParentalRating: 6 })).statusCode).toBe(200);
    expect(announcedFor(lili)).toBe(true);
  });

  it("« peut demander des films » d'un invité (la case ne touche pas Jellyfin : annonce directe)", async () => {
    allowGuestRequests(h.state!);
    const lili = await guest("Lili");
    h.announced = [];
    expect((await send("PUT", `/api/family/guests/${lili}/rights`, tokens.damien, { requestTitles: true })).statusCode).toBe(200);
    expect(announcedFor(lili)).toBe(true);
  });

  it("aucune annonce pour un geste refusé", async () => {
    const lili = await guest("Lili");
    h.announced = [];
    expect((await send("PUT", `/api/family/profiles/${lili}/libraries`, tokens.lea, { allowed: [KIDS] })).statusCode).toBeGreaterThanOrEqual(400);
    expect(announcedFor(lili)).toBe(false);
  });
});
