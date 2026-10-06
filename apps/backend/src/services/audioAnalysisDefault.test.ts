import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const mocks = vi.hoisted(() => ({ prisma: true, failWrite: false }));

vi.mock("./db", () => ({ hasPrisma: () => mocks.prisma }));
vi.mock("./configStore", () => ({
  AUDIO_ANALYSIS_KEY: "audio_analysis_enabled",
  getConfigValue: (key: string) => store.get(key),
  setConfigValue: async (key: string, value: string) => {
    if (mocks.failWrite) throw new Error("base en panne");
    store.set(key, value);
  },
}));

import { applyAudioAnalysisDefault, AUDIO_DEFAULT_MIGRATION_KEY } from "./audioAnalysisDefault";

describe("analyse audio coupée une fois", () => {
  beforeEach(() => {
    store.clear();
    mocks.prisma = true;
    mocks.failWrite = false;
  });

  it("coupe un serveur d'avant où la clé absente valait « oui »", async () => {
    expect(await applyAudioAnalysisDefault()).toBe("applied");
    expect(store.get("audio_analysis_enabled")).toBe("false");
    expect(store.has(AUDIO_DEFAULT_MIGRATION_KEY)).toBe(true);
  });

  it("coupe un serveur où l'administrateur l'avait laissée allumée", async () => {
    store.set("audio_analysis_enabled", "true");
    await applyAudioAnalysisDefault();
    expect(store.get("audio_analysis_enabled")).toBe("false");
  });

  it("respecte ensuite le choix de l'administrateur qui la rallume", async () => {
    await applyAudioAnalysisDefault();
    store.set("audio_analysis_enabled", "true");
    expect(await applyAudioAnalysisDefault()).toBe("already");
    expect(store.get("audio_analysis_enabled")).toBe("true");
  });

  it("sans base, ne fait rien ; base en panne, ne pose pas la marque", async () => {
    mocks.prisma = false;
    expect(await applyAudioAnalysisDefault()).toBe("skipped");
    mocks.prisma = true;
    mocks.failWrite = true;
    expect(await applyAudioAnalysisDefault()).toBe("skipped");
    expect(store.has(AUDIO_DEFAULT_MIGRATION_KEY)).toBe(false);
  });
});
