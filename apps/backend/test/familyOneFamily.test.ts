/**
 * Famille v2, par les vraies routes : UNE famille par compte (propriétaire OU
 * membre — la base le tient, même sous course), seul le propriétaire invite,
 * retire et dissout ; un membre crée des invités si le propriétaire le lui
 * permet, avec SA politique, et ne gère que ceux-là.
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
import { IDS, bearer, buildFamilyApp, resetCaches, seedUsers } from "./familyHarness";

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
const invite = (from: string, userId: string) => send("POST", "/api/family/invitations", from, { userId });
const accept = (token: string, id: string) => send("POST", "/api/family/invitations/accept", token, { id });
const guest = (token: string, name: string) => send("POST", "/api/family/guests", token, { name, color: "teal" });
const code = async (res: Promise<{ json: () => { code?: string } }>) => (await res).json().code;
const rows = () => h.state!.db.data.familyMember;

async function join(owner: string, userId: string, token: string): Promise<void> {
  const id = (await invite(owner, userId)).json().id;
  expect((await accept(token, id)).statusCode).toBe(200);
}

describe("une famille par compte", () => {
  it("un membre n'invite pas, ne fonde rien et ne quitte que sa famille ; le propriétaire dissout", async () => {
    await join(tokens.damien, IDS.lea, tokens.lea);
    expect(await code(invite(tokens.lea, IDS.hugo))).toBe("family.not_owner");
    // Annuler une invitation de SA famille : 403 ; un compte sans lien : 404.
    const pending = (await invite(tokens.damien, IDS.cache)).json().id;
    expect(await code(send("POST", "/api/family/invitations/cancel", tokens.lea, { id: pending }))).toBe("family.not_owner");
    expect((await send("POST", "/api/family/invitations/cancel", tokens.hugo, { id: pending })).statusCode).toBe(404);
    expect(await code(guest(tokens.lea, "Zoé"))).toBe("family.guest_right_required");
    expect(h.state!.db.data.family).toHaveLength(1);
    const familyId = h.state!.db.data.family[0].id as string;
    expect(await code(send("POST", `/api/family/memberships/${familyId}/leave`, tokens.damien))).toBe("family.owner_must_dissolve");
  });

  it("un compte déjà dans une famille n'est plus invitable, ni ne peut accepter", async () => {
    const early = (await invite(tokens.damien, IDS.hugo)).json().id;
    await join(tokens.damien, IDS.lea, tokens.lea);
    // Hugo fonde la sienne : l'invitation de Damien, encore en attente, est close.
    expect((await invite(tokens.hugo, IDS.cache)).statusCode).toBe(200);
    expect(h.state!.db.data.familyInvitation.find((i) => i.id === early)?.status).toBe("cancelled");
    expect(await code(accept(tokens.hugo, early))).toBe("family.invite_closed");
    expect(await code(invite(tokens.hugo, IDS.lea))).toBe("family.already_in_family");
    expect(await code(invite(tokens.hugo, IDS.damien))).toBe("family.already_in_family");
    expect(await code(invite(tokens.damien, IDS.lea))).toBe("family.already_member");
  });

  it("accepter une invitation clôt les autres, et leur cloche", async () => {
    const fromDamien = (await invite(tokens.damien, IDS.lea)).json().id;
    const fromHugo = (await invite(tokens.hugo, IDS.lea)).json().id;
    expect((await accept(tokens.lea, fromHugo)).statusCode).toBe(200);
    expect(h.state!.db.data.familyInvitation.find((i) => i.id === fromDamien)?.status).toBe("cancelled");
    expect(h.state!.db.data.notification.filter((n) => n.jellyfinUserId === IDS.lea && n.type === "family_invite")).toHaveLength(0);
    expect(await code(accept(tokens.lea, fromDamien))).toBe("family.invite_closed");
  });

  it("deux acceptations lancées ensemble : une seule famille, la base tranche", async () => {
    const a = (await invite(tokens.damien, IDS.lea)).json().id;
    const b = (await invite(tokens.hugo, IDS.lea)).json().id;
    const results = await Promise.all([accept(tokens.lea, a), accept(tokens.lea, b)]);
    expect(results.map((r) => r.statusCode).filter((s) => s === 200)).toHaveLength(1);
    expect(rows().filter((m) => m.userId === IDS.lea)).toHaveLength(1);
  });

  it("accepter pendant qu'on fonde sa famille : jamais les deux", async () => {
    const id = (await invite(tokens.damien, IDS.lea)).json().id;
    const [joined, founded] = await Promise.all([accept(tokens.lea, id), invite(tokens.lea, IDS.hugo)]);
    expect([joined.statusCode, founded.statusCode].filter((s) => s === 200)).toHaveLength(1);
    expect(rows().filter((m) => m.userId === IDS.lea)).toHaveLength(1);
  });
});

describe("les invités d'un membre", () => {
  async function leaMayCreate(): Promise<void> {
    await join(tokens.damien, IDS.lea, tokens.lea);
    expect((await send("PUT", `/api/family/members/${IDS.lea}/rights`, tokens.damien, { createGuests: true })).statusCode).toBe(200);
  }

  it("entre dans la famille PARTAGÉE, avec la politique de SON créateur", async () => {
    await leaMayCreate();
    const zoe = (await guest(tokens.lea, "Zoé")).json();
    expect(zoe).toMatchObject({ kind: "guest", createdBy: IDS.lea, createdByName: "Léa" });
    expect(rows().find((m) => m.userId === zoe.userId)?.familyId).toBe(h.state!.db.data.family[0].id);
    const policy = h.state!.jf.users.get(zoe.userId)!.Policy;
    expect(policy).toMatchObject({ IsHidden: true, IsAdministrator: false });
    // Damien a un plafond (12) et un tag bloqué : jamais prêtés à l'invité de Léa.
    expect(policy.MaxParentalRating).not.toBe(12);
    const owners = (await guest(tokens.damien, "Noé")).json();
    expect(h.state!.jf.users.get(owners.userId)!.Policy).toMatchObject({ MaxParentalRating: 12, BlockedTags: ["horreur"] });
  });

  it("le membre gère les siens, jamais ceux du propriétaire ; le propriétaire gère tout", async () => {
    await leaMayCreate();
    const mine = (await guest(tokens.lea, "Zoé")).json().userId as string;
    const his = (await guest(tokens.damien, "Noé")).json().userId as string;
    expect(await code(send("DELETE", `/api/family/guests/${his}`, tokens.lea))).toBe("family.not_owner");
    expect(await code(send("PUT", `/api/family/guests/${his}/pin`, tokens.lea, { pin: "1234" }))).toBe("family.not_owner");
    expect((await send("PUT", `/api/family/guests/${mine}/pin`, tokens.lea, { pin: "1234" })).json()).toEqual({ hasPin: true });
    expect((await send("DELETE", `/api/family/guests/${mine}`, tokens.lea)).json()).toEqual({ deleted: true });
    expect((await send("DELETE", `/api/family/guests/${his}`, tokens.damien)).json()).toEqual({ deleted: true });
  });

  it("le droit retiré : rien n'est supprimé, il ne crée plus — et gère encore les siens", async () => {
    await leaMayCreate();
    const mine = (await guest(tokens.lea, "Zoé")).json().userId as string;
    await send("PUT", `/api/family/members/${IDS.lea}/rights`, tokens.damien, { createGuests: false });
    expect(rows().some((m) => m.userId === mine)).toBe(true);
    expect(await code(guest(tokens.lea, "Léo"))).toBe("family.guest_right_required");
    expect((await send("DELETE", `/api/family/guests/${mine}`, tokens.lea)).json()).toEqual({ deleted: true });
  });

  it("trois invités au plus, tous créateurs confondus ; ceux d'un membre parti restent au propriétaire", async () => {
    await leaMayCreate();
    expect((await guest(tokens.damien, "Noé")).statusCode).toBe(200);
    expect((await guest(tokens.damien, "Max")).statusCode).toBe(200);
    const zoe = (await guest(tokens.lea, "Zoé")).json().userId as string;
    expect(await code(guest(tokens.lea, "Léo"))).toBe("family.guests_full");
    const familyId = h.state!.db.data.family[0].id as string;
    expect((await send("POST", `/api/family/memberships/${familyId}/leave`, tokens.lea)).json()).toEqual({ left: true });
    expect(rows().find((m) => m.userId === zoe)).toMatchObject({ familyId, createdBy: IDS.lea });
    expect((await send("DELETE", `/api/family/guests/${zoe}`, tokens.damien)).json()).toEqual({ deleted: true });
  });
});
