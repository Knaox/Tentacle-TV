/**
 * L'extraction face à un YouTube qui bride l'adresse — UNIQUEMENT par
 * simulation : l'ouvrier yt-dlp rend des sorties écrites ici, et lancer
 * yt-dlp pour de vrai fait échouer le test. Un aperçu bloqué n'insiste pas et
 * ouvre le disjoncteur ; une lecture garde ses passes d'avant ; un aperçu ne
 * demande rien à YouTube pendant une suspension ni au-delà du budget.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerResult } from "./ytWorker";

const { workerExtract } = vi.hoisted(() => ({ workerExtract: vi.fn<(...args: unknown[]) => Promise<WorkerResult>>() }));
vi.mock("./ytWorker", () => ({ workerExtract }));
vi.mock("../ytDlp", () => ({ ytDlpCommand: () => "/opt/yt-dlp-simule" }));
vi.mock("child_process", () => ({
  execFile: () => {
    throw new Error("un test ne lance jamais yt-dlp");
  },
}));

import { extractTrailerSource } from "./ytExtract";
import { PREVIEW_EXTRACTIONS_PER_HOUR, previewRefusal, resetYouTubeGuard, tripYouTubeBreaker } from "./youtubeGuard";

const MASTER = "https://manifest.googlevideo.test/api/manifest/hls_variant/expire/1790970374/file/index.m3u8";
const HLS_FORMATS = [{ format_id: "232", protocol: "m3u8_native", vcodec: "avc1.4D401F", acodec: "none", height: 720, url: `${MASTER}#232`, manifest_url: MASTER }];
const done = (stderr: string, formats: unknown[] = []): WorkerResult => ({ status: "done", outcome: { formats: formats as Array<Record<string, unknown>>, stderr } });
/** Ce que yt-dlp rend sous vérification anti-robot avec `--ignore-no-formats-error` : un AVERTISSEMENT, zéro format. */
const BOT = done("WARNING: [youtube] Way9Dexny3w: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies for the authentication.");

beforeEach(() => {
  resetYouTubeGuard();
  workerExtract.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("YouTube bride l'adresse", () => {
  it("un aperçu bloqué n'essaie pas d'autre client, échoue « bloqué » et suspend les aperçus", async () => {
    workerExtract.mockResolvedValue(BOT);
    const result = await extractTrailerSource("Way9Dexny3w", { priority: "preview" });
    expect(result).toMatchObject({ ok: false, blocked: true, permanent: false });
    expect(!result.ok && result.reason).toContain("not a bot");
    expect(workerExtract).toHaveBeenCalledTimes(1);
    expect(previewRefusal()?.kind).toBe("blocked");
  });

  it("une lecture bloquée garde ses passes d'avant — et suspend aussi les aperçus", async () => {
    workerExtract.mockResolvedValue(BOT);
    const result = await extractTrailerSource("Way9Dexny3w");
    expect(result).toMatchObject({ ok: false, blocked: true, permanent: false });
    expect(workerExtract).toHaveBeenCalledTimes(2);
    expect(previewRefusal()?.kind).toBe("blocked");
  });

  it("suspendus, les aperçus ne demandent RIEN à YouTube ; une lecture, si — et son succès les rend", async () => {
    tripYouTubeBreaker("bot");
    workerExtract.mockResolvedValue(done("", HLS_FORMATS));
    expect(await extractTrailerSource("Way9Dexny3w", { priority: "preview" })).toMatchObject({ ok: false, skipped: true });
    expect(workerExtract).not.toHaveBeenCalled();
    expect((await extractTrailerSource("Way9Dexny3w")).ok).toBe(true);
    expect(previewRefusal()).toBeNull();
  });

  it("une vidéo sans format ni message de YouTube n'est pas un blocage", async () => {
    workerExtract.mockResolvedValue(done(""));
    expect(await extractTrailerSource("Way9Dexny3w", { priority: "preview" })).toMatchObject({ ok: false, blocked: false });
    expect(previewRefusal()).toBeNull();
  });
});

describe("budget des aperçus", () => {
  it("compte les extractions d'aperçu, jamais les lectures ; au-delà, rien n'est demandé à YouTube", async () => {
    workerExtract.mockResolvedValue(done("", HLS_FORMATS));
    for (let i = 0; i < PREVIEW_EXTRACTIONS_PER_HOUR; i++) expect((await extractTrailerSource(`video${String(i).padStart(6, "0")}`, { priority: "preview" })).ok).toBe(true);
    expect(await extractTrailerSource("Way9Dexny3w", { priority: "preview" })).toMatchObject({ ok: false, skipped: true, reason: "budget de l'heure épuisé" });
    expect(workerExtract).toHaveBeenCalledTimes(PREVIEW_EXTRACTIONS_PER_HOUR);
    expect((await extractTrailerSource("Way9Dexny3w")).ok).toBe(true);
    expect(previewRefusal()?.kind).toBe("budget");
  });
});
