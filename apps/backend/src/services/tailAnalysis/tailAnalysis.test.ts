/**
 * L'orchestration de l'analyse de fin de média : quand elle se lance, ce
 * qu'elle range (seulement ce qu'elle a trouvé), la politesse envers les
 * autres spectateurs, et le repli sur les vignettes seules. Jellyfin, la base
 * et ffmpeg sont bouchonnés ; la lecture elle-même est la vraie.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collect: vi.fn(),
  listen: vi.fn(),
  detectDecoder: vi.fn(),
  decoderMissing: vi.fn(),
  enabled: vi.fn(),
  readSessions: vi.fn(),
  store: vi.fn(),
}));

vi.mock("../trickplayFrames", () => ({ collectFrameSamples: mocks.collect }));
vi.mock("./tailAudio", () => ({
  listenToTail: mocks.listen,
  detectDecoder: () => mocks.detectDecoder(),
  decoderKnownMissing: () => mocks.decoderMissing(),
}));
vi.mock("../configStore", () => ({ isAudioAnalysisEnabled: () => mocks.enabled() }));
vi.mock("../watchTime/sessions", () => ({ readSessions: () => mocks.readSessions() }));
vi.mock("./tailStore", () => ({ storeTailVerdict: mocks.store }));

import { audioAnalysisCounters, resetAudioCountersForTests } from "../audioJobs";
import {
  BUSY_DEFER_MS,
  BUSY_MAX_DEFERRALS,
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

/** La frise audio depuis `fromMs` : parole dans le film, musique sous le défilement, parole dans la scène. */
function heard(fromMs: number) {
  let classes = "";
  for (let ms = fromMs; ms < RUNTIME_MS; ms += 1000) classes += ms < 5_400_000 ? "S" : ms < 5_920_000 ? "M" : "S";
  return { ok: true, fromMs, classes, bytes: 6_000_000, elapsedMs: 5_000 };
}

async function settle(ms = 50): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  resetTailAnalysisForTests();
  resetAudioCountersForTests();
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.collect.mockResolvedValue({ samples: samples(), intervalMs: 10_000 });
  mocks.listen.mockImplementation(async (req: { fromMs: number }) => heard(req.fromMs));
  mocks.detectDecoder.mockResolvedValue(true);
  mocks.decoderMissing.mockReturnValue(false);
  mocks.enabled.mockReturnValue(true);
  mocks.readSessions.mockResolvedValue([]);
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

  it("un verdict entendu est définitif ; un verdict des vignettes seules se refait quand l'audio revient", () => {
    const base = { creditsStartMs: 1, scenes: [], crawl: null };
    expect(needsTailAnalysis("film", RUNTIME_MS, true, { ...base, audio: true })).toBe(false);
    expect(needsTailAnalysis("film", RUNTIME_MS, true, { ...base, audio: false })).toBe(true);
    mocks.enabled.mockReturnValue(false);
    expect(needsTailAnalysis("film", RUNTIME_MS, true, { ...base, audio: false })).toBe(false);
    mocks.enabled.mockReturnValue(true);
    mocks.decoderMissing.mockReturnValue(true);
    expect(needsTailAnalysis("film", RUNTIME_MS, true, { ...base, audio: false })).toBe(false);
  });
});

describe("l'analyse", () => {
  it("trouve le générique et la scène, écoute depuis avant le défilement, et range le verdict", async () => {
    startTailAnalysis(request());
    expect(tailAnalysisPending("film")).toBe(true);
    await settle();
    expect(tailAnalysisPending("film")).toBe(false);
    expect(mocks.listen.mock.calls[0][0].fromMs).toBeLessThan(5_400_000);
    expect(mocks.store).toHaveBeenCalledTimes(1);
    const [itemId, runtimeMs, verdict] = mocks.store.mock.calls[0];
    expect(itemId).toBe("film");
    expect(runtimeMs).toBe(RUNTIME_MS);
    expect(verdict).toMatchObject({ creditsStartMs: 5_400_000, crawl: [5_400_000, 5_900_000], audio: true });
    expect(verdict.scenes).toEqual([{ startMs: 5_920_000, endMs: RUNTIME_MS }]);
    expect(audioAnalysisCounters()).toMatchObject({ jobs: 1, windows: 1, bytes: 6_000_000, verdicts: 1 });
  });

  it("rien de sûr : rien n'est rangé, et le média se tait un jour", async () => {
    mocks.collect.mockResolvedValue({ samples: samples(false), intervalMs: 10_000 });
    startTailAnalysis(request());
    await settle();
    expect(mocks.store).not.toHaveBeenCalled();
    expect(mocks.listen).not.toHaveBeenCalled();
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

  it("un autre spectateur transcode : l'écoute attend deux minutes, puis a lieu", async () => {
    mocks.readSessions.mockResolvedValueOnce([
      { NowPlayingItem: { Id: "autre" }, PlayState: { IsPaused: false }, TranscodingInfo: { IsVideoDirect: false } },
    ]);
    startTailAnalysis(request());
    await settle();
    expect(mocks.listen).not.toHaveBeenCalled();
    expect(tailAnalysisPending("film")).toBe(true);
    expect(audioAnalysisCounters().deferred).toBe(1);
    await settle(BUSY_DEFER_MS + 50);
    expect(mocks.listen).toHaveBeenCalledTimes(1);
    expect(mocks.store).toHaveBeenCalledTimes(1);
    expect(tailAnalysisPending("film")).toBe(false);
  });

  it("occupé cinq fois de suite : remis à plus tard, rien de rangé", async () => {
    mocks.readSessions.mockResolvedValue([
      { NowPlayingItem: { Id: "autre" }, PlayState: { IsPaused: false }, TranscodingInfo: { IsVideoDirect: false } },
    ]);
    startTailAnalysis(request());
    for (let i = 0; i <= BUSY_MAX_DEFERRALS; i++) await settle(BUSY_DEFER_MS + 50);
    expect(tailAnalysisPending("film")).toBe(false);
    expect(mocks.listen).not.toHaveBeenCalled();
    expect(mocks.store).not.toHaveBeenCalled();
    expect(needsTailAnalysis("film", RUNTIME_MS, true, undefined, Date.now())).toBe(false);
  });

  it("l'écoute échoue : le verdict des vignettes seules est rangé, et l'audio retenté une heure plus tard", async () => {
    mocks.listen.mockResolvedValue({ ok: false, failure: "transient" });
    startTailAnalysis(request());
    await settle();
    const verdict = mocks.store.mock.calls[0][2];
    expect(verdict).toMatchObject({ creditsStartMs: 5_400_000, audio: false });
    expect(needsTailAnalysis("film", RUNTIME_MS, true, verdict, Date.now())).toBe(false);
    expect(needsTailAnalysis("film", RUNTIME_MS, true, verdict, Date.now() + FAILURE_COOLDOWN_MS + 1)).toBe(true);
  });

  it("sans ffmpeg, ou l'audio coupé par l'administrateur : les vignettes seules, sans rien transcoder", async () => {
    mocks.detectDecoder.mockResolvedValue(false);
    startTailAnalysis(request());
    await settle();
    mocks.enabled.mockReturnValue(false);
    startTailAnalysis(request({ itemId: "film-2" }));
    await settle();
    expect(mocks.listen).not.toHaveBeenCalled();
    expect(mocks.store.mock.calls.map((c) => c[2].audio)).toEqual([false, false]);
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
