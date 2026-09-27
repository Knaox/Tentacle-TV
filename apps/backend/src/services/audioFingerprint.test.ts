/**
 * L'empreinte d'un épisode : gardée en mémoire quand elle est valable, sinon
 * calculée fenêtre par fenêtre ; les contrôles (troncature, marge de la tête),
 * le cache borné, le temporaire et le balayage. Téléchargement et binaire
 * sont bouchonnés — et rien ne touche la base.
 */

import { mkdir, mkdtemp, readdir, rm, utimes } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchWindow: vi.fn(),
  fingerprintFile: vi.fn(),
}));

vi.mock("./audioWindows", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./audioWindows")>()),
  fetchAudioWindowToFile: mocks.fetchWindow,
}));
vi.mock("./audioFingerprintTool", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./audioFingerprintTool")>()),
  fingerprintFile: mocks.fingerprintFile,
}));

import { POINTS_PER_SECOND } from "./audioFingerprintTool";
import {
  FINGERPRINT_CACHE_MAX,
  clearFingerprintCacheForTests,
  ensureEpisodeFingerprint,
  readCachedFingerprint,
  sweepStaleTempDirs,
  type FingerprintRequest,
} from "./audioFingerprint";

const RUNTIME_MS = 1_420_000;
const HEAD_MS = 300_000;
const TAIL_MS = 360_000;
const TAIL_START_MS = RUNTIME_MS - TAIL_MS;

/** Des points « seconds × 8,08 » remplis d'un motif reconnaissable. */
const pointsFor = (seconds: number, seed = 1): Uint32Array => {
  const points = new Uint32Array(Math.ceil(seconds * POINTS_PER_SECOND));
  for (let i = 0; i < points.length; i++) points[i] = (seed * 1_000_003 + i) >>> 0;
  return points;
};

let root = "";

const request = (over: Partial<FingerprintRequest> = {}): FingerprintRequest => ({
  itemId: "ep-3",
  runtimeMs: RUNTIME_MS,
  mediaSourceId: "src-3",
  need: { head: true, tail: true },
  jellyfinUrl: "http://jf.test",
  apiKey: "k",
  tool: { kind: "fpcalc", command: "fpcalc" },
  sleep: async () => undefined,
  workRoot: root,
  ...over,
});

/** Le bouchon de téléchargement réussit toujours ; celui de l'outil rend la fenêtre demandée. */
function happyPath(): void {
  mocks.fetchWindow.mockImplementation(async () => ({ ok: true, bytes: 2_900_000, elapsedMs: 3_000, complete: true }));
  mocks.fingerprintFile.mockImplementation(async (_tool: unknown, _file: string, lengthS: number) => ({
    points: pointsFor(lengthS),
    durationS: lengthS,
  }));
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "tentacle-fp-root-"));
  clearFingerprintCacheForTests();
  mocks.fetchWindow.mockReset();
  mocks.fingerprintFile.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

describe("ensureEpisodeFingerprint", () => {
  it("les deux fenêtres sont calculées en série, et gardées", async () => {
    happyPath();
    const outcome = await ensureEpisodeFingerprint(request());
    expect(outcome).toMatchObject({ fetched: 2, bytes: 5_800_000, elapsedMs: 6_000, failure: null });
    expect(mocks.fetchWindow.mock.calls.map((c) => c[0].window.kind)).toEqual(["head", "tail"]);
    expect(outcome.fingerprint.head).toMatchObject({ startMs: 0, lengthMs: HEAD_MS });
    expect(outcome.fingerprint.tail).toMatchObject({ startMs: TAIL_START_MS, lengthMs: TAIL_MS });
    expect(readCachedFingerprint("ep-3", RUNTIME_MS)?.tail?.points.length).toBe(pointsFor(360).length);
  });

  it("déjà en mémoire : rien n'est transcodé une seconde fois", async () => {
    happyPath();
    await ensureEpisodeFingerprint(request());
    mocks.fetchWindow.mockClear();
    const outcome = await ensureEpisodeFingerprint(request({ runtimeMs: RUNTIME_MS + 500 }));
    expect(outcome.fetched).toBe(0);
    expect(outcome.failure).toBeNull();
    expect(mocks.fetchWindow).not.toHaveBeenCalled();
    expect(outcome.fingerprint.head?.points.length).toBe(pointsFor(300).length);
  });

  it("seule la fenêtre manquante est calculée", async () => {
    happyPath();
    await ensureEpisodeFingerprint(request({ need: { head: true, tail: false } }));
    mocks.fetchWindow.mockClear();
    const outcome = await ensureEpisodeFingerprint(request());
    expect(outcome.fetched).toBe(1);
    expect(mocks.fetchWindow.mock.calls[0][0].window).toEqual({ kind: "tail", startMs: TAIL_START_MS, lengthMs: TAIL_MS });
  });

  it("ce dont l'analyse n'a pas besoin n'est pas transcodé", async () => {
    happyPath();
    const outcome = await ensureEpisodeFingerprint(request({ need: { head: false, tail: true } }));
    expect(outcome.fetched).toBe(1);
    expect(outcome.fingerprint.head).toBeNull();
    expect(outcome.fingerprint.tail).not.toBeNull();
  });

  it("un autre fichier (une autre durée) : l'empreinte gardée ne sert pas", async () => {
    happyPath();
    await ensureEpisodeFingerprint(request());
    expect(readCachedFingerprint("ep-3", RUNTIME_MS + 2_000)).toBeNull();
    mocks.fetchWindow.mockClear();
    const outcome = await ensureEpisodeFingerprint(request({ runtimeMs: RUNTIME_MS + 60_000 }));
    expect(outcome.fetched).toBe(2);
  });

  it("la tête, lue avec de la marge, est ramenée à sa fenêtre", async () => {
    mocks.fetchWindow.mockResolvedValue({ ok: true, bytes: 1, elapsedMs: 1, complete: false });
    mocks.fingerprintFile.mockResolvedValue({ points: pointsFor(370), durationS: 370 });
    const outcome = await ensureEpisodeFingerprint(request({ need: { head: true, tail: false } }));
    expect(outcome.fingerprint.head?.points.length).toBe(Math.ceil(300 * POINTS_PER_SECOND));
  });

  it("une fenêtre tronquée est refusée : rien n'est gardé, l'échec est dit", async () => {
    mocks.fetchWindow.mockResolvedValue({ ok: true, bytes: 1, elapsedMs: 1, complete: true });
    mocks.fingerprintFile.mockResolvedValue({ points: pointsFor(100), durationS: 100 });
    const outcome = await ensureEpisodeFingerprint(request());
    expect(outcome.failure).toBe("duration");
    expect(outcome.fingerprint.head).toBeNull();
    expect(mocks.fetchWindow).toHaveBeenCalledTimes(1);
    expect(readCachedFingerprint("ep-3", RUNTIME_MS)).toBeNull();
  });

  it("un échec de téléchargement, ou de l'outil, remonte tel quel", async () => {
    mocks.fetchWindow.mockResolvedValue({ ok: false, failure: "not-supported", status: 404 });
    expect((await ensureEpisodeFingerprint(request())).failure).toBe("not-supported");
    mocks.fetchWindow.mockResolvedValue({ ok: true, bytes: 1, elapsedMs: 1, complete: true });
    mocks.fingerprintFile.mockRejectedValue(new Error("fpcalc a planté"));
    expect((await ensureEpisodeFingerprint(request())).failure).toBe("tool");
    expect(readCachedFingerprint("ep-3", RUNTIME_MS)).toBeNull();
  });

  it("le dossier temporaire disparaît, réussite ou échec", async () => {
    happyPath();
    await ensureEpisodeFingerprint(request());
    mocks.fetchWindow.mockResolvedValue({ ok: false, failure: "transient" });
    await ensureEpisodeFingerprint(request({ itemId: "ep-4" }));
    expect(await readdir(root)).toEqual([]);
  });
});

describe("le cache", () => {
  it("est borné : l'épisode servi il y a le plus longtemps part le premier", async () => {
    happyPath();
    const need = { head: false, tail: true };
    await ensureEpisodeFingerprint(request({ itemId: "ep-0", need }));
    await ensureEpisodeFingerprint(request({ itemId: "ep-1", need }));
    for (let i = 2; i < FINGERPRINT_CACHE_MAX; i++) await ensureEpisodeFingerprint(request({ itemId: `ep-${String(i)}`, need }));
    // ep-0 vient d'être relu : c'est ep-1 qui part quand un nouveau arrive.
    expect(readCachedFingerprint("ep-0", RUNTIME_MS)).not.toBeNull();
    await ensureEpisodeFingerprint(request({ itemId: "ep-new", need }));
    expect(readCachedFingerprint("ep-1", RUNTIME_MS)).toBeNull();
    expect(readCachedFingerprint("ep-0", RUNTIME_MS)).not.toBeNull();
    expect(readCachedFingerprint("ep-new", RUNTIME_MS)).not.toBeNull();
  });
});

describe("l'entretien", () => {
  it("le balayage ne retire que les dossiers d'analyse anciens", async () => {
    const old = join(root, "tentacle-audio-old");
    const fresh = join(root, "tentacle-audio-fresh");
    const other = join(root, "autre-chose-old");
    await Promise.all([mkdir(old), mkdir(fresh), mkdir(other)]);
    const twoHoursAgo = (Date.now() - 2 * 3600_000) / 1000;
    await utimes(old, twoHoursAgo, twoHoursAgo);
    await utimes(other, twoHoursAgo, twoHoursAgo);
    expect(await sweepStaleTempDirs(Date.now(), root)).toBe(1);
    expect((await readdir(root)).sort()).toEqual(["autre-chose-old", "tentacle-audio-fresh"]);
  });
});
