/**
 * Le parcours lu par le serveur : ce qui est enregistré ne choisit JAMAIS le
 * Jellyfin à la place de l'administrateur. Le cas vécu : une installation
 * finie puis rouverte (`tentacle setup reset`) garde l'adresse et la clé du
 * Jellyfin d'avant — l'assistant sautait alors le choix et proposait des
 * bibliothèques sur un Jellyfin déjà configuré.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ config: new Map<string, string>(), prisma: true }));
vi.mock("../../services/configStore", () => ({
  getConfigValue: (key: string) => state.config.get(key),
  setConfigValue: async (key: string, value: string) => void state.config.set(key, value),
  deleteConfigValue: async (key: string) => void state.config.delete(key),
}));
vi.mock("../../services/db", () => ({ hasPrisma: () => state.prisma }));
vi.mock("../../services/jellyfinWs", () => ({ restartJellyfinWs: () => undefined }));

import { SETUP_KEYS } from "../setupStore";
import { flowState, readSelection, requireStep } from "./setupFlow";

const PILE = "http://jellyfin:8096";
const selection = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ url: PILE, serverId: "pile", serverName: "Tentacle", version: "12.1.0", inStack: true, path: "configured", ...over });

beforeEach(() => {
  state.config.clear();
  state.prisma = true;
});

describe("le parcours tenu par le serveur", () => {
  it("un Jellyfin resté enregistré d'une installation rouverte : rien n'est choisi, l'étape « Jellyfin » d'abord", () => {
    state.config.set("jellyfin_url", PILE);
    state.config.set("jellyfin_api_key", "cle");
    expect(flowState()).toEqual({ databasePending: false, selection: null, linked: false, noLibraries: false, tmdb: { configured: false, source: null, last4: null, later: false } });
    expect(() => requireStep("createLibraries")).toThrow("step_refused");
    expect(() => requireStep("initialize")).toThrow("step_refused");
    expect(() => requireStep("complete")).toThrow("step_refused");
    expect(requireStep("select").selection).toBeNull();
  });

  it("relié seulement au Jellyfin CHOISI ; celui de la pile, seulement une fois son compte provisoire adopté", () => {
    state.config.set(SETUP_KEYS.selection, selection({ path: "fresh" }));
    expect(flowState().linked).toBe(false);
    state.config.set("jellyfin_url", "http://192.168.1.20:8096");
    state.config.set("jellyfin_api_key", "cle");
    expect(flowState().linked).toBe(false);
    state.config.set("jellyfin_url", PILE);
    state.config.set("jellyfin_claim_user_id", "prov");
    expect(flowState().linked).toBe(false);
    state.config.delete("jellyfin_claim_user_id");
    expect(flowState().linked).toBe(true);
  });

  it("un Jellyfin déjà configuré relié : jamais de compte ni de bibliothèque créés", () => {
    state.config.set(SETUP_KEYS.selection, selection());
    state.config.set("jellyfin_url", PILE);
    state.config.set("jellyfin_api_key", "cle");
    for (const action of ["initialize", "createLibraries", "browse"] as const) expect(() => requireStep(action)).toThrow("step_refused");
    for (const action of ["connect", "verify", "readLibraries", "advice", "segments", "complete"] as const) expect(() => requireStep(action)).not.toThrow();
  });

  it("sans base : rien ne s'enregistre, le refus le dit", () => {
    state.prisma = false;
    expect(flowState()).toEqual({ databasePending: true, selection: null, linked: false, noLibraries: false, tmdb: { configured: false, source: null, last4: null, later: false } });
    expect(() => requireStep("select")).toThrow("db_unreachable");
  });

  it("un choix illisible (base trafiquée, version d'avant) ne vaut rien", () => {
    for (const raw of ["{", JSON.stringify({ url: PILE }), selection({ path: "admin" }), selection({ inStack: "oui" })]) {
      state.config.set(SETUP_KEYS.selection, raw);
      expect(readSelection()).toBeNull();
    }
  });
});
