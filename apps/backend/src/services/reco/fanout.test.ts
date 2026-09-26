/**
 * L'état public du fan-out, celui que lit Admin → Métadonnées : pendant la
 * passe, un compteur ; après, un bilan — comptes traités, échecs, heure de fin.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  getPrisma: () => ({
    recoSettings: { findMany: async () => [] },
    tasteProfile: {
      // « fresh » a un profil du jour, « broken » n'en a pas encore.
      findMany: async () => [{ jellyfinUserId: "fresh", computedAt: new Date(), schemaVersion: 3 }],
    },
  }),
}));
vi.mock("../tmdb/client", () => ({ tmdbConfigured: () => true }));
vi.mock("../watchTogether/usersCache", () => ({
  getJellyfinUsers: async () => [
    { id: "fresh", isDisabled: false },
    { id: "broken", isDisabled: false },
    { id: "off", isDisabled: true },
  ],
}));
vi.mock("./generationJob", () => ({ generatePool: async () => undefined }));
vi.mock("./poolStore", () => ({
  readPool: async (userId: string) =>
    userId === "fresh" ? { preliminary: false, generatedAt: new Date().toISOString() } : null,
  isPoolStale: () => false,
}));
vi.mock("./profileBuilder", () => ({
  PROFILE_SCHEMA_VERSION: 3,
  rebuildProfile: async () => {
    throw new Error("TMDB en panne");
  },
}));

import { cancelRecoFanout, fanoutStatus, kickRecoFanout } from "./fanout";

afterEach(() => {
  cancelRecoFanout();
  vi.restoreAllMocks();
});

describe("fanoutStatus", () => {
  it("n'a rien à dire avant la première passe", () => {
    expect(fanoutStatus()).toEqual({ running: false, processed: 0, total: 0, failed: 0, finishedAt: null });
  });

  it("dresse le bilan de la passe terminée : traités, échecs, heure de fin", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const before = Date.now();
    kickRecoFanout({ force: false, reason: "boot" });
    expect(fanoutStatus()).toMatchObject({ running: true, failed: 0, finishedAt: null });

    await vi.waitFor(() => expect(fanoutStatus().running).toBe(false));
    const status = fanoutStatus();
    // Le compte désactivé ne compte pas ; le frais est sauté, l'autre échoue.
    expect(status).toMatchObject({ running: false, processed: 2, total: 2, failed: 1 });
    expect(Date.parse(status.finishedAt ?? "")).toBeGreaterThanOrEqual(before);
  });
});
