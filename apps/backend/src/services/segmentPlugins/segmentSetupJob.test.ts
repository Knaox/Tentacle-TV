/**
 * Le passage d'installation de la détection des passages, contre un Jellyfin
 * en mémoire : les trois greffons posés, le redémarrage attendu, l'écoute
 * d'Intro Skipper coupée, et rien de bloquant quand un dépôt se tait.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeJellyfin } from "../../../test/fakeJellyfinPlugins";

const state = vi.hoisted(() => ({ jf: null as unknown as FakeJellyfin, config: new Map<string, string>() }));

vi.mock("../jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: (path: string, options?: { method?: string; body?: unknown }) => state.jf.admin(path, options),
}));
vi.mock("../configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getConfigValue: (key: string) => state.config.get(key),
  setConfigValue: async (key: string, value: string) => void state.config.set(key, value),
  deleteConfigValue: async (key: string) => void state.config.delete(key),
}));
vi.mock("../db", () => ({ hasPrisma: () => true }));

import { resetSegmentSetupForTests, startSegmentSetup } from "./segmentSetupJob";
import { CONFIG_PENDING_KEY, INTRO_SKIPPER_MIGRATION_KEY } from "./catalog";

const clock = { now: (() => { let t = 0; return () => (t += 500); })(), sleep: async () => undefined };
const IS = "c83d86bba1e04c35a113e2101cf4ee6b";
const outcomes = (run: Awaited<ReturnType<typeof startSegmentSetup>>) => Object.fromEntries(run.plugins.map((p) => [p.key, p.outcome]));

beforeEach(() => {
  state.jf = new FakeJellyfin();
  state.config.clear();
  resetSegmentSetupForTests();
  vi.stubGlobal("fetch", (url: string) => state.jf.fetch(url));
});
afterEach(() => vi.unstubAllGlobals());

describe("passage d'installation des greffons de passages", () => {
  it("Jellyfin neuf : dépôts ajoutés, trois greffons posés, redémarrage, écoute coupée", async () => {
    const run = await startSegmentSetup({}, clock);
    expect(outcomes(run)).toEqual({ introSkipper: "installed", theIntroDb: "installed", skipMeDb: "installed" });
    expect(run.restart).toBe("done");
    expect(run.configured).toBe(true);
    expect(run.error).toBeNull();
    // Les dépôts de l'administrateur restent, les nôtres s'ajoutent (un seul pour Intro Skipper et SkipMe.db).
    expect(state.jf.repositories.map((r) => r.Url)).toEqual([
      "https://repo.jellyfin.org/files/plugin/manifest.json",
      "https://intro-skipper.org/manifest.json",
      "https://raw.githubusercontent.com/TheIntroDB/jellyfin-plugin/main/manifest.json",
    ]);
    expect(state.jf.restarts).toBe(1);
    expect(state.jf.configs.get(IS)?.AutoDetectIntros).toBe(false);
    expect(state.jf.tasks.find((t) => t.Key === "IntroSkipperDetectSegmentsTask")?.Triggers).toEqual([]);
    // La synchronisation de SkipMe.db garde son horaire.
    expect(state.jf.tasks.find((t) => t.Key === "SkipMeDaily")?.Triggers).toHaveLength(1);
    expect(state.config.has(INTRO_SKIPPER_MIGRATION_KEY)).toBe(true);
    expect(state.config.has(CONFIG_PENDING_KEY)).toBe(false);
  });

  it("tout déjà en place : rien d'installé, aucun redémarrage", async () => {
    for (const key of ["introSkipper", "theIntroDb", "skipMeDb"]) state.jf.preinstall(key);
    const run = await startSegmentSetup({}, clock);
    expect(outcomes(run)).toEqual({ introSkipper: "present", theIntroDb: "present", skipMeDb: "present" });
    expect(run.restart).toBe("not-needed");
    expect(state.jf.restarts).toBe(0);
    expect(state.jf.calls.some((c) => c.startsWith("POST /Packages/Installed"))).toBe(false);
  });

  it("un dépôt muet ne bloque rien : les autres s'installent, le greffon est dit injoignable", async () => {
    state.jf.offline.add("https://raw.githubusercontent.com/TheIntroDB/jellyfin-plugin/main/manifest.json");
    const run = await startSegmentSetup({}, clock);
    expect(outcomes(run)).toEqual({ introSkipper: "installed", theIntroDb: "repo-offline", skipMeDb: "installed" });
    expect(run.restart).toBe("done");
    expect(run.configured).toBe(true);
  });

  it("aucune version pour ce Jellyfin : « indisponible », pas « hors ligne »", async () => {
    state.jf.seeds.skipMeDb.versions = [];
    const run = await startSegmentSetup({}, clock);
    expect(outcomes(run).skipMeDb).toBe("unavailable");
  });

  it("TheIntroDB exige 10.11.6 : un 10.11.4 ne le reçoit pas", async () => {
    state.jf.version = "10.11.4";
    const run = await startSegmentSetup({}, clock);
    expect(outcomes(run).theIntroDb).toBe("too-old");
  });

  it("un greffon coupé dans Jellyfin est rallumé", async () => {
    state.jf.preinstall("introSkipper", "Disabled");
    const run = await startSegmentSetup({}, clock);
    expect(outcomes(run).introSkipper).toBe("enabled");
    expect(state.jf.restarts).toBe(1);
  });

  it("quelqu'un regarde : pas de redémarrage, réglages en attente pour le guet", async () => {
    state.jf.playing = true;
    const run = await startSegmentSetup({}, clock);
    expect(run.restart).toBe("deferred-playing");
    expect(state.jf.restarts).toBe(0);
    expect(run.configured).toBeNull();
    expect(state.config.has(CONFIG_PENDING_KEY)).toBe(true);
  });

  it("l'administrateur peut redémarrer quand même", async () => {
    state.jf.playing = true;
    const run = await startSegmentSetup({ restartWhilePlaying: true }, clock);
    expect(run.restart).toBe("done");
  });

  it("Jellyfin injoignable : une erreur, aucun geste", async () => {
    state.jf.downFor = 99;
    const run = await startSegmentSetup({}, clock);
    expect(run.error).toBe("unreachable");
    expect(run.phase).toBe("done");
  });

  it("un passage à la fois : un second appel rend le même", async () => {
    const first = startSegmentSetup({}, clock);
    expect(startSegmentSetup({}, clock)).toBe(first);
    await first;
  });
});
