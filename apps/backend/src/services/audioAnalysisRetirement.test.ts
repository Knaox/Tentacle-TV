import { mkdir, mkdtemp, readdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const mocks = vi.hoisted(() => ({ prisma: true, failWrite: false }));

vi.mock("./db", () => ({ hasPrisma: () => mocks.prisma }));
vi.mock("./configStore", () => ({
  getConfigValue: (key: string) => store.get(key),
  deleteConfigValue: async (key: string) => {
    if (mocks.failWrite) throw new Error("base en panne");
    store.delete(key);
  },
}));

import { RETIRED_AUDIO_DEFAULT_KEY, RETIRED_AUDIO_SWITCH_KEY, retireAudioAnalysis } from "./audioAnalysisRetirement";

describe("retrait de l'analyse audio, une fois au démarrage", () => {
  let base: string;

  beforeEach(async () => {
    store.clear();
    mocks.prisma = true;
    mocks.failWrite = false;
    base = await mkdtemp(join(tmpdir(), "retrait-audio-"));
  });

  afterEach(async () => {
    await rm(base, { recursive: true, force: true });
  });

  it("un serveur qui l'avait allumée : clés effacées, journal clair, extraits balayés", async () => {
    store.set(RETIRED_AUDIO_SWITCH_KEY, "true");
    store.set(RETIRED_AUDIO_DEFAULT_KEY, "2026-10-06T00:00:00.000Z");
    await mkdir(join(base, "tentacle-audio-abc"));
    await mkdir(join(base, "autre-chose"));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await retireAudioAnalysis(base)).toBe("retired");
    expect(store.size).toBe(0);
    expect(await readdir(base)).toEqual(["autre-chose"]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("elle était allumée"));
    log.mockRestore();
  });

  it("coupée par défaut : la marque part aussi, sans rien dire", async () => {
    store.set(RETIRED_AUDIO_SWITCH_KEY, "false");
    store.set(RETIRED_AUDIO_DEFAULT_KEY, "2026-10-06T00:00:00.000Z");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await retireAudioAnalysis(base)).toBe("retired");
    expect(store.size).toBe(0);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("un serveur neuf, ou déjà nettoyé : rien", async () => {
    expect(await retireAudioAnalysis(base)).toBe("nothing");
  });

  it("sans base, ne fait rien ; base en panne, réessaie au démarrage suivant", async () => {
    store.set(RETIRED_AUDIO_SWITCH_KEY, "true");
    mocks.prisma = false;
    expect(await retireAudioAnalysis(base)).toBe("skipped");
    mocks.prisma = true;
    mocks.failWrite = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await retireAudioAnalysis(base)).toBe("skipped");
    expect(store.get(RETIRED_AUDIO_SWITCH_KEY)).toBe("true");
    warn.mockRestore();
  });
});
