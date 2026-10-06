/**
 * Les réglages conseillés dans l'assistant : seuls les gestes cochés partent,
 * ceux de l'administration (testés à part, `setupActions.test.ts`), un échec
 * n'arrête pas les suivants, et rien ne part sans Jellyfin relié.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ stored: true as boolean, applied: [] as unknown[], failing: new Set<string>() }));

vi.mock("../setupGuard", () => ({ requireSetupSession: async () => undefined }));
vi.mock("../setupStore", () => ({ storedJellyfin: () => (state.stored ? { url: "http://jf", apiKey: "cle" } : null) }));
vi.mock("../../services/jellyfinSetup/setupService", () => ({
  buildSetupReport: async () => ({ checkedAt: "now", jellyfinVersion: "10.11.11", dashboardUrl: null, restartPending: false, error: null, checks: [] }),
}));
vi.mock("../../services/jellyfinSetup/setupActions", () => ({
  applySetupAction: async (request: { action: string }) => {
    state.applied.push(request);
    return state.failing.has(request.action) ? { ok: false, error: "unreachable" } : { ok: true, changed: 1 };
  },
}));

import { setupErrorHandler } from "../setupErrors";
import { setupAdviceRoute } from "./adviceRoute";

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler(setupErrorHandler);
  await app.register(setupAdviceRoute, { prefix: "/api/setup" });
});

afterAll(async () => app.close());

beforeEach(() => {
  state.stored = true;
  state.applied = [];
  state.failing.clear();
});

const post = (payload: Record<string, unknown>) => app.inject({ method: "POST", url: "/api/setup/jellyfin/recommended", payload });

describe("les réglages conseillés, appliqués par l'assistant", () => {
  it("l'état : le même rapport que l'administration", async () => {
    const res = await app.inject({ method: "GET", url: "/api/setup/jellyfin/recommended" });
    expect(res.json()).toMatchObject({ jellyfinVersion: "10.11.11", checks: [] });
  });

  it("seulement ce qui est coché, une fois chacun, avec la langue choisie", async () => {
    const res = await post({ actions: ["enableTrickplay", "setMetadataLanguage", "enableTrickplay"], language: "fr", country: "FR" });
    expect(res.json()).toEqual([
      { action: "enableTrickplay", status: "applied" },
      { action: "setMetadataLanguage", status: "applied" },
    ]);
    expect(state.applied).toEqual([
      { action: "enableTrickplay", language: "fr", country: "FR" },
      { action: "setMetadataLanguage", language: "fr", country: "FR" },
    ]);
  });

  it("rien de coché (« Passer ») : rien ne part", async () => {
    expect((await post({ actions: [] })).json()).toEqual([]);
    expect(state.applied).toEqual([]);
  });

  it("un échec est dit, et les suivants partent quand même", async () => {
    state.failing.add("enableHevcEncoding");
    expect((await post({ actions: ["enableHevcEncoding", "enableRealtimeMonitor"] })).json()).toEqual([
      { action: "enableHevcEncoding", status: "failed", error: "unreachable" },
      { action: "enableRealtimeMonitor", status: "applied" },
    ]);
  });

  it("un geste hors de la liste fermée (même de l'administration) est refusé, rien ne part", async () => {
    for (const action of ["refreshMissingMetadata", "generateTrickplay", "installChapterSegments"]) {
      expect((await post({ actions: [action] })).json()).toEqual({ error: "invalid_input" });
    }
    expect((await post({ actions: [], extra: 1 })).json()).toEqual({ error: "invalid_input" });
    expect(state.applied).toEqual([]);
  });

  it("sans Jellyfin relié : rien", async () => {
    state.stored = false;
    expect((await post({ actions: ["enableTrickplay"] })).json()).toEqual({ error: "jf_not_configured" });
    expect(state.applied).toEqual([]);
  });
});
