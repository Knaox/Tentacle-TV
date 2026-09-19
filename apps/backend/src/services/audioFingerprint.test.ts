/**
 * L'empreinte d'un épisode : relue en base quand elle est valable, sinon
 * calculée fenêtre par fenêtre et rangée colonne par colonne ; les contrôles
 * (troncature, marge de la tête), le temporaire, la purge et le balayage.
 * Base, téléchargement et binaire sont bouchonnés.
 */

import { mkdir, mkdtemp, readdir, rm, utimes } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchWindow: vi.fn(),
  fingerprintFile: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  hasPrisma: vi.fn(() => true),
}));

vi.mock("./db", () => ({
  hasPrisma: () => mocks.hasPrisma(),
  getPrisma: () => ({
    mediaAudioFingerprint: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany,
    },
  }),
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
  AUDIO_FINGERPRINT_VERSION,
  FINGERPRINT_RETENTION_MS,
  ensureEpisodeFingerprint,
  purgeFingerprints,
  readStoredFingerprint,
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
const bytesOf = (points: Uint32Array) => Buffer.from(points.buffer, points.byteOffset, points.byteLength);

const row = (over: Record<string, unknown> = {}) => ({
  version: AUDIO_FINGERPRINT_VERSION,
  runtimeMs: RUNTIME_MS,
  headStartMs: 0,
  headWindowMs: HEAD_MS,
  head: bytesOf(pointsFor(300, 1)),
  tailStartMs: TAIL_START_MS,
  tailWindowMs: TAIL_MS,
  tail: bytesOf(pointsFor(360, 2)),
  ...over,
});

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
  mocks.fetchWindow.mockReset();
  mocks.fingerprintFile.mockReset();
  mocks.findUnique.mockReset().mockResolvedValue(null);
  mocks.upsert.mockReset().mockResolvedValue(undefined);
  mocks.deleteMany.mockReset().mockResolvedValue({ count: 0 });
  mocks.hasPrisma.mockReturnValue(true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

describe("readStoredFingerprint", () => {
  it("relit une ligne de la bonne version et du même fichier", async () => {
    mocks.findUnique.mockResolvedValue(row());
    const stored = await readStoredFingerprint("ep-3", RUNTIME_MS + 500);
    expect(stored?.head).toMatchObject({ startMs: 0, lengthMs: HEAD_MS });
    expect(Array.from(stored?.head?.points ?? [])).toEqual(Array.from(pointsFor(300, 1)));
    expect(stored?.tail?.points.length).toBe(pointsFor(360).length);
  });

  it("une autre version, une autre durée, ou pas de base : null", async () => {
    mocks.findUnique.mockResolvedValue(row({ version: AUDIO_FINGERPRINT_VERSION - 1 }));
    expect(await readStoredFingerprint("ep-3", RUNTIME_MS)).toBeNull();
    mocks.findUnique.mockResolvedValue(row());
    expect(await readStoredFingerprint("ep-3", RUNTIME_MS + 2_000)).toBeNull();
    mocks.hasPrisma.mockReturnValue(false);
    expect(await readStoredFingerprint("ep-3", RUNTIME_MS)).toBeNull();
  });

  it("un tampon rendu à un décalage impair se relit quand même — on copie avant de voir en uint32", async () => {
    const backing = new Uint8Array(9);
    backing.set([0, 7, 0, 0, 0, 9, 0, 0, 0]);
    mocks.findUnique.mockResolvedValue(row({ head: new Uint8Array(backing.buffer, 1, 8), headWindowMs: 1000 }));
    const stored = await readStoredFingerprint("ep-3", RUNTIME_MS);
    expect(Array.from(stored?.head?.points ?? [])).toEqual([7, 9]);
  });
});

describe("ensureEpisodeFingerprint", () => {
  it("ligne valable en base : rien n'est transcodé", async () => {
    mocks.findUnique.mockResolvedValue(row());
    const outcome = await ensureEpisodeFingerprint(request());
    expect(outcome.fetched).toBe(0);
    expect(outcome.failure).toBeNull();
    expect(mocks.fetchWindow).not.toHaveBeenCalled();
    expect(outcome.fingerprint.head?.points.length).toBe(pointsFor(300).length);
  });

  it("ligne périmée : les deux fenêtres sont refaites, en série, chacune rangée dans sa colonne", async () => {
    mocks.findUnique.mockResolvedValue(row({ version: 0 }));
    happyPath();
    const outcome = await ensureEpisodeFingerprint(request());
    expect(outcome).toMatchObject({ fetched: 2, bytes: 5_800_000, elapsedMs: 6_000, failure: null });
    expect(mocks.fetchWindow.mock.calls.map((c) => c[0].window.kind)).toEqual(["head", "tail"]);
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    const [headCall, tailCall] = mocks.upsert.mock.calls.map((c) => c[0]);
    expect(headCall.update).toMatchObject({ headStartMs: 0, headWindowMs: HEAD_MS, version: AUDIO_FINGERPRINT_VERSION });
    expect(headCall.update).not.toHaveProperty("tail");
    expect(tailCall.update).toMatchObject({ tailStartMs: TAIL_START_MS, tailWindowMs: TAIL_MS, mediaSourceId: "src-3" });
    expect(tailCall.update.tail).toBeInstanceOf(Uint8Array);
    expect(tailCall.update.tail.byteLength).toBe(pointsFor(360).byteLength);
    expect(outcome.fingerprint.tail?.points.length).toBe(pointsFor(360).length);
  });

  it("seule la fenêtre manquante est calculée", async () => {
    mocks.findUnique.mockResolvedValue(row({ tailStartMs: null, tailWindowMs: null, tail: null }));
    happyPath();
    const outcome = await ensureEpisodeFingerprint(request());
    expect(outcome.fetched).toBe(1);
    expect(mocks.fetchWindow.mock.calls[0][0].window).toEqual({ kind: "tail", startMs: TAIL_START_MS, lengthMs: TAIL_MS });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("ce dont l'analyse n'a pas besoin n'est pas transcodé", async () => {
    happyPath();
    const outcome = await ensureEpisodeFingerprint(request({ need: { head: false, tail: true } }));
    expect(outcome.fetched).toBe(1);
    expect(outcome.fingerprint.head).toBeNull();
    expect(outcome.fingerprint.tail).not.toBeNull();
  });

  it("la tête, lue avec de la marge, est ramenée à sa fenêtre", async () => {
    mocks.fetchWindow.mockResolvedValue({ ok: true, bytes: 1, elapsedMs: 1, complete: false });
    mocks.fingerprintFile.mockResolvedValue({ points: pointsFor(370), durationS: 370 });
    const outcome = await ensureEpisodeFingerprint(request({ need: { head: true, tail: false } }));
    expect(outcome.fingerprint.head?.points.length).toBe(Math.ceil(300 * POINTS_PER_SECOND));
  });

  it("une fenêtre tronquée est refusée : rien n'est rangé, l'échec est dit", async () => {
    mocks.fetchWindow.mockResolvedValue({ ok: true, bytes: 1, elapsedMs: 1, complete: true });
    mocks.fingerprintFile.mockResolvedValue({ points: pointsFor(100), durationS: 100 });
    const outcome = await ensureEpisodeFingerprint(request());
    expect(outcome.failure).toBe("duration");
    expect(outcome.fingerprint.head).toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.fetchWindow).toHaveBeenCalledTimes(1);
  });

  it("un échec de téléchargement, ou de l'outil, remonte tel quel", async () => {
    mocks.fetchWindow.mockResolvedValue({ ok: false, failure: "not-supported", status: 404 });
    expect((await ensureEpisodeFingerprint(request())).failure).toBe("not-supported");
    mocks.fetchWindow.mockResolvedValue({ ok: true, bytes: 1, elapsedMs: 1, complete: true });
    mocks.fingerprintFile.mockRejectedValue(new Error("fpcalc a planté"));
    expect((await ensureEpisodeFingerprint(request())).failure).toBe("tool");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("le dossier temporaire disparaît, réussite ou échec", async () => {
    happyPath();
    await ensureEpisodeFingerprint(request());
    mocks.fetchWindow.mockResolvedValue({ ok: false, failure: "transient" });
    await ensureEpisodeFingerprint(request({ itemId: "ep-4" }));
    expect(await readdir(root)).toEqual([]);
  });

  it("sans base, on calcule quand même — et on ne range rien", async () => {
    mocks.hasPrisma.mockReturnValue(false);
    happyPath();
    const outcome = await ensureEpisodeFingerprint(request());
    expect(outcome.fetched).toBe(2);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe("l'entretien", () => {
  it("la purge efface les empreintes de plus de 90 jours", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 3 });
    const now = Date.parse("2026-09-20T00:00:00Z");
    expect(await purgeFingerprints(now)).toBe(3);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date(now - FINGERPRINT_RETENTION_MS) } },
    });
  });

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
