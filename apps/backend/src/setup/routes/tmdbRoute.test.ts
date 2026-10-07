/**
 * La clé TMDB dans l'assistant : la route est gardée par le parcours, une clé
 * n'est enregistrée qu'une fois validée par TMDB (refusée ou TMDB muet : rien
 * d'écrit), « Configurer plus tard » se retient — et, à la fin, masque l'avis
 * `tmdbKey` du compte administrateur, sauf si une clé est en place entre-temps.
 * `server_config` en Map mémoire ; la règle du parcours est testée dans shared.
 */

import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  config: new Map<string, string>(),
  linked: true,
  verdict: "valid" as "valid" | "invalid" | "unreachable",
  checked: [] as string[],
  dismissed: [] as Array<[string, string]>,
}));

vi.mock("../setupGuard", () => ({ requireSetupSession: async () => undefined }));
vi.mock("../flow/setupFlow", async () => {
  const { SetupError } = await import("../setupErrors");
  return {
    requireStep: (action: string) => {
      if (action !== "tmdb" || !state.linked) throw new SetupError("step_refused");
    },
  };
});
vi.mock("../../services/configStore", () => ({
  getConfigValue: (key: string) => state.config.get(key),
  setConfigValue: async (key: string, value: string) => void state.config.set(key, value),
  deleteConfigValue: async (key: string) => void state.config.delete(key),
}));
vi.mock("../../services/tmdb/client", () => ({
  getTmdbApiKey: () => process.env.TMDB_API_KEY || state.config.get("tmdb_api_key") || undefined,
}));
vi.mock("../../services/tmdb/keyCheck", () => ({
  checkTmdbKey: async (key: string) => {
    state.checked.push(key);
    return state.verdict;
  },
}));
vi.mock("../../routes/preferences.hints", () => ({
  dismissAccountHint: async (userId: string, hint: string) => void state.dismissed.push([userId, hint]),
}));
vi.mock("../setupContext", async () => {
  const { tmdbSetupState } = await import("../flow/tmdbChoice");
  return { buildSetupContext: () => ({ flow: { tmdb: tmdbSetupState() } }) };
});

import { setupErrorHandler } from "../setupErrors";
import { settleTmdbChoice } from "../flow/tmdbChoice";
import { setupTmdbRoute } from "./tmdbRoute";

const KEY = "0123456789abcdef0123456789abcdef";
const log = { info: () => undefined, warn: () => undefined } as unknown as FastifyBaseLogger;
let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler(setupErrorHandler);
  await app.register(setupTmdbRoute, { prefix: "/api/setup" });
});
afterAll(async () => app.close());
beforeEach(() => {
  state.config.clear();
  state.linked = true;
  state.verdict = "valid";
  state.checked = [];
  state.dismissed = [];
});
afterEach(() => vi.unstubAllEnvs());

const post = (payload: unknown) => app.inject({ method: "POST", url: "/api/setup/tmdb", payload: payload as object });

describe("POST /api/setup/tmdb", () => {
  it("hors du parcours (Jellyfin pas encore relié) : refusé, rien de vérifié ni d'écrit", async () => {
    state.linked = false;
    for (const body of [{ apiKey: KEY }, { later: true }]) {
      const res = await post(body);
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: "step_refused" });
    }
    expect(state.checked).toEqual([]);
    expect(state.config.size).toBe(0);
  });

  it("une clé validée par TMDB est enregistrée — jamais renvoyée, seulement ses quatre derniers caractères", async () => {
    const res = await post({ apiKey: `  ${KEY} ` });
    expect(res.statusCode).toBe(200);
    expect(state.checked).toEqual([KEY]);
    expect(state.config.get("tmdb_api_key")).toBe(KEY);
    expect(res.json()).toEqual({ flow: { tmdb: { configured: true, source: "db", last4: "cdef", later: false } } });
    expect(res.body).not.toContain(KEY);
  });

  it("une clé refusée par TMDB : `tmdb_key_invalid` (400), rien d'écrit", async () => {
    state.verdict = "invalid";
    const res = await post({ apiKey: KEY });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "tmdb_key_invalid" });
    expect(state.config.has("tmdb_api_key")).toBe(false);
  });

  it("TMDB injoignable : `tmdb_unreachable` (502), rien d'écrit", async () => {
    state.verdict = "unreachable";
    const res = await post({ apiKey: KEY });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ error: "tmdb_unreachable" });
    expect(state.config.has("tmdb_api_key")).toBe(false);
  });

  it("un corps vide, les deux à la fois ou autre chose : `invalid_input`", async () => {
    for (const body of [{}, { apiKey: "" }, { apiKey: KEY, later: true }, { later: false }, { apiKey: "x".repeat(129) }]) {
      const res = await post(body);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "invalid_input" });
    }
    expect(state.checked).toEqual([]);
  });

  it("« plus tard » se retient ; une clé posée ensuite l'oublie", async () => {
    expect((await post({ later: true })).json()).toEqual({ flow: { tmdb: { configured: false, source: null, last4: null, later: true } } });
    expect((await post({ apiKey: KEY })).json().flow.tmdb).toMatchObject({ configured: true, later: false });
  });
});

describe("la fin de l'installation (`settleTmdbChoice`)", () => {
  it("« plus tard » et toujours aucune clé : l'avis `tmdbKey` est masqué pour l'administrateur, puis le choix oublié", async () => {
    await post({ later: true });
    await settleTmdbChoice("admin-1", log);
    expect(state.dismissed).toEqual([["admin-1", "tmdbKey"]]);
    expect(state.config.has("setup_tmdb_later")).toBe(false);
  });

  it("une clé saisie et validée : rien à masquer", async () => {
    await post({ apiKey: KEY });
    await settleTmdbChoice("admin-1", log);
    expect(state.dismissed).toEqual([]);
  });

  it("« plus tard », mais une clé fournie par l'environnement : rien à masquer", async () => {
    vi.stubEnv("TMDB_API_KEY", KEY);
    await post({ later: true });
    await settleTmdbChoice("admin-1", log);
    expect(state.dismissed).toEqual([]);
    expect(state.config.has("setup_tmdb_later")).toBe(false);
  });

  it("l'écran jamais vu (serveur repris, assistant d'avant) : rien à masquer", async () => {
    await settleTmdbChoice("admin-1", log);
    expect(state.dismissed).toEqual([]);
  });
});
