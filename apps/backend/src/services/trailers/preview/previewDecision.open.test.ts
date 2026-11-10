/**
 * La décision d'un aperçu pour un lecteur SANS H.264 ni AAC (le bureau CEF,
 * `open/delivery.ts`) : les entrées LIBRES du relais (`o:<id>`), jamais
 * Dailymotion, et une décision à part de celle des autres clients.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedTrailer } from "../trailerRelay";
import type { TrailerCatalogResponse, TrailerEntry } from "../../../trailers/trailerCatalog";

const { relay, buildCatalog } = vi.hoisted(() => ({
  relay: {
    holdsSource: vi.fn<(ref: string) => boolean>(),
    peekTrailer: vi.fn<(ref: string) => ResolvedTrailer | null>(),
    resolveTrailer: vi.fn<(ref: string, options?: unknown) => Promise<ResolvedTrailer | null>>(),
    prepareTrailer: vi.fn<(ref: string, options?: unknown) => Promise<boolean>>(),
    warmStart: vi.fn<(ref: string) => Promise<void>>(),
  },
  buildCatalog: vi.fn<(request: unknown, account: string) => Promise<TrailerCatalogResponse>>(),
}));
vi.mock("../trailerRelay", () => ({ resolveTrailer: relay.resolveTrailer }));
vi.mock("../trailerPrepare", () => ({
  holdsSource: relay.holdsSource, peekTrailer: relay.peekTrailer, prepareTrailer: relay.prepareTrailer, warmStart: relay.warmStart,
}));
vi.mock("../catalog/catalogBuild", () => ({ buildCatalog }));
vi.mock("../ytExtract", () => ({ prewarmExtraction: () => undefined }));

import { resetYouTubeGuard } from "../youtubeGuard";
import { previewCandidates } from "./previewCandidates";
import { decidePreview, resetPreviewDecisions, type PreviewTarget } from "./previewDecision";
import { decisionKey } from "./previewSteps";

const NOW = new Date("2026-11-10T16:00:00Z").getTime();
const TITLE: PreviewTarget = { key: "tmdb:movie:1", catalog: { tmdbId: 1, mediaType: "movie" } };
const youtube = (ytId: string): TrailerEntry => ({ scope: { kind: "movie" }, playback: { kind: "youtube", ytId }, name: ytId, version: "localized", type: "trailer", source: "tmdb" });
const allocine: TrailerEntry = { scope: { kind: "movie" }, playback: { kind: "dailymotion", videoId: "x8e90ff" }, name: "AlloCiné", version: "localized", type: "trailer", source: "allocine" };
const hls = (): ResolvedTrailer => ({ kind: "hls", validUntil: NOW + 5 * 3600_000, heights: [1080, 720], subtitles: [] });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  resetPreviewDecisions();
  resetYouTubeGuard();
  for (const mock of [...Object.values(relay), buildCatalog]) mock.mockReset();
  relay.peekTrailer.mockReturnValue(null);
  relay.holdsSource.mockReturnValue(false);
  relay.warmStart.mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("un aperçu en codecs libres", () => {
  it("essaie l'entrée libre de chaque vidéo YouTube, jamais Dailymotion", () => {
    const entries = [allocine, youtube("aaaaaaaaaaa"), youtube("bbbbbbbbbbb")];
    expect(previewCandidates(entries, { dailymotion: true, open: true }).map((c) => [c.ref, c.youtube])).toEqual([
      ["o:aaaaaaaaaaa", true], ["o:bbbbbbbbbbb", true],
    ]);
    // Les autres clients n'ont pas bougé.
    expect(previewCandidates(entries, { dailymotion: true }).map((c) => c.ref)).toEqual(["dm:x8e90ff", "aaaaaaaaaaa", "bbbbbbbbbbb"]);
    expect(previewCandidates(entries, { dailymotion: false }).map((c) => c.ref)).toEqual(["aaaaaaaaaaa", "bbbbbbbbbbb"]);
  });

  it("sa décision est à part : la clé le dit, et celle d'un client H.264 ne lui sert pas", async () => {
    expect(decisionKey(TITLE, "fr", false)).toBe("tmdb:movie:1|fr|r6");
    expect(decisionKey(TITLE, "fr", true)).toBe("tmdb:movie:1|fr|r6|dm");
    expect(decisionKey(TITLE, "fr", true, true)).toBe("tmdb:movie:1|fr|r6|o");

    buildCatalog.mockResolvedValue({ entries: [youtube("aaaaaaaaaaa")], complete: true, language: "fr" });
    relay.resolveTrailer.mockResolvedValue(hls());
    relay.prepareTrailer.mockResolvedValue(true);
    const h264 = await decidePreview(TITLE, "fr", "compte");
    expect(h264).toMatchObject({ kind: "found", ref: "aaaaaaaaaaa" });
    const open = await decidePreview(TITLE, "fr", "compte", { open: true });
    expect(open).toMatchObject({ kind: "found", ref: "o:aaaaaaaaaaa" });
    expect(relay.resolveTrailer.mock.calls.map(([ref]) => ref)).toEqual(["aaaaaaaaaaa", "o:aaaaaaaaaaa"]);
  });

  it("une vidéo sans flux libre laisse sa chance à la suivante ; aucune : « aucune lisible »", async () => {
    buildCatalog.mockResolvedValue({ entries: [youtube("aaaaaaaaaaa"), youtube("bbbbbbbbbbb")], complete: true, language: "fr" });
    relay.resolveTrailer.mockImplementation(async (ref) => (ref === "o:bbbbbbbbbbb" ? hls() : null));
    relay.prepareTrailer.mockResolvedValue(true);
    expect(await decidePreview(TITLE, "fr", "compte", { open: true })).toMatchObject({ kind: "found", ref: "o:bbbbbbbbbbb" });

    resetPreviewDecisions();
    relay.resolveTrailer.mockResolvedValue(null);
    expect(await decidePreview(TITLE, "fr", "compte", { open: true })).toEqual({ kind: "refused", error: "unavailable" });
  });

  it("un titre qui n'a qu'une bande-annonce AlloCiné n'a rien à montrer à ce lecteur", async () => {
    buildCatalog.mockResolvedValue({ entries: [allocine], complete: true, language: "fr" });
    expect(await decidePreview(TITLE, "fr", "compte", { open: true, dailymotion: true })).toEqual({ kind: "refused", error: "no_trailer" });
    expect(relay.resolveTrailer).not.toHaveBeenCalled();
  });
});
