/**
 * « Installer / réparer la détection des passages » : lancer exige une
 * session personnelle (le passage redémarre Jellyfin), le corps est fermé,
 * et la route n'attend pas le passage.
 */

import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ started: [] as unknown[], personal: true }));

vi.mock("../middleware/auth", () => ({
  requirePersonalAdmin: async (_request: unknown, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) => {
    if (!state.personal) return reply.status(403).send({ error: "personal_session_required" });
  },
}));
vi.mock("../services/segmentPlugins/segmentSetupJob", () => ({
  startSegmentSetup: (request: unknown) => {
    state.started.push(request);
    return new Promise(() => undefined);
  },
  segmentSetupStatus: () => ({ phase: "repositories", running: true }),
}));

import { adminSegmentPluginsRoutes } from "./adminSegmentPlugins";

async function app() {
  const server = Fastify();
  await server.register(adminSegmentPluginsRoutes);
  return server;
}

afterEach(() => {
  state.started = [];
  state.personal = true;
});

describe("routes de la détection des passages (admin)", () => {
  it("lance le passage sans l'attendre, et rend son état", async () => {
    const res = await (await app()).inject({ method: "POST", url: "/jellyfin/segment-plugins", payload: { restartWhilePlaying: true } });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ phase: "repositories", running: true });
    expect(state.started).toEqual([{ restartWhilePlaying: true }]);
  });

  it("un corps hors contrat est refusé sans rien lancer", async () => {
    const res = await (await app()).inject({ method: "POST", url: "/jellyfin/segment-plugins", payload: { restart: "now" } });
    expect(res.statusCode).toBe(400);
    expect(state.started).toEqual([]);
  });

  it("une TV jumelée par un administrateur ne lance rien", async () => {
    state.personal = false;
    const res = await (await app()).inject({ method: "POST", url: "/jellyfin/segment-plugins", payload: {} });
    expect(res.statusCode).toBe(403);
    expect(state.started).toEqual([]);
  });
});
