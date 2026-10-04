/**
 * Tests d'attaque T8 (phase 3) — AUTORITÉ, IDOR, RÔLES, CAPACITÉ, EXPIRATION,
 * contre l'implémentation de T2 par les vraies routes. Seconde barrière,
 * indépendante des tests de T2, écrite depuis le modèle de menace : l'acteur se
 * déduit du jeton, une invitation d'autrui n'existe pas, un membre n'est pas
 * propriétaire, les limites tiennent sous course. SEC-F-01, 02, 03, 05, 06, 07, 33.
 *
 * Harnais commun de la Famille (`familyHarness.ts` / `familyMocks.ts`).
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
import { IDS, bearer, buildFamilyApp, resetCaches, seedUsers } from "../familyHarness";

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

const post = (url: string, token: string, payload?: unknown) =>
  app.inject({ method: "POST", url, headers: bearer(token), payload: payload as object });
const del = (url: string, token: string, payload?: unknown) =>
  app.inject({ method: "DELETE", url, headers: bearer(token), payload: payload as object });
const invite = (from: string, userId: string, extra: Record<string, unknown> = {}) =>
  post("/api/family/invitations", from, { userId, ...extra });
const accept = (token: string, id: string) => post("/api/family/invitations/accept", token, { id });
const addGuest = (token: string, name: string) => post("/api/family/guests", token, { name, color: "pink" });

/** Léa, membre de la famille de Damien. */
async function leaMember(): Promise<void> {
  const id = (await invite(tokens.damien, IDS.lea)).json().id;
  await accept(tokens.lea, id);
}

describe("SEC-F-01 : l'inviteur est le porteur du jeton, pas un champ du corps", () => {
  it("un fromUserId/ownerUserId forgé est ignoré", async () => {
    const res = await invite(tokens.damien, IDS.lea, { ownerUserId: IDS.hugo, fromUserId: IDS.hugo, inviterUserId: IDS.hugo });
    expect(res.statusCode).toBe(200);
    expect(h.state!.db.data.familyInvitation[0]).toMatchObject({ ownerUserId: IDS.damien, inviteeUserId: IDS.lea });
    // La famille créée appartient bien à Damien, jamais à Hugo.
    expect(h.state!.db.data.family[0].ownerUserId).toBe(IDS.damien);
  });
});

describe("SEC-F-02 : seul le destinataire accepte", () => {
  it("un autre compte ne peut accepter l'invitation, ni en glissant un userId dans le corps", async () => {
    const id = (await invite(tokens.damien, IDS.lea)).json().id;
    expect((await post("/api/family/invitations/accept", tokens.hugo, { id, userId: IDS.lea })).statusCode).toBe(404);
    // L'émetteur non plus n'accepte pas sa propre invitation.
    expect((await accept(tokens.damien, id)).statusCode).toBe(404);
    // Léa n'est entrée dans aucune famille (le propriétaire, lui, est sa propre
    // ligne depuis la v2 — c'est l'unicité en base, pas une adhésion de Léa).
    expect(h.state!.db.data.familyMember.some((m) => m.userId === IDS.lea)).toBe(false);
    // Le vrai destinataire, lui, passe.
    expect((await accept(tokens.lea, id)).statusCode).toBe(200);
  });
});

describe("SEC-F-03 : IDOR — une invitation d'autrui n'existe pas", () => {
  it("forger/viser l'invitation d'un autre → 404, corps identique à un identifiant inventé", async () => {
    const id = (await invite(tokens.damien, IDS.lea)).json().id;
    const foreign = await post("/api/family/invitations/decline", tokens.hugo, { id });
    const invented = await post("/api/family/invitations/decline", tokens.hugo, { id: "Z".repeat(24) });
    expect([foreign.statusCode, invented.statusCode]).toEqual([404, 404]);
    expect(foreign.json()).toEqual(invented.json());
  });

  it("annuler est le geste de l'émetteur seul : le destinataire → 403 not_owner, un tiers → 404", async () => {
    const id = (await invite(tokens.damien, IDS.lea)).json().id;
    expect((await post("/api/family/invitations/cancel", tokens.lea, { id })).json().code).toBe("family.not_owner");
    expect((await post("/api/family/invitations/cancel", tokens.hugo, { id })).statusCode).toBe(404);
  });
});

describe("SEC-F-05 : une invitation expirée ne s'accepte plus", () => {
  it("après sa date → 410 family.invite_expired, aucune adhésion", async () => {
    const id = (await invite(tokens.damien, IDS.lea)).json().id;
    h.state!.db.data.familyInvitation[0].expiresAt = new Date(Date.now() - 1000);
    const res = await accept(tokens.lea, id);
    expect(res.statusCode).toBe(410);
    expect(res.json().code).toBe("family.invite_expired");
    // Léa n'a pas adhéré (le propriétaire reste sa propre ligne).
    expect(h.state!.db.data.familyMember.some((m) => m.userId === IDS.lea)).toBe(false);
  });
});

describe("SEC-F-06 : les identifiants d'invitation ne sont pas énumérables", () => {
  it("deux invitations ont des identifiants distincts, longs, non séquentiels", async () => {
    const a = (await invite(tokens.damien, IDS.lea)).json().id as string;
    const b = (await invite(tokens.damien, IDS.hugo)).json().id as string;
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(22);
    expect(b.length).toBeGreaterThanOrEqual(22);
    // Pas un simple compteur : b n'est pas a + 1, et aucun n'est numérique.
    expect(Number.isNaN(Number(a))).toBe(true);
    expect(a.slice(0, -1)).not.toBe(b.slice(0, -1));
  });
});

describe("SEC-F-07 : les gestes du propriétaire sont gardés côté serveur", () => {
  it("un MEMBRE → 403 not_owner (cible dans sa famille) ; un compte SANS lien → 404", async () => {
    await leaMember();
    const guestId = (await addGuest(tokens.damien, "Zoé")).json().userId as string;
    // Léa est membre de la famille de Damien : elle en connaît les profils,
    // sans en être propriétaire → not_owner sur ce qu'elle y vise.
    expect((await del(`/api/family/guests/${guestId}`, tokens.lea)).json().code).toBe("family.not_owner");
    expect((await app.inject({ method: "PUT", url: `/api/family/guests/${guestId}/pin`, headers: bearer(tokens.lea), payload: { pin: "1234" } })).json().code).toBe("family.not_owner");
    // Dissoudre n'a pas de cible : un membre reste non-propriétaire → not_owner.
    expect((await del("/api/family", tokens.lea, { confirm: "dissolve" })).json().code).toBe("family.not_owner");
    // Hugo, lié à aucune famille : rien ne lui confirme l'existence de celle de Damien.
    expect((await del(`/api/family/members/${IDS.lea}`, tokens.hugo)).statusCode).toBe(404);
    expect((await del(`/api/family/guests/${guestId}`, tokens.hugo)).statusCode).toBe(404);
    // La famille de Damien est intacte.
    expect(h.state!.db.data.family).toHaveLength(1);
    expect(h.state!.jf.users.has(guestId)).toBe(true);
  });
});

describe("SEC-F-33 : capacité imposée côté serveur, sûre sous course", () => {
  // Propriétaire = Hugo (le quota d'invités est par propriétaire et par 24 h :
  // on l'isole de Damien, chargé par les autres tests du fichier).
  it("trois invités au plus, même quatre créations lancées ensemble", async () => {
    const names = ["Zoé", "Noé", "Léo", "Max"];
    const results = await Promise.all(names.map((n) => addGuest(tokens.hugo, n)));
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 200, 200, 409]);
    expect(results.find((r) => r.statusCode === 409)!.json().code).toBe("family.guests_full");
    expect(h.state!.db.data.familyMember.filter((m) => m.kind === "guest")).toHaveLength(3);
    expect(h.state!.db.data.family).toHaveLength(1);
  });

  it("six profils au plus : un invité de trop quand la famille est pleine → 409 family.full", async () => {
    await leaMember(); // damien + léa = 2
    const hugoId = (await invite(tokens.damien, IDS.hugo)).json().id;
    await accept(tokens.hugo, hugoId); // + hugo = 3 profils
    for (const n of ["Zoé", "Noé", "Léo"]) expect((await addGuest(tokens.damien, n)).statusCode).toBe(200); // + 3 invités = 6
    const full = await addGuest(tokens.damien, "Max"); // le 7e profil
    expect(full.statusCode).toBe(409);
    expect(full.json().code).toBe("family.full");
    // Jamais plus de six profils : en v2 le propriétaire EST une ligne
    // family_members (owner), donc le décompte l'inclut déjà.
    expect(h.state!.db.data.familyMember).toHaveLength(6);
  });
});
