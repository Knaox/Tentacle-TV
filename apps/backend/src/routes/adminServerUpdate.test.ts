/**
 * Les routes de la mise à jour du serveur : la lecture ordinaire laisse le
 * cache décider, « Revérifier » force la relecture.
 */

import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as boolean[]);

vi.mock("../services/serverUpdate/serverUpdateReport", () => ({
  buildServerUpdateReport: async (force: boolean) => {
    calls.push(force);
    return { current: "1.22.3", latest: null };
  },
}));

import { adminServerUpdateRoutes } from "./adminServerUpdate";

async function app() {
  const server = Fastify();
  await server.register(adminServerUpdateRoutes);
  return server;
}

afterEach(() => {
  calls.length = 0;
});

describe("routes de la mise à jour du serveur", () => {
  it("GET : le rapport, sans forcer la relecture", async () => {
    const res = await (await app()).inject({ method: "GET", url: "/server-update" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ current: "1.22.3", latest: null });
    expect(calls).toEqual([false]);
  });

  it("POST refresh : la relecture forcée", async () => {
    const res = await (await app()).inject({ method: "POST", url: "/server-update/refresh" });
    expect(res.statusCode).toBe(200);
    expect(calls).toEqual([true]);
  });
});
