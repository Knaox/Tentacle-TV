/**
 * Les routes des liens du serveur : un brouillon mal formé est refusé avant
 * toute sonde, et l'origine de la page passe jusqu'au rapport.
 */

import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ calls: [] as Array<{ kind: string; draft?: unknown; origin: string | null }> }));

vi.mock("../services/serverLinks/serverLinksReport", () => ({
  buildServerLinksReport: async (origin: string | null) => {
    state.calls.push({ kind: "saved", origin });
    return { checkedAt: "t" };
  },
  checkServerLinksDraft: async (draft: unknown, origin: string | null) => {
    state.calls.push({ kind: "draft", draft, origin });
    return { checkedAt: "t" };
  },
}));

import { adminServerLinksRoutes } from "./adminServerLinks";

async function app() {
  const server = Fastify();
  await server.register(adminServerLinksRoutes);
  return server;
}

afterEach(() => {
  state.calls = [];
});

describe("routes des liens du serveur", () => {
  it("GET : les liens enregistrés, avec l'origine de la page", async () => {
    const res = await (await app()).inject({ method: "GET", url: "/server-links", headers: { origin: "https://tv.example.com" } });
    expect(res.statusCode).toBe(200);
    expect(state.calls).toEqual([{ kind: "saved", origin: "https://tv.example.com" }]);
  });

  it("POST : un brouillon d'adresses http(s) ou vides est sondé", async () => {
    const draft = { publicUrl: "https://tv.example.com", jellyfinPublicUrl: "", jellyfinPrivateUrl: "http://192.168.1.50:8096" };
    const res = await (await app()).inject({ method: "POST", url: "/server-links/check", payload: draft });
    expect(res.statusCode).toBe(200);
    expect(state.calls).toEqual([{ kind: "draft", draft, origin: null }]);
  });

  it.each([
    { publicUrl: "file:///etc/passwd", jellyfinPublicUrl: "", jellyfinPrivateUrl: "" },
    { publicUrl: "pas une adresse", jellyfinPublicUrl: "", jellyfinPrivateUrl: "" },
    { publicUrl: "" },
  ])("POST : un brouillon mal formé est refusé sans sonde (%o)", async (payload) => {
    const res = await (await app()).inject({ method: "POST", url: "/server-links/check", payload });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid-body" });
    expect(state.calls).toEqual([]);
  });
});
