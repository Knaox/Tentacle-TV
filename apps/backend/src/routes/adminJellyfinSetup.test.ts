/**
 * Les routes des réglages recommandés : un corps hors liste est refusé avant
 * tout appel à Jellyfin, et chaque refus porte un code que la page traduit.
 */

import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  outcome: { ok: true, changed: 1 } as { ok: true; changed: number } | { ok: false; error: string },
  applied: [] as unknown[],
}));

vi.mock("../services/jellyfinSetup/setupActions", () => ({
  applySetupAction: async (request: unknown) => {
    state.applied.push(request);
    return state.outcome;
  },
}));
vi.mock("../services/jellyfinSetup/setupService", () => ({
  buildSetupReport: async () => ({ checkedAt: "t", jellyfinVersion: "12.1.0", dashboardUrl: null, restartPending: false, error: null, checks: [] }),
}));

import { adminJellyfinSetupRoutes } from "./adminJellyfinSetup";

async function app() {
  const server = Fastify();
  await server.register(adminJellyfinSetupRoutes);
  return server;
}

afterEach(() => {
  state.outcome = { ok: true, changed: 1 };
  state.applied = [];
});

describe("routes des réglages recommandés", () => {
  it("un geste de la liste : appliqué, puis l'état relu", async () => {
    const res = await (await app()).inject({ method: "POST", url: "/jellyfin/setup/apply", payload: { action: "enableTrickplay" } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ changed: 1, report: { jellyfinVersion: "12.1.0" } });
  });

  it("un geste hors liste est refusé sans rien appeler", async () => {
    const res = await (await app()).inject({ method: "POST", url: "/jellyfin/setup/apply", payload: { action: "restartServer" } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "bad-request" });
    expect(state.applied).toEqual([]);
  });

  it("chaque refus garde son code", async () => {
    for (const [error, status] of [["busy", 409], ["not-configured", 409], ["unreachable", 502], ["not-applied", 502], ["bad-request", 400]] as const) {
      state.outcome = { ok: false, error };
      const res = await (await app()).inject({ method: "POST", url: "/jellyfin/setup/apply", payload: { action: "enableTrickplay" } });
      expect([res.statusCode, res.json()]).toEqual([status, { error }]);
    }
  });
});
