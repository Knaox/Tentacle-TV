/**
 * Tests d'attaque — « Reproposer le code PIN et la photo » (`resetPrompts`,
 * 1.30.0), par les vraies routes. Mêmes droits que le code ou la photo du
 * profil : soi-même, le propriétaire, un parent pour les invités et les
 * mineurs, le créateur d'un invité. Jamais un membre pour un autre, jamais un
 * compte hors de la famille. La date posée se lit dans la vue de la famille,
 * sur la TV et dans « Qui regarde ? » du bureau ; le rappel `familyPin` masqué
 * du compte visé est réaffiché.
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
import { IDS, bearer, enroll, pairTv, resetCaches, seedUsers } from "../familyHarness";
import { buildPickerApp } from "../familyPickerHarness";
import { FAMILY_ROUTES } from "../../src/family/familyRoutes";
import { hintsConfigKey } from "../../src/routes/preferences.hints";

let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;

beforeAll(async () => {
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => h.fetch!(input, init));
  app = await buildPickerApp();
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

const send = (method: "POST" | "PUT" | "GET", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const reset = (token: string, userId: string) => send("POST", `/api/family/profiles/${userId}/prompts/reset`, token);
const inviteAccept = async (from: string, userId: string, token: string) => {
  const id = (await send("POST", "/api/family/invitations", from, { userId })).json().id;
  return send("POST", "/api/family/invitations/accept", token, { id });
};
const profileIn = async (token: string, userId: string) =>
  ((await send("GET", "/api/family", token)).json().family.profiles as { userId: string; promptsResetAt?: string | null }[]).find(
    (profile) => profile.userId === userId,
  );

/** Damien propriétaire ; Léa membre qui crée des invités ; Hugo membre simple. */
async function family(): Promise<{ zoe: string }> {
  await inviteAccept(tokens.damien, IDS.lea, tokens.lea);
  await send("PUT", `/api/family/members/${IDS.lea}/rights`, tokens.damien, { createGuests: true });
  await inviteAccept(tokens.damien, IDS.hugo, tokens.hugo);
  const zoe = (await send("POST", "/api/family/guests", tokens.lea, { name: "Zoé", color: "teal" })).json().userId as string;
  return { zoe };
}

describe("reproposer : le contrat", () => {
  it("une session personnelle, ou la gestion ouverte d'un profil par SON code — jamais une TV ni un jumelage", () => {
    expect(FAMILY_ROUTES.resetPrompts.callers).toEqual(["personal", "ownerProfile", "memberProfile"]);
  });

  it("aucune date tant que personne n'a rien demandé", async () => {
    await family();
    expect((await profileIn(tokens.damien, IDS.hugo))?.promptsResetAt).toBeNull();
  });
});

describe("reproposer : qui peut", () => {
  it("le propriétaire, pour un membre : la date est rendue, et se lit dans la vue de la famille", async () => {
    await family();
    const res = await reset(tokens.damien, IDS.hugo);
    expect(res.statusCode).toBe(200);
    const { promptsResetAt } = res.json() as { promptsResetAt: string };
    expect(Number.isNaN(Date.parse(promptsResetAt))).toBe(false);
    expect((await profileIn(tokens.hugo, IDS.hugo))?.promptsResetAt).toBe(promptsResetAt);
  });

  it("chacun pour lui-même, le créateur pour son invité", async () => {
    const { zoe } = await family();
    expect((await reset(tokens.hugo, IDS.hugo)).statusCode).toBe(200);
    expect((await reset(tokens.damien, IDS.damien)).statusCode).toBe(200);
    expect((await reset(tokens.lea, zoe)).statusCode).toBe(200);
  });

  it("un membre SANS droit ne repropose pas pour un autre : ni un membre, ni le propriétaire, ni l'invité d'un autre (403), et rien n'est écrit", async () => {
    const { zoe } = await family();
    for (const target of [IDS.lea, IDS.damien, zoe]) {
      const res = await reset(tokens.hugo, target);
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe("family.not_owner");
    }
    expect((await profileIn(tokens.damien, IDS.lea))?.promptsResetAt).toBeNull();
    expect((await profileIn(tokens.damien, zoe))?.promptsResetAt).toBeNull();
  });

  it("un parent, pour un invité et un membre mineur — jamais pour le propriétaire", async () => {
    const { zoe } = await family();
    await send("PUT", `/api/family/members/${IDS.hugo}/role`, tokens.damien, { parent: true });
    expect((await reset(tokens.hugo, zoe)).statusCode).toBe(200);
    expect((await reset(tokens.hugo, IDS.lea)).statusCode).toBe(200);
    expect((await reset(tokens.hugo, IDS.damien)).statusCode).toBe(403);
  });

  it("un compte hors de la famille : le profil « n'existe pas » pour lui (404)", async () => {
    await inviteAccept(tokens.damien, IDS.lea, tokens.lea);
    const res = await reset(tokens.hugo, IDS.lea);
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("family.not_found");
  });

  it("un jeton de jumelage de TV ne passe pas la porte", async () => {
    await family();
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    expect((await reset(pairing, IDS.hugo)).statusCode).toBeGreaterThanOrEqual(401);
  });
});

describe("reproposer : ce que les appareils en lisent", () => {
  it("la TV et « Qui regarde ? » du bureau rendent la date du profil", async () => {
    const { zoe } = await family();
    const { promptsResetAt } = (await reset(tokens.lea, zoe)).json() as { promptsResetAt: string };
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    const tv = (await send("GET", "/api/family/tv/profiles", pairing)).json().profiles as { userId: string; promptsResetAt?: string | null }[];
    expect(tv.find((profile) => profile.userId === zoe)?.promptsResetAt).toBe(promptsResetAt);
    expect(tv.find((profile) => profile.userId === IDS.hugo)?.promptsResetAt).toBeNull();
    const picker = (await send("GET", "/api/family/picker/profiles?platform=desktop", tokens.damien)).json().profiles as {
      userId: string;
      promptsResetAt?: string | null;
    }[];
    expect(picker.find((profile) => profile.userId === zoe)?.promptsResetAt).toBe(promptsResetAt);
  });

  it("le rappel `familyPin` masqué du compte visé est réaffiché, ses appareils prévenus ; ses autres rappels restent", async () => {
    await family();
    const key = hintsConfigKey(IDS.hugo);
    await h.state!.db.client.serverConfig.create({ data: { key, value: JSON.stringify(["familyPin", "tmdbKey"]) } });
    h.state!.socket.length = 0;
    expect((await reset(tokens.damien, IDS.hugo)).statusCode).toBe(200);
    const row = await h.state!.db.client.serverConfig.findUnique({ where: { key } });
    expect(JSON.parse(String(row!.value))).toEqual(["tmdbKey"]);
    expect(h.state!.socket).toContainEqual({ userId: IDS.hugo, msg: { type: "preferences:update", scope: "hints" } });
  });
});
