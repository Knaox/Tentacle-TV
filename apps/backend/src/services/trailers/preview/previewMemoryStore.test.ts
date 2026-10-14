/**
 * La mémoire des aperçus à travers un redémarrage : décisions et sources du
 * relais écrites quelques secondes après un changement, reprises au
 * démarrage tant qu'elles valent — jamais une échéance passée, jamais une
 * ligne illisible, et un fichier abîmé ne coûte qu'un départ à vide.
 */

import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "../ytExtract";

const { extractTrailerSource } = vi.hoisted(() => ({ extractTrailerSource: vi.fn<(ytId: string, options?: unknown) => Promise<ExtractionResult>>() }));
vi.mock("../ytExtract", () => ({ extractTrailerSource, prewarmExtraction: () => undefined }));

import { heldSources, resetTrailerRelay, resolveTrailer, restoreSources, type HeldSource } from "../trailerRelay";
import { resetPreviewDecisions, restoreDecisions, storedDecisions } from "./previewDecision";
import { flushPreviewMemory, resetPreviewMemory, savePendingPreviewMemory, startPreviewMemory } from "./previewMemoryStore";

const NOW = Date.now();
const SOURCE: HeldSource = {
  ytId: "Way9Dexny3w",
  source: { kind: "hls", masterUrl: "https://manifest.googlevideo.test/expire/1/index.m3u8", headers: {}, expiresAt: NOW + 6 * 3600_000, heights: [1080, 720] },
  subtitles: [],
  validUntil: NOW + 5 * 3600_000,
  extractedAt: NOW - 60_000,
};
const FOUND = { key: "jf:9308c1b5ece4cbf0b59e051a6f680d6b|fr", decision: { kind: "found" as const, ytId: "Way9Dexny3w" }, until: NOW + 5 * 3600_000 };
const NONE = { key: "jf:7742d8ba75b19323faf1a2be0af2a1b8|fr", decision: { kind: "refused" as const, error: "no_trailer" as const }, until: NOW + 3600_000 };

let file = "";

/** Un « redémarrage » : la mémoire du processus vidée, la mémoire durable relue. */
function restart(): void {
  resetTrailerRelay();
  resetPreviewDecisions();
  resetPreviewMemory();
  startPreviewMemory(file);
}

beforeEach(() => {
  file = join(mkdtempSync(join(tmpdir(), "preview-memory-")), "trailers", "preview-memory.json");
  resetTrailerRelay();
  resetPreviewDecisions();
  resetPreviewMemory();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  resetPreviewMemory();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("mémoire des aperçus", () => {
  it("décisions et sources écrites, puis reprises après un redémarrage — rien à extraire de nouveau", async () => {
    startPreviewMemory(file);
    restoreSources([SOURCE]);
    restoreDecisions([FOUND, NONE]);
    flushPreviewMemory(file);
    restart();
    expect(heldSources().map((s) => s.ytId)).toEqual(["Way9Dexny3w"]);
    expect(storedDecisions().map((d) => d.key).sort()).toEqual([FOUND.key, NONE.key].sort());
    expect(await resolveTrailer("Way9Dexny3w")).toMatchObject({ kind: "hls", heights: [1080, 720] });
    expect(extractTrailerSource).not.toHaveBeenCalled();
  });

  it("une extraction programme l'écriture, quelques secondes plus tard", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    extractTrailerSource.mockResolvedValue({ ok: true, clients: ["visionos"], subtitles: [], source: SOURCE.source });
    startPreviewMemory(file);
    await resolveTrailer("Way9Dexny3w");
    expect(() => readFileSync(file)).toThrow();
    vi.advanceTimersByTime(5_000);
    expect(JSON.parse(readFileSync(file, "utf8")).sources.map((s: HeldSource) => s.ytId)).toEqual(["Way9Dexny3w"]);
  });

  it("à l'arrêt du serveur, l'écriture en attente part tout de suite — rien de la rafale ne se perd", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    extractTrailerSource.mockResolvedValue({ ok: true, clients: ["visionos"], subtitles: [], source: SOURCE.source });
    startPreviewMemory(file);
    // Rien en attente : rien à écrire.
    savePendingPreviewMemory();
    expect(() => readFileSync(file)).toThrow();
    await resolveTrailer("Way9Dexny3w");
    savePendingPreviewMemory();
    expect(JSON.parse(readFileSync(file, "utf8")).sources.map((s: HeldSource) => s.ytId)).toEqual(["Way9Dexny3w"]);
  });

  it("une échéance passée ne revient pas ; une ligne illisible non plus", () => {
    startPreviewMemory(file);
    flushPreviewMemory(file);
    const snapshot = JSON.parse(readFileSync(file, "utf8"));
    snapshot.sources = [{ ...SOURCE, validUntil: NOW - 1 }, { ...SOURCE, ytId: "pas un id" }, { ...SOURCE, ytId: "abcdefghijk" }];
    snapshot.decisions = [{ ...FOUND, until: NOW - 1 }, { key: "x", decision: { kind: "found", ytId: "?" }, until: NOW + 1_000 }, NONE];
    writeFileSync(file, JSON.stringify(snapshot));
    restart();
    expect(heldSources().map((s) => s.ytId)).toEqual(["abcdefghijk"]);
    expect(storedDecisions().map((d) => d.key)).toEqual([NONE.key]);
  });

  it("au démarrage, le fichier est réécrit sans ses lignes échues", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    startPreviewMemory(file);
    flushPreviewMemory(file);
    const snapshot = JSON.parse(readFileSync(file, "utf8"));
    snapshot.sources = [{ ...SOURCE, validUntil: NOW - 1 }, SOURCE];
    snapshot.decisions = [{ ...FOUND, until: NOW - 1 }, NONE];
    writeFileSync(file, JSON.stringify(snapshot));
    restart();
    vi.advanceTimersByTime(5_000);
    const rewritten = JSON.parse(readFileSync(file, "utf8"));
    expect([rewritten.sources.length, rewritten.decisions.length]).toEqual([1, 1]);
  });

  it("un fichier abîmé, ou d'une autre version : on repart de rien, sans erreur", () => {
    startPreviewMemory(file);
    flushPreviewMemory(file);
    writeFileSync(file, "{ pas du json");
    expect(() => restart()).not.toThrow();
    writeFileSync(file, JSON.stringify({ version: 99, sources: [SOURCE], decisions: [FOUND] }));
    restart();
    expect(heldSources()).toEqual([]);
    expect(storedDecisions()).toEqual([]);
  });
});
