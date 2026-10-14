/**
 * La décision d'un aperçu et la LANGUE : l'ordre est celui du catalogue (la
 * langue du serveur d'abord, `trailerCatalogRank.ts`) ; une version moins
 * bonne trouvée après l'échec d'une meilleure ne se garde que dix minutes (le
 * survol suivant redonne sa chance à la VF) ; la VF trouvée d'emblée se garde
 * jusqu'à l'échéance des URL. Le relais et le catalogue sont factices.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedTrailer } from "../trailerRelay";
import type { TrailerCatalogResponse, TrailerEntry } from "../../../trailers/trailerCatalog";

const { relay, buildCatalog } = vi.hoisted(() => ({
  relay: {
    resolveTrailer: vi.fn<(ytId: string, options?: unknown) => Promise<ResolvedTrailer | null>>(),
    prepareTrailer: vi.fn<(ytId: string, options?: unknown) => Promise<boolean>>(),
  },
  buildCatalog: vi.fn<(request: unknown, account: string) => Promise<TrailerCatalogResponse>>(),
}));
vi.mock("../trailerRelay", () => ({ resolveTrailer: relay.resolveTrailer }));
vi.mock("../trailerPrepare", () => ({
  holdsSource: () => false, peekTrailer: () => null, prepareTrailer: relay.prepareTrailer, warmStart: async () => undefined,
}));
vi.mock("../catalog/catalogBuild", () => ({ buildCatalog }));
vi.mock("../ytExtract", () => ({ prewarmExtraction: () => undefined }));

import { resetYouTubeGuard } from "../youtubeGuard";
import { decidePreview, resetPreviewDecisions, storedDecisions } from "./previewDecision";
import type { PreviewTarget } from "./previewDecision";

const NOW = new Date("2026-10-14T20:00:00Z").getTime();
const MINUTE = 60_000;
const title: PreviewTarget = { key: "tmdb:movie:1", catalog: { tmdbId: 1, mediaType: "movie" } };
const video = (ytId: string, name: string, version: TrailerEntry["version"]): TrailerEntry => ({
  scope: { kind: "movie" }, playback: { kind: "youtube", ytId }, name, version, type: "trailer", source: "tmdb",
});
const VF = video("vfTrailer01", "Bande-annonce VF", "localized");
const VOST = video("vostTrail01", "Bande-annonce VOST", "subtitled");
const EN = video("enTrailer01", "Official Trailer", "original");
const catalog = (...entries: TrailerEntry[]): TrailerCatalogResponse => ({ entries, complete: true, language: "fr" });
const hls: ResolvedTrailer = { kind: "hls", validUntil: NOW + 5 * 60 * MINUTE, heights: [1080], subtitles: [] };

function relayKnows(readable: string[]) {
  relay.resolveTrailer.mockImplementation(async (ytId) => (readable.includes(ytId) ? hls : null));
  relay.prepareTrailer.mockResolvedValue(true);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  resetPreviewDecisions();
  resetYouTubeGuard();
  relay.resolveTrailer.mockReset();
  relay.prepareTrailer.mockReset();
  buildCatalog.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("aperçu › la langue", () => {
  it("l'ordre du catalogue : la VF en tête, gardée jusqu'à l'échéance des URL", async () => {
    buildCatalog.mockResolvedValue(catalog(VF, VOST, EN));
    relayKnows(["vfTrailer01", "vostTrail01", "enTrailer01"]);
    expect(await decidePreview(title, "fr", "alice")).toMatchObject({ kind: "found", ref: "vfTrailer01" });
    expect(storedDecisions()[0].until).toBe(hls.validUntil);
  });

  it("la VF a échoué : la VOSTFR est servie, mais gardée dix minutes seulement, puis la VF réessayée", async () => {
    buildCatalog.mockResolvedValue(catalog(VF, VOST, EN));
    relayKnows(["vostTrail01", "enTrailer01"]);
    expect(await decidePreview(title, "fr", "alice")).toMatchObject({ kind: "found", ref: "vostTrail01" });
    expect(storedDecisions()[0].until).toBe(NOW + 10 * MINUTE);
    relayKnows(["vfTrailer01", "vostTrail01", "enTrailer01"]);
    vi.setSystemTime(NOW + 10 * MINUTE + 1);
    expect(await decidePreview(title, "fr", "alice")).toMatchObject({ kind: "found", ref: "vfTrailer01" });
  });

  it("la clé porte la version des règles, et le client qui lit Dailymotion a la sienne", async () => {
    buildCatalog.mockResolvedValue(catalog(VF));
    relayKnows(["vfTrailer01"]);
    await decidePreview(title, "fr", "alice");
    await decidePreview(title, "fr", "alice", { dailymotion: true });
    expect(storedDecisions().map((d) => d.key).sort()).toEqual(["tmdb:movie:1|fr|r5", "tmdb:movie:1|fr|r5|dm"]);
  });

  it("une vidéo AlloCiné (Dailymotion) : seulement pour un client qui sait la lire", async () => {
    const allocine: TrailerEntry = { ...VF, playback: { kind: "dailymotion", videoId: "x8abcde" }, source: "allocine" };
    buildCatalog.mockResolvedValue(catalog(allocine, EN));
    relayKnows(["dm:x8abcde", "enTrailer01"]);
    expect(await decidePreview(title, "fr", "alice", { dailymotion: true })).toMatchObject({ kind: "found", ref: "dm:x8abcde" });
    expect(await decidePreview(title, "fr", "alice")).toMatchObject({ kind: "found", ref: "enTrailer01" });
  });
});
