/**
 * `POST /api/music/playlists/:id/source-order` : la capacité, « voir en tant que » refusé, l'entrée fermée, les
 * refus dits par leur code.
 */

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ session: "personal", declared: true, calls: [] as unknown[][], outcome: { ok: true, value: { applied: true } } as unknown }));

vi.mock("../routes/requestView", () => ({
  userOf: () => ({ userId: "u1", username: "banc", isAdmin: false, session: state.session }),
  viewOf: async () => ({ userId: "u1", access: { mode: "all" } }),
}));
vi.mock("../../serverCapabilities/declaredCapabilities", () => ({
  capabilityGate: () => async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => (state.declared ? undefined : reply.status(404).send({ error: "not_available" })),
}));
vi.mock("./sourceRepair", () => ({
  repairSourceOrder: async (...args: unknown[]) => {
    state.calls.push(args);
    return state.outcome;
  },
}));

import { musicSourceOrderRoutes } from "./sourceRoutes";

const ID = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

async function post(payload: unknown, id = ID) {
  const app = Fastify();
  musicSourceOrderRoutes(app, { fetcher: async () => ({ status: 500, url: "", body: "" }) } as never);
  const res = await app.inject({ method: "POST", url: `/playlists/${id}/source-order`, payload: payload as never });
  await app.close();
  return res;
}

beforeEach(() => Object.assign(state, { session: "personal", declared: true, calls: [], outcome: { ok: true, value: { applied: true } } }));

describe("POST /playlists/:id/source-order", () => {
  it("sans la capacité : la route n'existe pas ; « voir en tant que » : refusé", async () => {
    state.declared = false;
    expect((await post({})).statusCode).toBe(404);
    state.declared = true;
    state.session = "impersonation";
    expect((await post({})).statusCode).toBe(403);
    expect(state.calls).toEqual([]);
  });

  it("l'entrée fermée : un identifiant, une adresse OU une playlist lue, `dryRun` booléen", async () => {
    expect((await post({}, "pas-un-identifiant")).statusCode).toBe(400);
    expect((await post({ url: 3 })).statusCode).toBe(400);
    expect((await post({ url: "https://music.apple.com/x", playlist: {} })).statusCode).toBe(400);
    expect((await post({ playlist: { source: "nope", tracks: [] } })).statusCode).toBe(400);
    expect(state.calls).toEqual([]);
    expect((await post({ url: "https://music.apple.com/fr/playlist/new/pl.u-new0000000000000", dryRun: true })).statusCode).toBe(200);
    expect(state.calls[0]?.slice(0, 4)).toEqual(["u1", ID, { kind: "url", url: "https://music.apple.com/fr/playlist/new/pl.u-new0000000000000" }, true]);
    expect((await post({})).statusCode).toBe(200);
    expect(state.calls[1]?.slice(2, 4)).toEqual([{ kind: "kept" }, false]);
  });

  it("un refus dit par son code", async () => {
    state.outcome = { ok: false, failure: "source_unknown" };
    const res = await post({});
    expect([res.statusCode, res.json()]).toEqual([409, { error: "source_unknown" }]);
  });
});
