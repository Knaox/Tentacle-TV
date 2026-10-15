/**
 * Le guet des greffons de passages : la coupure « Intro Skipper sans écoute »
 * du retrait de l'analyse audio, une fois et une seule, et les réglages remis
 * à plus tard.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeJellyfin } from "../../../test/fakeJellyfinPlugins";

const state = vi.hoisted(() => ({ jf: null as unknown as FakeJellyfin, config: new Map<string, string>() }));

vi.mock("../jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: (path: string, options?: { method?: string; body?: unknown }) => state.jf.admin(path, options),
}));
vi.mock("../configStore", () => ({
  getConfigValue: (key: string) => state.config.get(key),
  setConfigValue: async (key: string, value: string) => void state.config.set(key, value),
  deleteConfigValue: async (key: string) => void state.config.delete(key),
}));
vi.mock("../db", () => ({ hasPrisma: () => true }));

import { CONFIG_PENDING_KEY, INTRO_SKIPPER_MIGRATION_KEY, LEGACY_INTRO_SKIPPER_MIGRATION_KEY } from "./catalog";
import { segmentPluginsTick } from "./segmentPluginsWatch";

const IS = "c83d86bba1e04c35a113e2101cf4ee6b";
const detectTriggers = () => state.jf.tasks.find((t) => t.Key === "IntroSkipperDetectSegmentsTask")?.Triggers;

beforeEach(() => {
  state.jf = new FakeJellyfin();
  state.config.clear();
});

describe("coupure côté Jellyfin", () => {
  it("coupe une fois l'analyse automatique d'une Intro Skipper déjà installée, et le dit", async () => {
    state.jf.preinstall("introSkipper");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await segmentPluginsTick()).toBe(true);
    expect(state.jf.configs.get(IS)?.AutoDetectIntros).toBe(false);
    expect(detectTriggers()).toEqual([]);
    expect(state.config.has(INTRO_SKIPPER_MIGRATION_KEY)).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("coupée, l'analyse audio est retirée"));
    log.mockRestore();
  });

  it("un serveur coupé une première fois puis rallumé : recoupé au retrait, l'ancienne marque effacée", async () => {
    state.config.set(LEGACY_INTRO_SKIPPER_MIGRATION_KEY, "2026-10-06T00:00:00.000Z");
    state.jf.preinstall("introSkipper");
    state.jf.configs.set(IS, { ...state.jf.configs.get(IS), AutoDetectIntros: true });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await segmentPluginsTick()).toBe(true);
    expect(state.jf.configs.get(IS)?.AutoDetectIntros).toBe(false);
    expect(state.config.has(INTRO_SKIPPER_MIGRATION_KEY)).toBe(true);
    expect(state.config.has(LEGACY_INTRO_SKIPPER_MIGRATION_KEY)).toBe(false);
    vi.restoreAllMocks();
  });

  it("déjà coupée : la marque est posée sans rien dire", async () => {
    state.jf.preinstall("introSkipper");
    await segmentPluginsTick();
    state.config.delete(INTRO_SKIPPER_MIGRATION_KEY);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await segmentPluginsTick()).toBe(true);
    expect(state.config.has(INTRO_SKIPPER_MIGRATION_KEY)).toBe(true);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("la marque posée, le guet ne revient plus sur Jellyfin", async () => {
    state.jf.preinstall("introSkipper");
    await segmentPluginsTick();
    state.jf.configs.set(IS, { ...state.jf.configs.get(IS), AutoDetectIntros: true });
    expect(await segmentPluginsTick()).toBe(true);
    expect(state.jf.configs.get(IS)?.AutoDetectIntros).toBe(true);
  });

  it("sans Intro Skipper : rien à couper, la marque est posée", async () => {
    expect(await segmentPluginsTick()).toBe(true);
    expect(state.config.has(INTRO_SKIPPER_MIGRATION_KEY)).toBe(true);
  });

  it("Jellyfin injoignable : rien n'est marqué, on retentera", async () => {
    state.jf.downFor = 99;
    expect(await segmentPluginsTick()).toBe(false);
    expect(state.config.has(INTRO_SKIPPER_MIGRATION_KEY)).toBe(false);
  });

  it("une Intro Skipper posée mais pas chargée attend son chargement", async () => {
    state.jf.preinstall("introSkipper", "Restart");
    expect(await segmentPluginsTick()).toBe(false);
    expect(state.config.has(INTRO_SKIPPER_MIGRATION_KEY)).toBe(false);
  });
});

describe("réglages remis à plus tard", () => {
  it("se posent dès que Jellyfin a chargé les greffons", async () => {
    state.config.set(CONFIG_PENDING_KEY, "2026-10-06");
    state.jf.preinstall("introSkipper", "Restart");
    state.jf.preinstall("theIntroDb", "Restart", { EnableOnDemandFetch: false, EnableIntro: true });
    expect(await segmentPluginsTick()).toBe(false);
    // L'administrateur redémarre Jellyfin à sa main.
    for (const plugin of state.jf.plugins) plugin.Status = "Active";
    expect(await segmentPluginsTick()).toBe(true);
    expect(state.config.has(CONFIG_PENDING_KEY)).toBe(false);
    expect(state.jf.configs.get(IS)?.AutoDetectIntros).toBe(false);
    expect(state.jf.configs.get("c9e41b9563e445e29db6b83df21ae5e7")?.EnableOnDemandFetch).toBe(true);
  });
});
