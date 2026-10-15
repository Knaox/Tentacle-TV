/**
 * Les routes de la suppression de titres : session personnelle seule (jamais une
 * TV, un profil, « voir en tant que »), corps validé avant tout appel, un résultat
 * par titre, caches du serveur vidés de ce qui est parti, journal sans titre.
 */

import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: "personal" as string,
  deleted: [] as string[][],
  dropped: [] as string[][],
  outcomes: new Map<string, string>(),
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { user?: unknown }) => {
    request.user = { userId: "u".repeat(32), username: "Alice", isAdmin: false, session: state.session };
  },
  getTokenFromRequest: () => "jeton-alice",
}));
vi.mock("../services/libraryDelete/libraryDeletion", () => ({
  readDeletionRights: async (token: string) => ({ everywhere: token === "jeton-alice", libraryIds: [] }),
  deleteLibraryItems: async (token: string, ids: string[]) => {
    state.deleted.push([token, ...ids]);
    return ids.map((id) => ({ id, outcome: state.outcomes.get(id) ?? "deleted" }));
  },
  tallyOutcomes: (results: { outcome: string }[]) => {
    const tally: Record<string, number> = { deleted: 0, gone: 0, forbidden: 0, failed: 0 };
    for (const r of results) tally[r.outcome]++;
    return tally;
  },
}));
vi.mock("../services/libraryDelete/afterDeletion", () => ({
  afterLibraryDeletion: (ids: string[]) => { state.dropped.push(ids); },
}));

import { libraryDeletionRoutes } from "./libraryDeletion";

const A = "a".repeat(32);
const B = "b".repeat(32);
const C = "c".repeat(32);

async function app() {
  const server = Fastify();
  await server.register(libraryDeletionRoutes, { prefix: "/api/library" });
  return server;
}

afterEach(() => {
  state.session = "personal";
  state.deleted = [];
  state.dropped = [];
  state.outcomes.clear();
  vi.restoreAllMocks();
});

describe("GET /api/library/deletion/rights", () => {
  it("lit les droits par le jeton du compte en session personnelle", async () => {
    const res = await (await app()).inject({ method: "GET", url: "/api/library/deletion/rights" });
    expect(res.json()).toEqual({ everywhere: true, libraryIds: [] });
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it.each(["tvLegacy", "tvProfile", "impersonation"])("rend « nulle part » à une session %s", async (session) => {
    state.session = session;
    const res = await (await app()).inject({ method: "GET", url: "/api/library/deletion/rights" });
    expect([res.statusCode, res.json()]).toEqual([200, { everywhere: false, libraryIds: [] }]);
  });
});

describe("POST /api/library/deletion", () => {
  it.each(["tvLegacy", "tvProfile", "impersonation"])("refuse une session %s sans rien tenter", async (session) => {
    state.session = session;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const res = await (await app()).inject({ method: "POST", url: "/api/library/deletion", payload: { ids: [A] } });
    expect([res.statusCode, res.json()]).toEqual([403, { error: "not_personal" }]);
    expect(state.deleted).toEqual([]);
  });

  it("refuse un corps invalide sans rien tenter", async () => {
    const post = async (payload: unknown) =>
      (await app()).inject({ method: "POST", url: "/api/library/deletion", payload: payload as object });
    for (const payload of [{ ids: [] }, { ids: ["../Users"] }, { ids: [A], force: true }, { ids: Array.from({ length: 21 }, (_, i) => i.toString(16).padStart(32, "0")) }]) {
      const res = await post(payload);
      expect([res.statusCode, res.json()]).toEqual([400, { error: "invalid_input" }]);
    }
    expect(state.deleted).toEqual([]);
  });

  it("rend un sort par titre, vide les caches de ce qui est parti, journalise des nombres", async () => {
    state.outcomes.set(B, "forbidden").set(C, "gone");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await (await app()).inject({
      method: "POST",
      url: "/api/library/deletion",
      payload: { ids: [A, B.toUpperCase(), `${C.slice(0, 8)}-${C.slice(8, 12)}-${C.slice(12, 16)}-${C.slice(16, 20)}-${C.slice(20)}`, A] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ results: [{ id: A, outcome: "deleted" }, { id: B, outcome: "forbidden" }, { id: C, outcome: "gone" }] });
    expect(state.deleted).toEqual([["jeton-alice", A, B, C]]);
    expect(state.dropped).toEqual([[A, C]]);
    const line = info.mock.calls.map((call) => String(call[0])).find((entry) => entry.startsWith("[library-delete]"));
    expect(line).toBe("[library-delete] Alice (uuuuuuuu…) : 3 demandés — 1 supprimés, 1 déjà absents, 1 refusés par Jellyfin, 0 en échec");
  });
});
