/**
 * La route de « Réanalyser maintenant » : session personnelle exigée, corps
 * fermé, et chaque issue de l'analyse traduite en un statut et un code.
 */

import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  personal: true,
  requests: [] as Array<string | undefined>,
  outcome: { ok: true, scope: "item" } as { ok: true; scope: string } | { ok: false; error: string },
}));

vi.mock("../middleware/auth", () => ({
  requirePersonalAdmin: async (_request: unknown, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) => {
    if (!state.personal) return reply.status(403).send({ message: "Forbidden" });
  },
}));
vi.mock("../library/libraryRescan", () => ({
  startLibraryRescan: async (itemId: string | undefined) => {
    state.requests.push(itemId);
    return state.outcome;
  },
}));

import { adminLibraryRescanRoutes } from "./adminLibraryRescan";

async function app() {
  const server = Fastify();
  await server.register(adminLibraryRescanRoutes);
  return server;
}

const ITEM = "56d6234ebd87b4a9292be9147a536e1b";

afterEach(() => {
  state.personal = true;
  state.requests = [];
  state.outcome = { ok: true, scope: "item" };
});

describe("POST /library/rescan (admin)", () => {
  it("lance l'analyse d'un titre et le dit (202)", async () => {
    const res = await (await app()).inject({ method: "POST", url: "/library/rescan", payload: { itemId: ITEM } });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ ok: true, scope: "item" });
    expect(state.requests).toEqual([ITEM]);
  });

  it("sans corps : toutes les bibliothèques", async () => {
    state.outcome = { ok: true, scope: "libraries" };
    const res = await (await app()).inject({ method: "POST", url: "/library/rescan" });
    expect(res.statusCode).toBe(202);
    expect(state.requests).toEqual([undefined]);
  });

  it("un corps hors contrat est refusé sans rien lancer", async () => {
    const res = await (await app()).inject({ method: "POST", url: "/library/rescan", payload: { itemId: ITEM, mode: "ReplaceAll" } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "bad-request" });
    expect(state.requests).toEqual([]);
  });

  it("une TV jumelée par un administrateur ne lance rien", async () => {
    state.personal = false;
    const res = await (await app()).inject({ method: "POST", url: "/library/rescan", payload: { itemId: ITEM } });
    expect(res.statusCode).toBe(403);
    expect(state.requests).toEqual([]);
  });

  it("chaque refus garde son code, avec un statut qui dit de quel côté est la faute", async () => {
    const cases: Array<[string, number]> = [["not-found", 404], ["busy", 409], ["not-configured", 503], ["unreachable", 502], ["rejected", 502]];
    for (const [error, status] of cases) {
      state.outcome = { ok: false, error };
      const res = await (await app()).inject({ method: "POST", url: "/library/rescan", payload: { itemId: ITEM } });
      expect(res.statusCode).toBe(status);
      expect(res.json()).toEqual({ error });
    }
  });
});
