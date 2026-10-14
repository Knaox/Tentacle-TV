/**
 * Personne n'attend une décision d'aperçu plus de douze secondes (sous les
 * 15 s du client) : au-delà, « réessayez dans une seconde », et la décision
 * continue — la demande suivante la REJOINT, sans puiser dans le seau du
 * compte. Une décision que plus personne n'attend ne compte plus dans le
 * plafond du serveur. Le relais et TMDB sont factices.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedTrailer } from "../trailerRelay";
import type { TrailerCatalogResponse } from "../../../trailers/trailerCatalog";

const { resolveTrailer, buildCatalog } = vi.hoisted(() => ({
  resolveTrailer: vi.fn<(ytId: string, options?: { wanted?: () => boolean }) => Promise<ResolvedTrailer | null>>(),
  buildCatalog: vi.fn<(request: unknown, account: string) => Promise<TrailerCatalogResponse>>(),
}));
vi.mock("../trailerRelay", () => ({ resolveTrailer }));
vi.mock("../trailerPrepare", () => ({
  holdsSource: () => false, peekTrailer: () => null, prepareTrailer: async () => true, warmStart: async () => undefined,
}));
vi.mock("../catalog/catalogBuild", () => ({ buildCatalog }));
vi.mock("../ytExtract", () => ({ prewarmExtraction: () => undefined }));

import { resetYouTubeGuard } from "../youtubeGuard";
import { decidePreview, resetPreviewDecisions } from "./previewDecision";
import type { PreviewTarget } from "./previewDecision";

const NOW = new Date("2026-10-14T20:00:00Z").getTime();
const title = (n: number): PreviewTarget => ({ key: `tmdb:movie:${n}`, catalog: { tmdbId: n, mediaType: "movie" } });
const videoOf = (n: number) => `vid${String(n).padStart(8, "0")}`;
const hls: ResolvedTrailer = { kind: "hls", validUntil: NOW + 5 * 3600_000, heights: [1080], subtitles: [] };

/** Une extraction qu'on termine à la main. */
function slowRelay() {
  const finish = new Map<string, () => void>();
  const wanted = new Map<string, () => boolean>();
  resolveTrailer.mockImplementation((ytId, options) => {
    if (options?.wanted) wanted.set(ytId, options.wanted);
    return new Promise((resolve) => finish.set(ytId, () => resolve(hls)));
  });
  return { finish, wanted };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  resetPreviewDecisions();
  resetYouTubeGuard();
  resolveTrailer.mockReset();
  buildCatalog.mockReset();
  buildCatalog.mockImplementation(async (request) => {
    const id = Number((request as { tmdbId: number }).tmdbId);
    return {
      entries: [{ scope: { kind: "movie" }, playback: { kind: "youtube", ytId: videoOf(id) }, name: "x", version: "localized", type: "trailer", source: "tmdb" }],
      complete: true,
      language: "fr",
    };
  });
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("aperçu › douze secondes au plus", () => {
  it("passé douze secondes, « réessayez dans une seconde » ; la demande suivante rejoint la décision", async () => {
    const { finish, wanted } = slowRelay();
    const first = decidePreview(title(1), "fr", "alice");
    await vi.advanceTimersByTimeAsync(12_000);
    expect(await first).toEqual({ kind: "limited", retryAfterS: 1 });
    // Plus personne n'attend : l'extraction cède sa place dans la file.
    expect(wanted.get("vid00000001")?.()).toBe(false);

    const again = decidePreview(title(1), "fr", "alice");
    await vi.advanceTimersByTimeAsync(0);
    expect(wanted.get("vid00000001")?.()).toBe(true);
    finish.get("vid00000001")?.();
    expect(await again).toMatchObject({ kind: "found", ref: "vid00000001" });
    // Une seule extraction, une seule lecture de TMDB.
    expect(resolveTrailer).toHaveBeenCalledTimes(1);
    expect(buildCatalog).toHaveBeenCalledTimes(1);
  });

  it("le plafond ne compte que les décisions qu'on attend encore", async () => {
    slowRelay();
    const pending = [1, 2, 3, 4].map((n) => decidePreview(title(n), "fr", `user${n}`));
    await vi.advanceTimersByTimeAsync(0);
    expect(await decidePreview(title(5), "fr", "user5")).toEqual({ kind: "limited", retryAfterS: 2 });
    // Les quatre clients sont partis (douze secondes) : la carte survolée a sa place.
    await vi.advanceTimersByTimeAsync(12_000);
    await Promise.all(pending);
    const fifth = decidePreview(title(5), "fr", "user5");
    await vi.advanceTimersByTimeAsync(0);
    expect(resolveTrailer).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(12_000);
    expect(await fifth).toEqual({ kind: "limited", retryAfterS: 1 });
  });
});
