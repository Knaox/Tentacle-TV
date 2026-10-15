/**
 * L'orchestration de l'analyse de fin de média : quand elle se lance, ce
 * qu'elle range (seulement ce qu'elle a trouvé), et rien qu'à partir des
 * vignettes — plus d'écoute. Jellyfin et la base sont bouchonnés ; la lecture
 * elle-même est la vraie.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collect: vi.fn(),
  store: vi.fn(),
}));

vi.mock("../trickplayFrames", () => ({ collectFrameSamples: mocks.collect }));
vi.mock("./tailStore", () => ({ storeTailVerdict: mocks.store }));

import {
  FAILURE_COOLDOWN_MS,
  NOTHING_FOUND_COOLDOWN_MS,
  needsTailAnalysis,
  resetTailAnalysisForTests,
  startTailAnalysis,
  tailAnalysisPending,
  type TailAnalysisRequest,
} from "./tailAnalysis";
import type { ThumbnailMeasure } from "./tailCells";

const RUNTIME_MS = 6_000_000;
const NOW = Date.parse("2026-09-27T10:00:00Z");

const IMAGE = { dark: 0.1, saturation: 60, rows: 0, modal: 0.2 };
const CRAWL = { dark: 0.9, saturation: 1, rows: 0.3, modal: 0.9 };
const BLACK = { dark: 1, saturation: 0, rows: 0, modal: 1 };

/** Un film : l'image jusqu'à 90:00, le défilement jusqu'à 98:20, du noir, puis 50 s de scène. */
function samples(withCrawl = true): ThumbnailMeasure[] {
  const out: ThumbnailMeasure[] = [];
  for (let ms = RUNTIME_MS / 2; ms < RUNTIME_MS; ms += 10_000) {
    let kind = IMAGE;
    if (withCrawl && ms >= 5_400_000 && ms < 5_900_000) kind = CRAWL;
    else if (withCrawl && ms >= 5_900_000 && ms < 5_920_000) kind = BLACK;
    out.push({ ms, ...kind });
  }
  return out;
}

const request = (over: Partial<TailAnalysisRequest> = {}): TailAnalysisRequest => ({
  itemId: "film",
  runtimeMs: RUNTIME_MS,
  mediaSourceId: "src",
  trickplay: null,
  providerSpans: [],
  isEpisode: false,
  jellyfinUrl: "http://jf.test",
  apiKey: "k",
  ...over,
});

async function settle(ms = 50): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  resetTailAnalysisForTests();
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.collect.mockResolvedValue({ samples: samples(), intervalMs: 10_000 });
  mocks.store.mockResolvedValue(undefined);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("needsTailAnalysis", () => {
  it("tout média avec des vignettes, jamais analysé : oui", () => {
    expect(needsTailAnalysis("film", RUNTIME_MS, true, undefined)).toBe(true);
    expect(needsTailAnalysis("film", RUNTIME_MS, false, undefined)).toBe(false);
    expect(needsTailAnalysis("film", 0, true, undefined)).toBe(false);
  });

  it("un verdict rangé est définitif, qu'il ait écouté (avant le retrait) ou non", () => {
    const base = { creditsStartMs: 1, scenes: [], crawl: null };
    expect(needsTailAnalysis("film", RUNTIME_MS, true, { ...base, audio: true })).toBe(false);
    expect(needsTailAnalysis("film", RUNTIME_MS, true, { ...base, audio: false })).toBe(false);
  });
});

describe("l'analyse", () => {
  it("trouve le générique et la scène par les seules vignettes, et range le verdict", async () => {
    startTailAnalysis(request());
    expect(tailAnalysisPending("film")).toBe(true);
    await settle();
    expect(tailAnalysisPending("film")).toBe(false);
    expect(mocks.store).toHaveBeenCalledTimes(1);
    const [itemId, runtimeMs, verdict] = mocks.store.mock.calls[0];
    expect(itemId).toBe("film");
    expect(runtimeMs).toBe(RUNTIME_MS);
    expect(verdict).toMatchObject({ creditsStartMs: 5_400_000, crawl: [5_400_000, 5_900_000], audio: false });
    expect(verdict.scenes).toEqual([{ startMs: 5_920_000, endMs: RUNTIME_MS }]);
  });

  it("rien de sûr : rien n'est rangé, et le média se tait un jour", async () => {
    mocks.collect.mockResolvedValue({ samples: samples(false), intervalMs: 10_000 });
    startTailAnalysis(request());
    await settle();
    expect(mocks.store).not.toHaveBeenCalled();
    expect(needsTailAnalysis("film", RUNTIME_MS, true, undefined, Date.now())).toBe(false);
    expect(needsTailAnalysis("film", RUNTIME_MS, true, undefined, Date.now() + NOTHING_FOUND_COOLDOWN_MS + 1)).toBe(true);
  });

  it("pas de vignettes lisibles : rien n'est rangé", async () => {
    mocks.collect.mockResolvedValue({ samples: [], intervalMs: 0 });
    startTailAnalysis(request());
    await settle();
    expect(mocks.store).not.toHaveBeenCalled();
    expect(needsTailAnalysis("film", RUNTIME_MS, true, undefined, Date.now())).toBe(false);
  });

  it("le même média demandé deux fois ne tourne qu'une fois", async () => {
    startTailAnalysis(request());
    startTailAnalysis(request());
    await settle();
    expect(mocks.collect).toHaveBeenCalledTimes(1);
  });

  it("une panne en route refroidit le média une heure", async () => {
    mocks.collect.mockRejectedValue(new Error("Jellyfin parti"));
    startTailAnalysis(request());
    await settle();
    expect(mocks.store).not.toHaveBeenCalled();
    expect(needsTailAnalysis("film", RUNTIME_MS, true, undefined, Date.now())).toBe(false);
    expect(needsTailAnalysis("film", RUNTIME_MS, true, undefined, Date.now() + FAILURE_COOLDOWN_MS + 1)).toBe(true);
  });
});
