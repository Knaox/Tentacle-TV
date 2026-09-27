/**
 * Le rangement : seules les lectures qui ont trouvé quelque chose s'écrivent,
 * et le démarrage purge les lignes « rien » et les versions périmées.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  hasPrisma: vi.fn(),
}));

vi.mock("../db", () => ({
  hasPrisma: () => mocks.hasPrisma(),
  getPrisma: () => ({
    mediaFrameAnalysis: { findUnique: mocks.findUnique, upsert: mocks.upsert, deleteMany: mocks.deleteMany },
  }),
}));

import { TAIL_ANALYSIS_VERSION, purgeObsoleteTailRows, readTailVerdict, storeTailVerdict } from "./tailStore";

const RUNTIME_MS = 6_000_000;
const verdict = { creditsStartMs: 5_500_000, scenes: [{ startMs: 5_900_000, endMs: 5_950_000 }], crawl: [5_560_000, 5_880_000] as [number, number], audio: true };
const row = (over: Record<string, unknown> = {}) => ({
  version: TAIL_ANALYSIS_VERSION, runtimeMs: RUNTIME_MS, verdict: JSON.stringify(verdict), createdAt: new Date(), ...over,
});

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.hasPrisma.mockReturnValue(true);
  mocks.upsert.mockResolvedValue(undefined);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("readTailVerdict", () => {
  it("relit un verdict de la bonne version et du même fichier", async () => {
    mocks.findUnique.mockResolvedValue(row({ runtimeMs: RUNTIME_MS + 400 }));
    expect(await readTailVerdict("film", RUNTIME_MS)).toEqual(verdict);
  });

  it("autre version, autre durée, ligne « rien » d'autrefois, JSON abîmé, pas de base : undefined", async () => {
    mocks.findUnique.mockResolvedValue(row({ version: 4 }));
    expect(await readTailVerdict("film", RUNTIME_MS)).toBeUndefined();
    mocks.findUnique.mockResolvedValue(row({ runtimeMs: RUNTIME_MS + 5_000 }));
    expect(await readTailVerdict("film", RUNTIME_MS)).toBeUndefined();
    mocks.findUnique.mockResolvedValue(row({ verdict: null }));
    expect(await readTailVerdict("film", RUNTIME_MS)).toBeUndefined();
    mocks.findUnique.mockResolvedValue(row({ verdict: "{pas du json" }));
    expect(await readTailVerdict("film", RUNTIME_MS)).toBeUndefined();
    mocks.hasPrisma.mockReturnValue(false);
    expect(await readTailVerdict("film", RUNTIME_MS)).toBeUndefined();
  });

  it("l'aperçu et le démenti sont relus ; mal formés, ignorés", async () => {
    const full = { ...verdict, preview: [1_400_000, 1_440_000], overrides: true };
    mocks.findUnique.mockResolvedValue(row({ verdict: JSON.stringify(full) }));
    expect(await readTailVerdict("film", RUNTIME_MS)).toEqual(full);
    mocks.findUnique.mockResolvedValue(row({ verdict: JSON.stringify({ ...verdict, preview: [1], overrides: "oui" }) }));
    expect(await readTailVerdict("film", RUNTIME_MS)).toEqual(verdict);
  });

  it("un verdict partiel est réparé : scènes mal formées écartées, audio faux par défaut", async () => {
    mocks.findUnique.mockResolvedValue(row({ verdict: JSON.stringify({ creditsStartMs: 1, scenes: [{ startMs: 2 }, { startMs: 3, endMs: 4 }] }) }));
    expect(await readTailVerdict("film", RUNTIME_MS)).toEqual({ creditsStartMs: 1, scenes: [{ startMs: 3, endMs: 4 }], crawl: null, audio: false });
  });
});

describe("storeTailVerdict", () => {
  it("range le verdict sous la version courante", async () => {
    await storeTailVerdict("film", RUNTIME_MS, verdict);
    const call = mocks.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ itemId: "film" });
    expect(call.update).toMatchObject({ version: TAIL_ANALYSIS_VERSION, runtimeMs: RUNTIME_MS });
    expect(JSON.parse(call.update.verdict)).toEqual(verdict);
  });

  it("une base en panne ne fait pas tomber l'analyse", async () => {
    mocks.upsert.mockRejectedValue(new Error("base partie"));
    await expect(storeTailVerdict("film", RUNTIME_MS, verdict)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

describe("purgeObsoleteTailRows", () => {
  it("efface les lignes sans résultat et celles des versions d'avant", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 12 });
    expect(await purgeObsoleteTailRows()).toBe(12);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ verdict: null }, { version: { not: TAIL_ANALYSIS_VERSION } }] },
    });
  });
});
