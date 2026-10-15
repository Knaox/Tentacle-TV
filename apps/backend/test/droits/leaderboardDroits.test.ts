/**
 * Le classement montre les séries préférées d'un AUTRE compte : seulement
 * celles que les droits du DEMANDEUR lui laissent voir (docs/DROITS-UTILISATEURS.md
 * § 5) ; un invité de la Famille n'y est jamais une cible.
 */

import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/middleware/auth", () => ({
  requireAuth: async (request: { user?: unknown }) => {
    request.user = { userId: "enfant", username: "Enfant", isAdmin: false, session: "personal" };
  },
}));
vi.mock("../../src/services/configStore", () => ({ getJellyfinUrl: () => "http://jf.test" }));
vi.mock("../../src/services/leaderboard", () => ({ watchLeaderboard: async () => [] }));
vi.mock("../../src/services/leaderboard/topSeries", () => ({
  favoriteSeries: async () => [
    { seriesId: "serie-adulte", name: "Série pour adultes", episodesPlayed: 9, playCount: 9 },
    { seriesId: "serie-famille", name: "Série familiale", episodesPlayed: 3, playCount: 3 },
  ],
}));
vi.mock("../../src/services/family/familyGuestMarkers", () => ({
  isFamilyGuest: async (userId: string) => userId === "invite",
}));
vi.mock("../../src/services/itemAccess/itemVisibility", () => ({
  visibleItemIdsFor: async (userId: string, ids: string[]) =>
    ids.filter((id) => !(userId === "enfant" && id === "serie-adulte")),
}));

import { leaderboardRoutes } from "../../src/routes/leaderboard";

async function topSeries(target: string) {
  const app = Fastify();
  await app.register(leaderboardRoutes, { prefix: "/api/leaderboard" });
  const response = await app.inject({ method: "GET", url: `/api/leaderboard/${target}/top-series` });
  await app.close();
  return response;
}

describe("GET /api/leaderboard/:userId/top-series", () => {
  it("les séries d'un adulte, vues par un enfant : seulement celles que l'enfant a le droit de voir", async () => {
    const response = await topSeries("adulte");
    expect(response.statusCode).toBe(200);
    expect(response.json().series.map((entry: { seriesId: string }) => entry.seriesId)).toEqual(["serie-famille"]);
    expect(response.body).not.toContain("Série pour adultes");
  });

  it("un invité de la Famille n'est pas une cible", async () => {
    expect((await topSeries("invite")).statusCode).toBe(404);
  });
});
