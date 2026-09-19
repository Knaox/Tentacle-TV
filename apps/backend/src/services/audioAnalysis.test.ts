/**
 * L'orchestration : quand l'analyse se déclenche, la file à un slot, la
 * politesse envers Jellyfin, la classification des échecs, et le verdict
 * rangé. Tout ce qui parle à Jellyfin, à la base ou aux binaires est bouchonné.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Des bouchons sans implémentation par défaut : les comportements sont posés
// dans `beforeEach`, et leur typage reste ouvert pour les `mockResolvedValue`.
const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  detectTool: vi.fn(),
  toolMissing: vi.fn(),
  ensureFingerprint: vi.fn(),
  compareWindows: vi.fn(),
  fetchNeighbours: vi.fn(),
  readSessions: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  hasPrisma: vi.fn(),
}));

vi.mock("./configStore", () => ({ isAudioAnalysisEnabled: () => mocks.enabled() }));
vi.mock("./audioFingerprintTool", () => ({
  detectFingerprintTool: () => mocks.detectTool(),
  fingerprintToolKnownMissing: () => mocks.toolMissing(),
}));
vi.mock("./audioFingerprint", () => ({ ensureEpisodeFingerprint: mocks.ensureFingerprint }));
vi.mock("./audioMatch", () => ({ compareWindows: mocks.compareWindows }));
vi.mock("./episodeNeighbours", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./episodeNeighbours")>()),
  fetchEpisodeNeighbours: mocks.fetchNeighbours,
}));
vi.mock("./watchTime/sessions", () => ({ readSessions: () => mocks.readSessions() }));
vi.mock("./db", () => ({
  hasPrisma: () => mocks.hasPrisma(),
  getPrisma: () => ({ mediaAudioAnalysis: { findUnique: mocks.findUnique, upsert: mocks.upsert } }),
}));

import type { PlaybackSegmentsResponse } from "../playback/segmentTypes";
import type { SegmentSourceBundle } from "./jellyfinSegments";
import {
  AUDIO_ANALYSIS_VERSION,
  AUDIO_QUEUE_MAX,
  BUSY_DEFER_MS,
  BUSY_MAX_DEFERRALS,
  audioAnalysisCounters,
  audioAnalysisPending,
  enqueueAudioAnalysis,
  needsAudioAnalysis,
  readStoredAudioVerdict,
  resetAudioAnalysisForTests,
  type AudioAnalysisRequest,
} from "./audioAnalysis";

const RUNTIME_MS = 1_420_000;
const NOW = Date.parse("2026-09-20T10:00:00Z");

const response = (types: Array<"Intro" | "Outro"> = [], runtimeMs = RUNTIME_MS): PlaybackSegmentsResponse => ({
  version: 1,
  itemId: "ep-3",
  runtimeMs,
  segments: types.map((type) => ({
    type, startMs: 0, endMs: 1000, source: "jellyfin" as const, endsAtMediaEnd: false, hasContentAfter: true,
  })),
  libraryId: null,
  resolvedAt: "",
});

const bundle = (over: Partial<SegmentSourceBundle> = {}, episodeOver: Record<string, unknown> = {}): SegmentSourceBundle => ({
  runtimeMs: RUNTIME_MS,
  libraryId: null,
  trickplay: null,
  defaultMediaSourceId: "src-3",
  episode: {
    seriesId: "series-1", seasonId: "season-4", seasonNumber: 4, indexNumber: 3, sourceBitrate: 8_000_000, createdAt: null,
    ...episodeOver,
  },
  sources: {},
  ...over,
});

const request = (over: Partial<AudioAnalysisRequest> = {}): AudioAnalysisRequest => ({
  itemId: "ep-3",
  runtimeMs: RUNTIME_MS,
  mediaSourceId: "src-3",
  episode: bundle().episode as NonNullable<SegmentSourceBundle["episode"]>,
  need: { head: true, tail: true },
  pluginInstalled: false,
  previousNeighbourKey: null,
  jellyfinUrl: "http://jf.test",
  apiKey: "k",
  ...over,
});

const neighbour = (id: string, indexNumber: number) => ({
  id, indexNumber, runtimeMs: RUNTIME_MS, mediaSourceId: `src-${id}`, sourceBitrate: null,
});

const window = (startMs: number, lengthMs: number) => ({ startMs, lengthMs, points: new Uint32Array(10) });

/** Une empreinte complète, comme si tout venait de la base. */
function fingerprintsFromStore(): void {
  mocks.ensureFingerprint.mockImplementation(async (req: { itemId: string; runtimeMs: number }) => ({
    fingerprint: { itemId: req.itemId, runtimeMs: req.runtimeMs, head: window(0, 300_000), tail: window(1_060_000, 360_000) },
    fetched: 0, bytes: 0, elapsedMs: 0, failure: null,
  }));
}

/** Les têtes partagent 90 s à 2:20, les queues 90 s à 22:17 jusqu'au bout. */
function sharedZones(): void {
  mocks.compareWindows.mockImplementation(async (a: { startMs: number }) =>
    a.startMs === 0
      ? [{ aStartMs: 140_000, aEndMs: 230_000, bStartMs: 167_000, bEndMs: 257_000, offsetMs: 27_000, density: 0.98, distinctRatio: 0.9, votes: 300 }]
      : [{ aStartMs: 1_337_000, aEndMs: 1_420_000, bStartMs: 1_332_000, bEndMs: 1_415_000, offsetMs: -5_000, density: 0.98, distinctRatio: 0.9, votes: 300 }],
  );
}

/** Lance la file et laisse les temporisations nulles s'écouler. */
async function drain(): Promise<void> {
  await vi.advanceTimersByTimeAsync(50);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  resetAudioAnalysisForTests({ gapMs: 0 });
  for (const m of Object.values(mocks)) m.mockClear();
  mocks.enabled.mockReturnValue(true);
  mocks.toolMissing.mockReturnValue(false);
  mocks.detectTool.mockResolvedValue({ kind: "fpcalc", command: "fpcalc" });
  mocks.readSessions.mockResolvedValue([]);
  mocks.findUnique.mockResolvedValue(null);
  mocks.upsert.mockResolvedValue(undefined);
  mocks.hasPrisma.mockReturnValue(true);
  mocks.fetchNeighbours.mockResolvedValue([neighbour("ep-2", 2), neighbour("ep-4", 4)]);
  fingerprintsFromStore();
  sharedZones();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("needsAudioAnalysis", () => {
  it("un épisode sans intro ni générique, jamais analysé : oui", () => {
    expect(needsAudioAnalysis(response(), bundle(), undefined, NOW)).toBe(true);
    expect(needsAudioAnalysis(response(["Intro"]), bundle(), undefined, NOW)).toBe(true);
  });

  it("non : film, saison 0, durée inconnue, tout déjà décrit, interrupteur coupé, outil absent", () => {
    expect(needsAudioAnalysis(response(), bundle({ episode: null }), undefined, NOW)).toBe(false);
    expect(needsAudioAnalysis(response(), bundle({}, { seasonNumber: 0 }), undefined, NOW)).toBe(false);
    expect(needsAudioAnalysis(response([], 0), bundle(), undefined, NOW)).toBe(false);
    expect(needsAudioAnalysis(response(["Intro", "Outro"]), bundle(), undefined, NOW)).toBe(false);
    mocks.enabled.mockReturnValue(false);
    expect(needsAudioAnalysis(response(), bundle(), undefined, NOW)).toBe(false);
    mocks.enabled.mockReturnValue(true);
    mocks.toolMissing.mockReturnValue(true);
    expect(needsAudioAnalysis(response(), bundle(), undefined, NOW)).toBe(false);
  });

  it("un fichier de plus de 25 Mbit/s est laissé de côté, et le reste un jour", () => {
    expect(needsAudioAnalysis(response(), bundle({}, { sourceBitrate: 60_000_000 }), undefined, NOW)).toBe(false);
    expect(needsAudioAnalysis(response(), bundle(), undefined, NOW + 3600_000)).toBe(false);
    expect(needsAudioAnalysis(response(), bundle(), undefined, NOW + 25 * 3600_000)).toBe(true);
  });

  it("un greffon installé a la nuit devant lui sur un item frais", () => {
    const fresh = { createdAt: new Date(NOW - 3600_000).toISOString() };
    expect(needsAudioAnalysis(response(), bundle({ sources: { pluginDict: {} } }, fresh), undefined, NOW)).toBe(false);
    const old = { createdAt: new Date(NOW - 2 * 24 * 3600_000).toISOString() };
    // Un autre épisode : le premier vient d'être refroidi jusqu'au lendemain.
    const other = { ...response(), itemId: "ep-old" };
    expect(needsAudioAnalysis(other, bundle({ sources: { pluginDict: {} } }, old), undefined, NOW)).toBe(true);
  });

  it("un verdict plein est définitif ; un verdict vide l'est un jour, puis fait revérifier", () => {
    const full = { verdict: { intro: { startMs: 0, endMs: 90_000, source: "audio" as const }, outro: null, confirmedBy: 1, neighbourKey: "ep-2" }, createdAt: new Date(NOW - 10 * 24 * 3600_000) };
    expect(needsAudioAnalysis(response(["Intro"]), bundle(), full, NOW)).toBe(false);
    const empty = (ageMs: number) => ({ verdict: { intro: null, outro: null, confirmedBy: 0, neighbourKey: "ep-2" }, createdAt: new Date(NOW - ageMs) });
    expect(needsAudioAnalysis(response(), bundle(), empty(3600_000), NOW)).toBe(false);
    expect(needsAudioAnalysis(response(), bundle(), empty(25 * 3600_000), NOW)).toBe(true);
  });
});

describe("readStoredAudioVerdict", () => {
  it("jamais analysé, autre version, autre durée : undefined ; colonne nulle : verdict vide", async () => {
    expect(await readStoredAudioVerdict("ep-3", RUNTIME_MS)).toBeUndefined();
    mocks.findUnique.mockResolvedValue({ version: AUDIO_ANALYSIS_VERSION - 1, runtimeMs: RUNTIME_MS, verdict: null, createdAt: new Date(NOW) });
    expect(await readStoredAudioVerdict("ep-3", RUNTIME_MS)).toBeUndefined();
    mocks.findUnique.mockResolvedValue({ version: AUDIO_ANALYSIS_VERSION, runtimeMs: RUNTIME_MS + 5_000, verdict: null, createdAt: new Date(NOW) });
    expect(await readStoredAudioVerdict("ep-3", RUNTIME_MS)).toBeUndefined();
    mocks.findUnique.mockResolvedValue({ version: AUDIO_ANALYSIS_VERSION, runtimeMs: RUNTIME_MS, verdict: null, createdAt: new Date(NOW) });
    expect((await readStoredAudioVerdict("ep-3", RUNTIME_MS))?.verdict).toEqual({ intro: null, outro: null, confirmedBy: 0, neighbourKey: "" });
    mocks.findUnique.mockResolvedValue({ version: AUDIO_ANALYSIS_VERSION, runtimeMs: RUNTIME_MS, verdict: '{"intro":null,"outro":null,"confirmedBy":0,"neighbourKey":"a,b"}', createdAt: new Date(NOW) });
    expect((await readStoredAudioVerdict("ep-3", RUNTIME_MS))?.verdict.neighbourKey).toBe("a,b");
  });
});

describe("le job", () => {
  it("compare l'épisode à ses deux voisins et range un verdict confirmé", async () => {
    enqueueAudioAnalysis(request());
    expect(audioAnalysisPending("ep-3")).toBe(true);
    await drain();
    expect(audioAnalysisPending("ep-3")).toBe(false);
    expect(mocks.ensureFingerprint.mock.calls.map((c) => c[0].itemId)).toEqual(["ep-3", "ep-2", "ep-4"]);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(mocks.upsert.mock.calls[0][0].update.verdict);
    expect(stored).toMatchObject({
      intro: { startMs: 141_000, endMs: 228_500, source: "audio" },
      outro: { startMs: 1_339_000, endMs: RUNTIME_MS, source: "audio" },
      confirmedBy: 2,
      neighbourKey: "ep-2,ep-4",
    });
    expect(audioAnalysisCounters()).toMatchObject({ jobs: 1, verdicts: 1, silent: 0 });
  });

  it("ne demande à chaque voisin que les fenêtres dont l'épisode a besoin", async () => {
    enqueueAudioAnalysis(request({ need: { head: false, tail: true } }));
    await drain();
    expect(mocks.ensureFingerprint.mock.calls.every((c) => c[0].need.head === false && c[0].need.tail === true)).toBe(true);
    const stored = JSON.parse(mocks.upsert.mock.calls[0][0].update.verdict);
    expect(stored.intro).toBeNull();
    expect(stored.outro).not.toBeNull();
  });

  it("rien de partagé : un verdict vide est rangé, avec ses raisons", async () => {
    mocks.compareWindows.mockResolvedValue([]);
    enqueueAudioAnalysis(request());
    await drain();
    const stored = JSON.parse(mocks.upsert.mock.calls[0][0].update.verdict);
    expect(stored).toMatchObject({ intro: null, outro: null, neighbourKey: "ep-2,ep-4" });
    expect(stored.reason).toContain("rien de partagé");
    expect(audioAnalysisCounters().silent).toBe(1);
  });

  it("le même épisode demandé trois fois ne tourne qu'une fois ; la file ignore au-delà de sa taille", async () => {
    let release: () => void = () => undefined;
    mocks.ensureFingerprint.mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve({ fingerprint: { itemId: "ep-3", runtimeMs: RUNTIME_MS, head: null, tail: null }, fetched: 0, bytes: 0, elapsedMs: 0, failure: "transient" });
    }));
    enqueueAudioAnalysis(request());
    enqueueAudioAnalysis(request());
    enqueueAudioAnalysis(request());
    for (let i = 0; i < AUDIO_QUEUE_MAX + 2; i++) enqueueAudioAnalysis(request({ itemId: `ep-${String(10 + i)}` }));
    expect(audioAnalysisPending("ep-3")).toBe(true);
    expect(audioAnalysisPending(`ep-${String(10 + AUDIO_QUEUE_MAX - 1)}`)).toBe(true);
    expect(audioAnalysisPending(`ep-${String(10 + AUDIO_QUEUE_MAX)}`)).toBe(false);
    // Laisser le premier job atteindre l'empreinte bloquante, puis le libérer.
    await drain();
    expect(mocks.fetchNeighbours).toHaveBeenCalledTimes(1);
    release();
    await drain();
    expect(mocks.fetchNeighbours.mock.calls.length).toBe(1 + AUDIO_QUEUE_MAX);
  });

  it("un autre spectateur transcode : le job attend deux minutes, puis tourne", async () => {
    mocks.readSessions.mockResolvedValueOnce([
      { NowPlayingItem: { Id: "film-x" }, PlayState: { IsPaused: false }, TranscodingInfo: { IsVideoDirect: false } },
    ]);
    enqueueAudioAnalysis(request());
    await drain();
    expect(mocks.fetchNeighbours).not.toHaveBeenCalled();
    expect(audioAnalysisPending("ep-3")).toBe(true);
    expect(audioAnalysisCounters().deferred).toBe(1);
    await vi.advanceTimersByTimeAsync(BUSY_DEFER_MS + 50);
    expect(mocks.fetchNeighbours).toHaveBeenCalledTimes(1);
    expect(audioAnalysisPending("ep-3")).toBe(false);
  });

  it("la lecture du demandeur lui-même, ou en pause, ou en lecture directe, ne compte pas", async () => {
    mocks.readSessions.mockResolvedValue([
      { NowPlayingItem: { Id: "ep-3" }, PlayState: { IsPaused: false }, TranscodingInfo: { IsVideoDirect: false } },
      { NowPlayingItem: { Id: "film-y" }, PlayState: { IsPaused: true }, TranscodingInfo: { IsVideoDirect: false } },
      { NowPlayingItem: { Id: "film-z" }, PlayState: { IsPaused: false }, TranscodingInfo: { IsVideoDirect: true } },
    ]);
    enqueueAudioAnalysis(request());
    await drain();
    expect(mocks.fetchNeighbours).toHaveBeenCalledTimes(1);
  });

  it("occupé cinq fois de suite : l'épisode est refroidi, plus en file", async () => {
    mocks.readSessions.mockResolvedValue([
      { NowPlayingItem: { Id: "film-x" }, PlayState: { IsPaused: false }, TranscodingInfo: { IsVideoDirect: false } },
    ]);
    enqueueAudioAnalysis(request());
    for (let i = 0; i <= BUSY_MAX_DEFERRALS; i++) await vi.advanceTimersByTimeAsync(BUSY_DEFER_MS + 50);
    expect(audioAnalysisPending("ep-3")).toBe(false);
    expect(mocks.fetchNeighbours).not.toHaveBeenCalled();
    expect(needsAudioAnalysis(response(), bundle(), undefined, Date.now())).toBe(false);
  });

  it("Jellyfin refuse le flux audio (404) : la fonction se tait un jour, un seul avertissement", async () => {
    mocks.ensureFingerprint.mockResolvedValue({ fingerprint: { itemId: "ep-3", runtimeMs: RUNTIME_MS, head: null, tail: null }, fetched: 0, bytes: 0, elapsedMs: 0, failure: "not-supported" });
    enqueueAudioAnalysis(request());
    await drain();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(needsAudioAnalysis(response(), bundle({}, {}), undefined, Date.now())).toBe(false);
    expect(needsAudioAnalysis(response(), bundle({}, {}), undefined, Date.now() + 25 * 3600_000)).toBe(true);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("un serveur trop lent met la fonction au repos une heure", async () => {
    mocks.ensureFingerprint.mockResolvedValue({ fingerprint: { itemId: "ep-3", runtimeMs: RUNTIME_MS, head: null, tail: null }, fetched: 0, bytes: 0, elapsedMs: 0, failure: "too-slow" });
    enqueueAudioAnalysis(request());
    await drain();
    expect(needsAudioAnalysis(response(), bundle(), undefined, Date.now())).toBe(false);
    expect(needsAudioAnalysis(response(), bundle(), undefined, Date.now() + 3700_000)).toBe(true);
  });

  it("un échec transitoire refroidit l'épisode ; trois de suite, le serveur", async () => {
    mocks.fetchNeighbours.mockResolvedValue(null);
    for (const id of ["ep-3", "ep-5", "ep-7"]) {
      enqueueAudioAnalysis(request({ itemId: id }));
      await drain();
    }
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(needsAudioAnalysis(response(), bundle(), undefined, Date.now())).toBe(false);
    const other = { ...response(), itemId: "ep-9" };
    expect(needsAudioAnalysis(other, bundle(), undefined, Date.now())).toBe(false); // repos global
    expect(needsAudioAnalysis(other, bundle(), undefined, Date.now() + 3700_000)).toBe(true);
  });

  it("aucun voisin : refroidi une heure, rien en base", async () => {
    mocks.fetchNeighbours.mockResolvedValue([]);
    enqueueAudioAnalysis(request());
    await drain();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.ensureFingerprint).not.toHaveBeenCalled();
    expect(needsAudioAnalysis(response(), bundle(), undefined, Date.now())).toBe(false);
  });

  it("revérification : des voisins inchangés ne coûtent aucune fenêtre, le verdict vide est daté à neuf", async () => {
    enqueueAudioAnalysis(request({ previousNeighbourKey: "ep-2,ep-4" }));
    await drain();
    expect(mocks.ensureFingerprint).not.toHaveBeenCalled();
    const stored = JSON.parse(mocks.upsert.mock.calls[0][0].update.verdict);
    expect(stored).toMatchObject({ intro: null, outro: null, neighbourKey: "ep-2,ep-4", reason: "voisins inchangés" });
  });

  it("un voisin qui échoue est ignoré, l'autre témoigne seul", async () => {
    mocks.ensureFingerprint.mockImplementation(async (req: { itemId: string; runtimeMs: number }) =>
      req.itemId === "ep-2"
        ? { fingerprint: { itemId: req.itemId, runtimeMs: req.runtimeMs, head: null, tail: null }, fetched: 0, bytes: 0, elapsedMs: 0, failure: "duration" }
        : { fingerprint: { itemId: req.itemId, runtimeMs: req.runtimeMs, head: window(0, 300_000), tail: window(1_060_000, 360_000) }, fetched: 1, bytes: 2_900_000, elapsedMs: 3_000, failure: null },
    );
    enqueueAudioAnalysis(request());
    await drain();
    const stored = JSON.parse(mocks.upsert.mock.calls[0][0].update.verdict);
    expect(stored.confirmedBy).toBe(1);
    expect(audioAnalysisCounters()).toMatchObject({ windows: 2, bytes: 5_800_000 });
  });
});
