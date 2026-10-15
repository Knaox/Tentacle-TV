/**
 * « Connu pour » d'une personne TMDB : des titres extérieurs que rien ne juge —
 * vidé pour un compte restreint, gardé sinon (docs/DROITS-UTILISATEURS.md § 5).
 */

import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ restricted: true }));
vi.mock("../../src/middleware/auth", () => ({
  requireAuth: async (request: { user?: unknown }) => {
    request.user = { userId: "enfant", username: "Enfant", isAdmin: false };
  },
}));
vi.mock("../../src/services/contentPolicy", () => ({ isRestricted: async () => h.restricted }));
vi.mock("../../src/services/tmdb/client", () => ({
  tmdbConfigured: () => true,
  tmdbFetch: async () => ({
    results: [{ id: 7, name: "Acteur", profile_path: "/a.jpg", known_for: [{ title: "Film pour adultes" }] }],
  }),
}));
vi.mock("../../src/services/db", () => ({ getPrisma: () => ({}) }));

import { recoPeopleRoutes } from "../../src/routes/recoPeople";

async function search() {
  const app = Fastify();
  await app.register(recoPeopleRoutes, { prefix: "/api/reco" });
  const res = await app.inject({ method: "GET", url: "/api/reco/people/search?query=acteur" });
  await app.close();
  return res.json() as { results: Array<{ knownFor: string[] }> };
}

describe("GET /api/reco/people/search", () => {
  it("compte restreint : la personne, jamais ses titres « connu pour »", async () => {
    h.restricted = true;
    const body = await search();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].knownFor).toEqual([]);
  });

  it("compte non restreint : rien ne change", async () => {
    h.restricted = false;
    expect((await search()).results[0].knownFor).toEqual(["Film pour adultes"]);
  });
});
