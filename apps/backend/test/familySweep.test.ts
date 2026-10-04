/**
 * Le balayage de la Famille : les invitations échues sortent de la cloche ;
 * un compte disparu de Jellyfin (supprimé depuis son tableau de bord) emporte
 * son adhésion ; un compte désactivé perd ses sessions de profil.
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

const post = (url: string, token: string, payload: unknown) => app.inject({ method: "POST", url, headers: bearer(token), payload: payload as object });

async function join(userId: string, token: string): Promise<void> {
  const id = (await post("/api/family/invitations", tokens.damien, { userId })).json().id;
  await post("/api/family/invitations/accept", token, { id });
}

/** Les profils nés il y a plus d'une minute : le balayage les juge. */
function age(): void {
  for (const row of h.state!.db.data.familyMember) row.createdAt = new Date(Date.now() - 5 * 60_000);
}

describe("le balayage", () => {
  it("retire de la cloche une invitation échue", async () => {
    await post("/api/family/invitations", tokens.damien, { userId: IDS.lea });
    h.state!.db.data.familyInvitation[0].expiresAt = new Date(Date.now() - 1000);
    await sweepFamily();
    expect(h.state!.db.data.familyInvitation[0].status).toBe("expired");
    expect(h.state!.db.data.notification).toHaveLength(0);
  });

  it("solde l'adhésion d'un compte supprimé dans Jellyfin", async () => {
    await join(IDS.hugo, tokens.hugo);
    age();
    h.state!.jf.users.delete(IDS.hugo);
    await sweepFamily();
    expect(h.state!.db.data.familyMember).toHaveLength(0);
    expect(h.state!.db.data.notification.map((n) => [n.jellyfinUserId, n.type])).toContainEqual([IDS.damien, "family_member_left"]);
  });

  it("coupe les sessions de profil d'un compte désactivé, sans toucher à sa famille", async () => {
    await join(IDS.lea, tokens.lea);
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    const session = (await openProfile(app, pairing, { profileId: IDS.lea })).json().token;
    h.state!.jf.users.get(IDS.lea)!.Policy.IsDisabled = true;
    await sweepFamily();
    const res = await app.inject({ method: "GET", url: "/api/protected", headers: bearer(session) });
    expect(res.json().profileEnded).toBe(true);
    expect(h.state!.db.data.familyMember).toHaveLength(1);
  });

  it("ne conclut rien d'un Jellyfin muet", async () => {
    await join(IDS.hugo, tokens.hugo);
    age();
    h.fetch = async () => new Response("", { status: 503 });
    await sweepFamily();
    expect(h.state!.db.data.familyMember).toHaveLength(1);
  });
});
