/**
 * L'historique de la recherche d'Octave, par compte : ajouter (recherche, titre, historique d'un appareil), relire,
 * effacer une entrée ou tout ; un corps mal formé → 400 ; la capacité absente → aucune route.
 */

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row { userId: string; kind: string; itemKey: string; payloadJson: string; at: Date }

const state = vi.hoisted(() => ({ declared: true, user: "AAAA-1111", rows: [] as Row[] }));

vi.mock("../routes/requestView", () => ({ userOf: () => ({ userId: state.user }) }));
vi.mock("../../serverCapabilities/declaredCapabilities", () => ({
  capabilityGate: () => async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => (state.declared ? undefined : reply.status(404).send({ error: "not_available" })),
}));
vi.mock("../../services/db", () => {
  const table = {
    findMany: async ({ where }: { where: { userId: string } }) =>
      state.rows.filter((r) => r.userId === where.userId).sort((a, b) => b.at.getTime() - a.at.getTime()),
    deleteMany: async ({ where }: { where: { userId: string } }) => {
      state.rows = state.rows.filter((r) => r.userId !== where.userId);
    },
    createMany: async ({ data }: { data: Row[] }) => {
      state.rows.push(...data);
    },
  };
  return { getPrisma: () => ({ musicSearchHistory: table, $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops) }) };
});

import { musicSearchHistoryRoutes } from "./searchHistoryRoutes";

async function call(method: "GET" | "POST", url: string, payload?: object) {
  const app = Fastify();
  await app.register(async (scope) => musicSearchHistoryRoutes(scope), { prefix: "/api/music" });
  const res = await app.inject({ method, url, payload });
  await app.close();
  return res;
}

const track = (key: string) => ({ key, title: `Titre ${key}`, artists: [{ name: "Justice", jellyfinId: null }], artworkUrl: "/api/music/art/1" });

beforeEach(() => {
  state.declared = true;
  state.user = "AAAA-1111";
  state.rows = [];
});

describe("historique de la recherche — routes", () => {
  it("ajoute une recherche et un titre, relus le plus récent en tête, par compte (sans tirets, minuscules)", async () => {
    await call("POST", "/api/music/search-history", { queries: [{ text: "Daft Punk", at: 1 }] });
    await call("POST", "/api/music/search-history", { queries: [{ text: "justice", at: 2 }], tracks: [{ track: track("jf:x"), at: 2 }] });
    const res = await call("GET", "/api/music/search-history");
    expect(res.statusCode).toBe(200);
    expect(res.json().queries.map((q: { text: string }) => q.text)).toEqual(["justice", "Daft Punk"]);
    expect(res.json().tracks[0].track.key).toBe("jf:x");
    expect(new Set(state.rows.map((r) => r.userId))).toEqual(new Set(["aaaa1111"]));
    // Un autre compte ne voit rien.
    state.user = "BBBB";
    expect((await call("GET", "/api/music/search-history")).json()).toEqual({ queries: [], tracks: [] });
  });

  it("la même recherche, autrement écrite, remonte au lieu de se doubler", async () => {
    await call("POST", "/api/music/search-history", { queries: [{ text: "Daft Punk", at: 1 }, { text: "Justice", at: 2 }] });
    const res = await call("POST", "/api/music/search-history", { queries: [{ text: "daft  punk", at: 3 }] });
    expect(res.json().queries.map((q: { text: string }) => q.text)).toEqual(["daft punk", "Justice"]);
    expect(state.rows.filter((r) => r.kind === "query")).toHaveLength(2);
  });

  it("efface une recherche, un titre, puis tout", async () => {
    await call("POST", "/api/music/search-history", { queries: [{ text: "Daft Punk", at: 1 }], tracks: [{ track: track("jf:x"), at: 1 }, { track: track("jf:y"), at: 2 }] });
    expect((await call("POST", "/api/music/search-history/forget", { kind: "query", text: "DAFT PUNK" })).json().queries).toEqual([]);
    expect((await call("POST", "/api/music/search-history/forget", { kind: "track", key: "jf:y" })).json().tracks.map((t: { track: { key: string } }) => t.track.key)).toEqual(["jf:x"]);
    expect((await call("POST", "/api/music/search-history/forget", { kind: "all" })).json()).toEqual({ queries: [], tracks: [] });
    expect(state.rows).toEqual([]);
  });

  it("refuse un corps mal formé", async () => {
    expect((await call("POST", "/api/music/search-history", { queries: "x" })).statusCode).toBe(400);
    expect((await call("POST", "/api/music/search-history/forget", { kind: "track" })).statusCode).toBe(400);
  });

  it("sans la capacité, aucune route", async () => {
    state.declared = false;
    expect((await call("GET", "/api/music/search-history")).statusCode).toBe(404);
  });
});
