/**
 * Tests d'attaque T8 (phase 3) — CANDIDATS, PUSH, SOCKET, DÉMO contre
 * l'implémentation de T2 : les comptes cachés ne s'énumèrent pas (SEC-F-22),
 * le push et le socket ne portent aucun secret et n'atteignent que les
 * concernés (SEC-F-25/26/27), le compte de démonstration ne fait aucun geste
 * de propriétaire (SEC-F-28).
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
import { IDS, bearer, buildFamilyApp, enroll, pairTv, resetCaches, seedUsers } from "../familyHarness";

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
const invite = (from: string, userId: string) => post("/api/family/invitations", from, { userId });
const candidateNames = async (q = "") =>
  (await app.inject({ method: "GET", url: `/api/family/candidates${q ? `?q=${encodeURIComponent(q)}` : ""}`, headers: bearer(tokens.damien) }))
    .json().map((c: { name: string }) => c.name);

// SEC-F-42 (v2) : l'énumération des comptes devient VOULUE — un compte caché
// de l'écran de connexion PARAÎT désormais dans les candidats (règle pure
// attaquée dans familleDroitsV2). Reste borné : jamais un invité, un désactivé
// ni soi-même. Ce bloc n'éprouve QUE ces invariants (vrais en v1 comme en v2) ;
// « le caché paraît en recherche partielle » par le service attend le
// branchement de T2 (familleV2.attente.test.ts).
describe("SEC-F-42 : les candidats n'exposent jamais un invité, un désactivé, ni soi-même", () => {
  it("l'invité créé, le compte désactivé et soi-même restent hors des candidats, et ne s'invitent pas", async () => {
    await post("/api/family/guests", tokens.damien, { name: "Zoé", color: "pink" }); // un invité
    const all = await candidateNames();
    expect(all).not.toContain("Coupé"); // désactivé
    expect(all).not.toContain("Damien"); // soi-même
    expect(all).not.toContain("Zoé"); // invité
    // Inviter un désactivé ou soi-même est refusé.
    expect((await invite(tokens.damien, IDS.coupe)).json().code).toBe("family.candidate_invalid");
    expect((await invite(tokens.damien, IDS.damien)).json().code).toBe("family.candidate_invalid");
  });
});

describe("SEC-F-25/26/27 : push et socket — aux seuls concernés, sans aucun secret", () => {
  it("l'invitation ne prévient que le destinataire par push, émetteur+destinataire par socket, sans jeton ni PIN", async () => {
    await post("/api/family/pin", tokens.damien, { pin: "4242" }); // le propriétaire a un PIN
    const res = await invite(tokens.damien, IDS.lea);
    const id = res.json().id as string;
    // Push : uniquement au destinataire, charge sans secret.
    expect(h.state!.pushes.map((p) => p.userId)).toEqual([IDS.lea]);
    expect(h.state!.pushes[0].data).toMatchObject({ type: "family_invite", refId: id });
    // Socket : émetteur et destinataire seulement, jamais un tiers.
    const notified = h.state!.socket.filter((s) => s.msg.type === "family:update").map((s) => s.userId).sort();
    expect(notified).toEqual([IDS.damien, IDS.lea].sort());
    expect(notified).not.toContain(IDS.hugo);
    // Aucun secret ne circule dans ces charges (jeton Jellyfin, jeton d'appareil, PIN).
    const payloads = JSON.stringify({ pushes: h.state!.pushes, socket: h.state!.socket });
    expect(payloads).not.toMatch(/jf-|Token=|eyJ|4242|pin/i);
  });
});

describe("SEC-F-28 : le compte de démonstration ne fait aucun geste de propriétaire", () => {
  it("invite, crée, dissout, retire → 403 review_account ; jamais candidat ; pas de « Gérer »", async () => {
    await h.state!.db.client.provisioningCode.create({ data: { code: "X".repeat(12), jellyfinUserId: IDS.demo, username: "Demo" } });
    expect((await invite(tokens.demo, IDS.lea)).json().code).toBe("family.review_account");
    expect((await post("/api/family/guests", tokens.demo, { name: "Zoé", color: "pink" })).json().code).toBe("family.review_account");
    expect((await del("/api/family", tokens.demo, { confirm: "dissolve" })).json().code).toBe("family.review_account");
    expect((await del(`/api/family/members/${IDS.lea}`, tokens.demo)).json().code).toBe("family.review_account");
    // Rien n'a été créé chez Jellyfin ni en base.
    expect(h.state!.db.data.family).toHaveLength(0);
    expect(h.state!.db.data.familyMember).toHaveLength(0);
    // Le compte de démo n'est jamais un candidat à l'invitation.
    expect((await invite(tokens.damien, IDS.demo)).json().code).toBe("family.candidate_invalid");
    // Sur sa TV, pas d'entrée « Gérer les profils ».
    const tv = await enroll(app, await pairTv(h.state!, IDS.demo, "Demo"));
    expect((await app.inject({ method: "GET", url: "/api/family/tv/profiles", headers: bearer(tv) })).json().canManage).toBe(false);
  });
});
