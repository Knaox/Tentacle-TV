/**
 * Un invité supprimé l'est VRAIMENT — le journal durable des comptes
 * d'invités (`guest_account_cleanups`, `guestAccountCleanup.ts`), par les
 * vraies routes. Jellyfin qui refuse ou ne répond pas n'arrête plus ni la
 * suppression d'un invité ni la dissolution : le compte attend au journal,
 * écarté de toute liste, et sa suppression se rejoue — après chaque échec,
 * au démarrage, à chaque balayage — jusqu'à réussir. Une création qui échoue
 * ou qu'un plantage interrompt ne laisse aucun compte. Jamais une personne de
 * la Famille ni un administrateur.
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
import { addUser, fakeJellyfinUsersFetch } from "./fakeJellyfinUsers";
import { IDS, bearer, buildFamilyApp, resetCaches, seedUsers } from "./familyHarness";
import { isFamilyGuest } from "../src/services/family/familyGuestMarkers";
import { sweepFamily } from "../src/services/family/familySweep";
import { CREATING_GRACE_MS, noteGuestAccount, sweepGuestAccounts } from "../src/services/family/guestAccountCleanup";

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

const MINUTE = 60_000;
const send = (method: "POST" | "DELETE", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const journal = () => h.state!.db.data.guestAccountCleanup;
const exists = (userId: string) => h.state!.jf.users.has(userId);
const inFamily = (userId: string) => h.state!.db.data.familyMember.some((row) => row.userId === userId);

async function createGuest(name: string): Promise<string> {
  const res = await send("POST", "/api/family/guests", tokens.damien, { name, color: "teal" });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().userId as string;
}

async function join(userId: string, token: string): Promise<void> {
  const id = (await send("POST", "/api/family/invitations", tokens.damien, { userId })).json().id;
  await send("POST", "/api/family/invitations/accept", token, { id });
}

/** Jellyfin injoignable pour ces comptes-là (le reste répond). */
function unreachableFor(userIds: string[]): void {
  const online = h.fetch!;
  h.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (userIds.some((id) => path.startsWith(`/Users/${id}`))) throw new TypeError("fetch failed");
    return online(input, init);
  };
}

describe("un invité supprimé l'est vraiment", () => {
  it("Jellyfin répond : le compte part avant la réponse, rien ne reste au journal", async () => {
    const zoe = await createGuest("Zoé");
    expect(journal()).toHaveLength(0);
    expect((await send("DELETE", `/api/family/guests/${zoe}`, tokens.damien)).json()).toEqual({ deleted: true });
    expect(exists(zoe)).toBe(false);
    expect(journal()).toHaveLength(0);
  });

  it("Jellyfin refuse : l'invité quitte la famille tout de suite, la suppression se rejoue jusqu'à réussir", async () => {
    const zoe = await createGuest("Zoé");
    h.state!.jf.refuseDeletion = true;
    const t0 = Date.now();
    expect((await send("DELETE", `/api/family/guests/${zoe}`, tokens.damien)).json()).toEqual({ deleted: true });
    expect(inFamily(zoe)).toBe(false);
    expect(exists(zoe)).toBe(true);
    expect(journal()).toEqual([expect.objectContaining({ jellyfinUserId: zoe, reason: "guest_deleted", attempts: 1, lastError: "HTTP 500" })]);
    // En attendant, il reste un invité pour toutes les listes.
    expect(await isFamilyGuest(zoe)).toBe(true);

    // Pas avant l'heure ; chaque échec repousse l'essai suivant.
    await sweepGuestAccounts(t0 + 30_000);
    expect(journal()[0].attempts).toBe(1);
    await sweepGuestAccounts(t0 + 2 * MINUTE);
    await sweepGuestAccounts(t0 + 8 * MINUTE);
    expect(journal()[0].attempts).toBe(3);
    expect(exists(zoe)).toBe(true);

    h.state!.jf.refuseDeletion = false;
    await sweepGuestAccounts(t0 + 60 * MINUTE);
    expect(exists(zoe)).toBe(false);
    expect(journal()).toHaveLength(0);
    expect(await isFamilyGuest(zoe)).toBe(false);
  });

  it("la dissolution n'attend plus Jellyfin : la famille part, les comptes des invités suivent au balayage", async () => {
    await join(IDS.lea, tokens.lea);
    const guests = [await createGuest("Zoé"), await createGuest("Tom")];
    const online = h.fetch!;
    unreachableFor(guests);
    const t0 = Date.now();
    expect((await send("DELETE", "/api/family", tokens.damien, { confirm: "dissolve" })).json()).toEqual({ dissolved: true });
    expect(h.state!.db.data.family).toHaveLength(0);
    expect(h.state!.db.data.familyMember).toHaveLength(0);
    expect(journal().map((entry) => [entry.jellyfinUserId, entry.reason, entry.lastError]).sort()).toEqual(
      guests.map((id) => [id, "dissolved", "unreachable"]).sort(),
    );
    expect(guests.every(exists)).toBe(true);
    expect(await isFamilyGuest(guests[0])).toBe(true);

    await sweepFamily(t0 + 2 * MINUTE);
    expect(journal().map((entry) => entry.attempts)).toEqual([2, 2]);
    h.fetch = online;
    await sweepFamily(t0 + 60 * MINUTE);
    expect(guests.some(exists)).toBe(false);
    expect(journal()).toHaveLength(0);
    // Les vrais comptes ne bougent pas.
    expect(exists(IDS.damien) && exists(IDS.lea)).toBe(true);
  });

  it("une création qui échoue après Jellyfin ne laisse aucun compte, même s'il refuse d'abord de le supprimer", async () => {
    const online = h.fetch!;
    h.fetch = async (input, init) =>
      init?.method === "POST" && /^\/Users\/[^/]+\/Policy$/.test(new URL(String(input)).pathname) ? new Response("", { status: 500 }) : online(input, init);
    h.state!.jf.refuseDeletion = true;
    const t0 = Date.now();
    expect((await send("POST", "/api/family/guests", tokens.damien, { name: "Zoé", color: "teal" })).json().code).toBe("family.jellyfin_refused");
    const orphan = [...h.state!.jf.users.values()].find((user) => user.Name.startsWith("Zoe - invite de Damien"));
    expect(orphan).toBeDefined();
    expect(journal()).toEqual([expect.objectContaining({ jellyfinUserId: orphan!.Id, reason: "abandoned", attempts: 1 })]);
    expect(await isFamilyGuest(orphan!.Id)).toBe(true);

    h.fetch = online;
    h.state!.jf.refuseDeletion = false;
    await sweepGuestAccounts(t0 + 2 * MINUTE);
    expect(exists(orphan!.Id)).toBe(false);
    expect(journal()).toHaveLength(0);
  });

  it("après un plantage, le premier balayage (au démarrage) rejoue ; une création interrompue attend son délai de grâce", async () => {
    // Suppression : la transaction a eu lieu (invité retiré, compte au
    // journal), le serveur est tombé avant d'appeler Jellyfin.
    const zoe = await createGuest("Zoé");
    h.state!.db.data.familyMember.splice(h.state!.db.data.familyMember.findIndex((row) => row.userId === zoe), 1);
    await noteGuestAccount(zoe, "Zoe - invite de Damien", "guest_deleted");
    // Création : Jellyfin a créé le compte, le serveur est tombé avant la ligne de l'invité.
    const orphan = "0f".repeat(16);
    addUser(h.state!.jf, { id: orphan, name: "Tom - invite de Damien", policy: { IsHidden: true } });
    await noteGuestAccount(orphan, "Tom - invite de Damien", "creating");

    // `startFamilySweep` (index.ts) lance ce balayage dès le démarrage.
    await sweepFamily();
    expect(exists(zoe)).toBe(false);
    expect(exists(orphan)).toBe(true);
    await sweepGuestAccounts(Date.now() + CREATING_GRACE_MS + MINUTE);
    expect(exists(orphan)).toBe(false);
    expect(journal()).toHaveLength(0);
  });

  it("jamais une personne de la Famille ni un administrateur : l'entrée est soldée, le compte reste", async () => {
    await join(IDS.lea, tokens.lea);
    const zoe = await createGuest("Zoé");
    h.state!.jf.users.get(IDS.hugo)!.Policy.IsAdministrator = true;
    await noteGuestAccount(IDS.damien, "Damien", "dissolved");
    // Le même compte, écrit avec des tirets : toujours Léa.
    await noteGuestAccount(IDS.lea.replace(/^(.{8})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4-").toUpperCase(), "Léa", "guest_deleted");
    await noteGuestAccount(zoe, "Zoe - invite de Damien", "abandoned");
    await noteGuestAccount(IDS.hugo, "Hugo", "guest_deleted");
    h.state!.jf.calls.length = 0;
    await sweepGuestAccounts(Date.now() + MINUTE);
    expect([IDS.damien, IDS.lea, zoe, IDS.hugo].every(exists)).toBe(true);
    expect(inFamily(zoe)).toBe(true);
    expect(journal()).toHaveLength(0);
    // Les personnes de la Famille ne sont pas même demandées à Jellyfin ;
    // l'administrateur est lu, jamais supprimé.
    expect(h.state!.jf.calls.filter((call) => / \/Users\/./.test(call))).toEqual([`GET /Users/${IDS.hugo}`]);
  });
});
