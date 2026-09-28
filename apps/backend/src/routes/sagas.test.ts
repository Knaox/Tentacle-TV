/**
 * La route /api/sagas/:collectionId : validation, 503 tant que l'index n'est
 * pas prêt, TMDB demandé seulement quand la bibliothèque a un film de la
 * saga, et la langue transmise telle que le client la donne.
 */

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  members: vi.fn(),
  saga: vi.fn(),
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { user?: unknown }) => {
    request.user = { userId: "u1", username: "banc", isAdmin: false };
  },
}));
vi.mock("../services/search/sagaMembers", () => ({ sagaMembersFor: h.members }));
vi.mock("../services/tmdb/sagaCollection", () => ({ getSagaCollection: h.saga }));

import { sagaRoutes } from "./sagas";

const SAGA = { collectionId: 1241, name: "Harry Potter - Saga", parts: [{ tmdbId: 671, title: "HP 1", releaseDate: "2001-11-16" }] };

async function call(url: string) {
  const app = Fastify();
  await app.register(sagaRoutes, { prefix: "/api/sagas" });
  const res = await app.inject({ method: "GET", url });
  await app.close();
  return res;
}

beforeEach(() => {
  h.members.mockReset();
  h.saga.mockReset();
});

describe("GET /api/sagas/:collectionId", () => {
  it("rend la saga et les films du compte, en réponse privée", async () => {
    h.members.mockResolvedValue({ ready: true, members: [{ itemId: "a".repeat(32), tmdbId: 671 }] });
    h.saga.mockResolvedValue(SAGA);
    const res = await call("/api/sagas/1241?lang=en");
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.json()).toEqual({ collectionId: 1241, saga: SAGA, members: [{ itemId: "a".repeat(32), tmdbId: 671 }] });
    expect(h.members).toHaveBeenCalledWith("u1", 1241);
    expect(h.saga).toHaveBeenCalledWith(1241, "en");
  });

  it("aucun film de la saga dans la bibliothèque : pas d'appel TMDB", async () => {
    h.members.mockResolvedValue({ ready: true, members: [] });
    const res = await call("/api/sagas/10");
    expect(res.json()).toEqual({ collectionId: 10, saga: null, members: [] });
    expect(h.saga).not.toHaveBeenCalled();
  });

  it("index pas prêt : 503 et Retry-After, jamais une saga vide", async () => {
    h.members.mockResolvedValue({ ready: false });
    const res = await call("/api/sagas/1241");
    expect(res.statusCode).toBe(503);
    expect(res.headers["retry-after"]).toBe("10");
  });

  it("identifiant illisible : 400 ; langue inconnue : le français", async () => {
    expect((await call("/api/sagas/abc")).statusCode).toBe(400);
    expect((await call("/api/sagas/0")).statusCode).toBe(400);
    h.members.mockResolvedValue({ ready: true, members: [{ itemId: "b".repeat(32), tmdbId: null }] });
    h.saga.mockResolvedValue(null);
    await call("/api/sagas/1241?lang=de");
    expect(h.saga).toHaveBeenCalledWith(1241, "fr");
  });
});
