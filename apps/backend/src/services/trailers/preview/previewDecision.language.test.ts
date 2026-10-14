/**
 * La décision d'un aperçu et la LANGUE : une VO trouvée après l'échec d'une
 * VF ne se garde que dix minutes (le survol suivant redonne sa chance à la
 * VF) ; la VF trouvée d'emblée se garde jusqu'à l'échéance des URL. Le
 * relais et TMDB sont factices.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedTrailer } from "../trailerRelay";
import type { TitleVideos } from "../titleVideos";

const { relay, fetchTitleVideos } = vi.hoisted(() => ({
  relay: {
    resolveTrailer: vi.fn<(ytId: string, options?: unknown) => Promise<ResolvedTrailer | null>>(),
    prepareTrailer: vi.fn<(ytId: string, options?: unknown) => Promise<boolean>>(),
  },
  fetchTitleVideos: vi.fn<(id: number, type: string, lang?: string) => Promise<TitleVideos>>(),
}));
vi.mock("../trailerRelay", () => ({ resolveTrailer: relay.resolveTrailer }));
vi.mock("../trailerPrepare", () => ({
  holdsSource: () => false, peekTrailer: () => null, prepareTrailer: relay.prepareTrailer, warmStart: async () => undefined,
}));
vi.mock("../titleVideos", () => ({ fetchTitleVideos }));
vi.mock("../ytExtract", () => ({ prewarmExtraction: () => undefined }));

import { resetYouTubeGuard } from "../youtubeGuard";
import { decidePreview, resetPreviewDecisions, storedDecisions } from "./previewDecision";
import type { PreviewTitle } from "./previewTitle";

const NOW = new Date("2026-10-14T20:00:00Z").getTime();
const MINUTE = 60_000;
const title: PreviewTitle = { key: "tmdb:movie:1", jellyfin: [], tmdb: { id: 1, mediaType: "movie" } };
const video = (key: string, name: string, lang: string) => ({ key, name, type: "Trailer", site: "YouTube", lang, url: `https://www.youtube.com/watch?v=${key}` });
const VF = video("vfTrailer01", "Bande-annonce VF", "fr");
const VOST = video("vostTrail01", "Bande-annonce VOST", "fr");
const EN = video("enTrailer01", "Official Trailer", "en");
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
  fetchTitleVideos.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("aperçu › la langue", () => {
  it("la VF d'abord, même quand TMDB rend la VO avant", async () => {
    fetchTitleVideos.mockResolvedValue({ videos: [EN, VOST, VF], complete: true });
    relayKnows(["vfTrailer01", "vostTrail01", "enTrailer01"]);
    expect(await decidePreview(title, "fr", "alice")).toMatchObject({ kind: "found", ytId: "vfTrailer01" });
    expect(storedDecisions()[0].until).toBe(hls.validUntil);
  });

  it("la VF a échoué : la VOSTFR est servie, mais gardée dix minutes seulement, puis la VF réessayée", async () => {
    fetchTitleVideos.mockResolvedValue({ videos: [VF, VOST, EN], complete: true });
    relayKnows(["vostTrail01", "enTrailer01"]);
    expect(await decidePreview(title, "fr", "alice")).toMatchObject({ kind: "found", ytId: "vostTrail01" });
    expect(storedDecisions()[0].until).toBe(NOW + 10 * MINUTE);
    relayKnows(["vfTrailer01", "vostTrail01", "enTrailer01"]);
    vi.setSystemTime(NOW + 10 * MINUTE + 1);
    expect(await decidePreview(title, "fr", "alice")).toMatchObject({ kind: "found", ytId: "vfTrailer01" });
  });

  it("serveur en anglais : la VO anglaise d'abord", async () => {
    fetchTitleVideos.mockResolvedValue({ videos: [VF, EN], complete: true });
    relayKnows(["vfTrailer01", "enTrailer01"]);
    expect(await decidePreview(title, "en", "alice")).toMatchObject({ kind: "found", ytId: "enTrailer01" });
  });

  it("la clé porte la version des règles : une décision d'avant ne se sert plus", async () => {
    fetchTitleVideos.mockResolvedValue({ videos: [VF], complete: true });
    relayKnows(["vfTrailer01"]);
    await decidePreview(title, "fr", "alice");
    expect(storedDecisions().map((d) => d.key)).toEqual(["tmdb:movie:1|fr|r2"]);
  });
});
