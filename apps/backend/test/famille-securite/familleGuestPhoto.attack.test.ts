/**
 * Tests d'attaque — la PHOTO d'un invité (`setGuestPhoto`, 1.30.0), par les
 * vraies routes. Mêmes droits que son PIN : le propriétaire, ou le membre qui
 * l'a créé ; jamais un autre membre, jamais un compte hors de la famille,
 * jamais une session de profil. Le serveur relaie l'image à Jellyfin avec SA
 * clé, et la photo se voit ensuite partout (vue de la famille, TV, bureau).
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
import { FAMILY_GUEST_PHOTO_MAX_BASE64 } from "../../src/family/familyContract";
import { FAMILY_ROUTES } from "../../src/family/familyRoutes";

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

// Une « image » en base64 nu : le serveur ne la décode pas, il la relaie.
const IMAGE = Buffer.from("tentacle-avatar-".repeat(16)).toString("base64");
const photo = { image: IMAGE, type: "image/jpeg" };

const send = (method: "POST" | "PUT" | "DELETE", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const get = (url: string, token: string) => app.inject({ method: "GET", url, headers: bearer(token) });
const guest = (token: string, name: string) => send("POST", "/api/family/guests", token, { name, color: "teal" });
const setPhoto = (token: string, userId: string, body: unknown = photo) =>
  send("PUT", `/api/family/guests/${userId}/photo`, token, body);
const inviteAccept = async (from: string, userId: string, token: string) => {
  const id = (await send("POST", "/api/family/invitations", from, { userId })).json().id;
  return send("POST", "/api/family/invitations/accept", token, { id });
};

describe("la photo d'un invité : le contrat", () => {
  it("une session personnelle, ou la gestion ouverte d'un profil par SON code (1.30.0) — jamais une session de profil quelconque", () => {
    expect(FAMILY_ROUTES.setGuestPhoto.callers).toEqual(["personal", "ownerProfile", "memberProfile"]);
  });
});

describe("la photo d'un invité : qui peut la poser", () => {
  it("le propriétaire : relayée à Jellyfin telle quelle, avec son type, et l'étiquette revient", async () => {
    const lili = (await guest(tokens.damien, "Lili")).json().userId as string;
    const res = await setPhoto(tokens.damien, lili);
    expect(res.statusCode).toBe(200);
    expect(res.json().imageTag).toMatch(/^[0-9a-f]{16}$/);
    expect(h.state!.jf.images.get(lili)).toEqual({ contentType: "image/jpeg", body: IMAGE });
  });

  it("la photo se voit ensuite dans la vue de la famille (plus d'étiquette forcée à null pour un invité)", async () => {
    const lili = (await guest(tokens.damien, "Lili")).json().userId as string;
    const { imageTag } = (await setPhoto(tokens.damien, lili)).json();
    const profiles = (await get("/api/family", tokens.damien)).json().family.profiles as { userId: string; imageTag: string | null }[];
    expect(profiles.find((profile) => profile.userId === lili)?.imageTag).toBe(imageTag);
  });

  it("le membre qui l'a créé, oui ; un autre membre, jamais (family.not_owner)", async () => {
    await inviteAccept(tokens.damien, IDS.lea, tokens.lea);
    await send("PUT", `/api/family/members/${IDS.lea}/rights`, tokens.damien, { createGuests: true });
    await inviteAccept(tokens.damien, IDS.hugo, tokens.hugo);
    const hers = (await guest(tokens.lea, "Zoé")).json().userId as string;
    expect((await setPhoto(tokens.lea, hers)).statusCode).toBe(200);
    const res = await setPhoto(tokens.hugo, hers);
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("family.not_owner");
  });

  it("un compte hors de la famille : l'invité « n'existe pas » pour lui, et rien ne part chez Jellyfin", async () => {
    const lili = (await guest(tokens.damien, "Lili")).json().userId as string;
    const res = await setPhoto(tokens.hugo, lili);
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("family.not_found");
    expect(h.state!.jf.images.has(lili)).toBe(false);
  });

  it("un compte qui n'est pas un invité (le propriétaire lui-même, un membre) : refusé", async () => {
    await inviteAccept(tokens.damien, IDS.lea, tokens.lea);
    expect((await setPhoto(tokens.damien, IDS.lea)).statusCode).toBeGreaterThanOrEqual(403);
    expect((await setPhoto(tokens.damien, IDS.damien)).statusCode).toBeGreaterThanOrEqual(403);
    expect(h.state!.jf.images.size).toBe(0);
  });
});

describe("la photo d'un invité : ce qui est refusé à l'entrée", () => {
  it("un type que Jellyfin ne lit pas, un préfixe data:, pas d'image, une image trop longue → family.invalid_input", async () => {
    const lili = (await guest(tokens.damien, "Lili")).json().userId as string;
    for (const body of [
      { image: IMAGE, type: "image/gif" },
      { image: `data:image/jpeg;base64,${IMAGE}`, type: "image/jpeg" },
      { type: "image/jpeg" },
      { image: "A".repeat(FAMILY_GUEST_PHOTO_MAX_BASE64 + 8), type: "image/jpeg" },
    ]) {
      const res = await setPhoto(tokens.damien, lili, body);
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe("family.invalid_input");
    }
    expect(h.state!.jf.images.size).toBe(0);
  });

  it("un corps plus lourd que la limite : 413 avant toute lecture, rien ne part chez Jellyfin", async () => {
    const lili = (await guest(tokens.damien, "Lili")).json().userId as string;
    const res = await setPhoto(tokens.damien, lili, { image: "A".repeat(FAMILY_GUEST_PHOTO_MAX_BASE64 + 16_384), type: "image/jpeg" });
    expect(res.statusCode).toBe(413);
    expect(h.state!.jf.images.size).toBe(0);
  });

  it("Jellyfin refuse : family.jellyfin_refused, et la photo d'avant reste", async () => {
    const lili = (await guest(tokens.damien, "Lili")).json().userId as string;
    h.state!.jf.refuseImages = true;
    const res = await setPhoto(tokens.damien, lili);
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe("family.jellyfin_refused");
  });
});
