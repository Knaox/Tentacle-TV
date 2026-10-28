/**
 * Les routes du partage : le droit « Partage public », « voir en tant que » et l'invité refusés, une playlist
 * que le compte ne voit pas = 404, un lien par playlist, révocable ; le document public sans compte, jamais
 * pour un jeton mal formé ; la capacité absente = aucune route.
 */

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: "personal" as string,
  mayShare: true,
  guest: false,
  visible: true,
  declared: true,
  published: null as string | null,
  shares: new Map<string, { token: string; playlistId: string; ownerUserId: string; ownerName: string; createdAt: number }>(),
}));

vi.mock("../routes/requestView", () => ({ userOf: () => ({ userId: "u1", username: "Damien", isAdmin: false, session: state.session }) }));
vi.mock("../../serverCapabilities/declaredCapabilities", () => ({
  capabilityGate: () => async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => (state.declared ? undefined : reply.status(404).send({ error: "not_available" })),
}));
vi.mock("../../services/share/publicSharingRight", () => ({ mayShareInPublic: async () => state.mayShare, PUBLIC_SHARING_DENIED: { error: "public_sharing_denied" } }));
vi.mock("../../services/family/familyGuestMarkers", () => ({ isFamilyGuest: async () => state.guest }));
vi.mock("../../remoteAccess/exposure", () => ({ publishedPublicUrl: () => state.published }));
vi.mock("../playlists/playlistJellyfin", () => ({ playlistFor: async () => (state.visible ? { Id: "pl1" } : null) }));
vi.mock("./shareStore", () => ({
  shareOf: async (_u: string, p: string) => state.shares.get(p) ?? null,
  ensureShare: async (u: string, name: string, p: string) => {
    const existing = state.shares.get(p) ?? { token: `T${state.shares.size}`.padEnd(22, "x"), playlistId: p, ownerUserId: u, ownerName: name, createdAt: 5 };
    state.shares.set(p, existing);
    return existing;
  },
  revokeShare: async (_u: string, p: string) => void state.shares.delete(p),
}));
vi.mock("./shareDocument", () => ({
  loadShareDocument: async (token: string) =>
    [...state.shares.values()].some((s) => s.token === token) ? { ok: true, document: { v: 1, name: "Été", tracks: [] } } : { ok: false, reason: "not_found" },
}));

import { musicShareOwnerRoutes, musicSharePublicRoutes } from "./shareRoutes";

const PL = "0123456789abcdef0123456789abcdef";

async function call(method: "GET" | "POST" | "DELETE", url: string) {
  const app = Fastify();
  await app.register(async (scope) => musicShareOwnerRoutes(scope), { prefix: "/api/music" });
  await app.register(musicSharePublicRoutes);
  const res = await app.inject({ method, url, headers: { host: "maison.local:3000" } });
  await app.close();
  return res;
}

beforeEach(() => {
  Object.assign(state, { session: "personal", mayShare: true, guest: false, visible: true, declared: true, published: null });
  state.shares.clear();
});

describe("partager une playlist", () => {
  it("un lien par playlist, sur le lien public s'il est réglé ; sinon l'adresse de l'appareil, dite « local »", async () => {
    const first = (await call("POST", `/api/music/playlists/${PL}/share`)).json();
    expect(first.share).toMatchObject({ url: `http://maison.local:3000/octave/share/${first.share.token}`, reach: "local" });
    state.published = "https://musique.example/";
    const again = (await call("POST", `/api/music/playlists/${PL}/share`)).json();
    expect(again.share).toMatchObject({ token: first.share.token, url: `https://musique.example/octave/share/${first.share.token}`, reach: "public" });
    expect((await call("GET", `/api/music/playlists/${PL}/share`)).json().share.token).toBe(first.share.token);
  });

  it("refusé sans le droit, pour « voir en tant que », pour un invité ; 404 pour une playlist qu'il ne voit pas", async () => {
    state.mayShare = false;
    expect((await call("POST", `/api/music/playlists/${PL}/share`)).json()).toEqual({ error: "public_sharing_denied" });
    Object.assign(state, { mayShare: true, session: "impersonation" });
    expect((await call("POST", `/api/music/playlists/${PL}/share`)).statusCode).toBe(403);
    Object.assign(state, { session: "tvProfile", guest: true });
    expect((await call("POST", `/api/music/playlists/${PL}/share`)).statusCode).toBe(403);
    Object.assign(state, { session: "personal", guest: false, visible: false });
    expect((await call("POST", `/api/music/playlists/${PL}/share`)).statusCode).toBe(404);
    expect(state.shares.size).toBe(0);
  });

  it("révoquer : le lien ne sert plus rien", async () => {
    const { share } = (await call("POST", `/api/music/playlists/${PL}/share`)).json();
    expect((await call("GET", `/api/music/share/${share.token}`)).statusCode).toBe(200);
    expect((await call("DELETE", `/api/music/playlists/${PL}/share`)).json()).toEqual({ share: null });
    const gone = await call("GET", `/api/music/share/${share.token}`);
    expect(gone.statusCode).toBe(404);
    expect(gone.json()).toEqual({ error: "share_unavailable" });
  });

  it("document public : jeton mal formé = 404 sans lecture ; jamais en cache ; capacité absente = aucune route", async () => {
    const bad = await call("GET", "/api/music/share/abc");
    expect(bad.statusCode).toBe(404);
    const { share } = (await call("POST", `/api/music/playlists/${PL}/share`)).json();
    const ok = await call("GET", `/api/music/share/${share.token}`);
    expect(ok.headers["cache-control"]).toBe("no-store");
    state.declared = false;
    expect((await call("GET", `/api/music/share/${share.token}`)).json()).toEqual({ error: "not_available" });
    expect((await call("POST", `/api/music/playlists/${PL}/share`)).json()).toEqual({ error: "not_available" });
  });
});

describe("le droit du partage, le même pour créer un lien et importer celui d'un autre serveur", () => {
  it("jamais « voir en tant que » ni un invité de la Famille ; sinon le droit « Partage public »", async () => {
    const { mayUsePlaylistShares } = await import("./shareRight");
    expect(await mayUsePlaylistShares({ userId: "u1", session: "impersonation" })).toBe(false);
    state.guest = true;
    expect(await mayUsePlaylistShares({ userId: "u1", session: "tvProfile" })).toBe(false);
    state.guest = false;
    expect(await mayUsePlaylistShares({ userId: "u1", session: "tvProfile" })).toBe(true);
    state.mayShare = false;
    expect(await mayUsePlaylistShares({ userId: "u1", session: "personal" })).toBe(false);
  });
});
