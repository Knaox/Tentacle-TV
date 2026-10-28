/**
 * `POST /api/music/import` : la capacité, l'entrée fermée (aucun hôte hors
 * liste), « voir en tant que » refusé, un compte sans musique 404, et le
 * suivi réservé au compte qui l'a lancé — appels directs compris.
 */

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: "u1", session: "personal", mode: "all", declared: true, shareRight: true }));

vi.mock("../routes/requestView", () => ({
  userOf: () => ({ userId: state.userId, username: "banc", isAdmin: false, session: state.session }),
  viewOf: async () => ({ userId: state.userId, access: { mode: state.mode } }),
}));
vi.mock("../../serverCapabilities/declaredCapabilities", () => ({
  capabilityGate: () => async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => (state.declared ? undefined : reply.status(404).send({ error: "not_available" })),
}));
vi.mock("../playlists/playlistService", () => ({ createPlaylist: vi.fn() }));
vi.mock("../view/viewContext", () => ({ userView: vi.fn() }));

import { resetImportsForTests } from "./importJobs";
import { musicImportRoutes } from "./importRoutes";

const fetcher = vi.fn();

async function call(method: "POST" | "GET", url: string, payload?: unknown) {
  const app = Fastify();
  musicImportRoutes(app, {
    fetcher,
    view: async () => ({ userId: state.userId }) as never,
    create: async () => ({ ok: true, value: "pl" }),
    match: async () => new Map(),
    mayImportShare: async () => state.shareRight,
    shareFetcher: async () => ({ status: 404, body: "" }),
  });
  const res = await app.inject({ method, url, payload: payload as never });
  await app.close();
  return res;
}

beforeEach(() => {
  Object.assign(state, { userId: "u1", session: "personal", mode: "all", declared: true, shareRight: true });
  fetcher.mockReset();
  resetImportsForTests();
});

describe("POST /import — gardes", () => {
  it("serveur sans la capacité : la route n'existe pas", async () => {
    state.declared = false;
    expect((await call("POST", "/import", { text: "A - B" })).statusCode).toBe(404);
  });

  it("un lien hors de la liste fermée : refusé AVANT toute requête", async () => {
    for (const url of ["https://evil.example/playlist/1", "http://127.0.0.1:8096/Items", "https://open.spotify.com.evil.example/playlist/37i9dQZF1DXcBWIGoYBM5M"]) {
      const res = await call("POST", "/import", { url });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "unsupported_url" });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("corps mal formé : deux sources, aucune, texte trop long", async () => {
    expect((await call("POST", "/import", { url: "https://www.deezer.com/playlist/1", text: "A - B" })).statusCode).toBe(400);
    expect((await call("POST", "/import", {})).statusCode).toBe(400);
    expect((await call("POST", "/import", { text: "x".repeat(600_000) })).statusCode).toBe(400);
    expect((await call("POST", "/import", { playlist: { source: "myspace", tracks: [] } })).statusCode).toBe(400);
  });

  it("« voir en tant que » ne crée rien au nom d'un autre", async () => {
    state.session = "impersonation";
    expect((await call("POST", "/import", { text: "A - B" })).statusCode).toBe(403);
  });

  it("un compte qui ne voit aucune musique : 404", async () => {
    state.mode = "none";
    expect((await call("POST", "/import", { text: "A - B" })).statusCode).toBe(404);
  });

  it("accepté : 202 et un identifiant de suivi ; un autre compte ne le lit pas", async () => {
    const res = await call("POST", "/import", { text: "A - B", keepEmpty: true });
    expect(res.statusCode).toBe(202);
    const { jobId } = res.json() as { jobId: string };
    expect((await call("GET", `/import/${jobId}`)).statusCode).toBe(200);
    state.userId = "u2";
    expect((await call("GET", `/import/${jobId}`)).statusCode).toBe(404);
  });
});

describe("POST /import — le lien d'un autre Tentacle (règle 15 : sans le droit du partage, rien)", () => {
  const link = "https://musique.ami.example/octave/share/AbCdEfGhIjKlMnOpQrStUv";

  it("sans le droit « Partage public » (ou invité de la Famille) : refusé comme un lien inconnu, rien n'est lu", async () => {
    state.shareRight = false;
    const res = await call("POST", "/import", { url: link });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "unsupported_url" });
  });

  it("avec le droit : accepté (202)", async () => {
    expect((await call("POST", "/import", { url: link })).statusCode).toBe(202);
  });
});
