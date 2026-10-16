/**
 * La décision d'un aperçu face au DOUBLAGE PAR IA : une vidéo que TMDB dit
 * « VF » mais dont on entend l'originale anglaise (le relais retire le
 * doublage automatique) n'est pas une VF — ni dans l'étiquette rendue, ni
 * dans le choix : une vraie VF plus loin dans le catalogue passe devant ; à
 * défaut, la vidéo sert sous sa vraie version. Relais et catalogue factices.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedTrailer } from "../trailerRelay";
import type { TrailerAudio, TrailerCatalogResponse, TrailerEntry } from "../../../trailers/trailerCatalog";

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
import { decidePreview, resetPreviewDecisions, storedDecisions, type PreviewTarget } from "./previewDecision";

const NOW = new Date("2026-10-16T12:00:00Z").getTime();
const MINUTE = 60_000;
const title: PreviewTarget = { key: "tmdb:movie:7", catalog: { tmdbId: 7, mediaType: "movie" } };
const video = (ytId: string, version: TrailerEntry["version"], source: TrailerEntry["source"] = "tmdb"): TrailerEntry => ({
  scope: { kind: "movie" }, playback: { kind: "youtube", ytId }, name: ytId, version, type: "trailer", source,
});
const catalog = (...entries: TrailerEntry[]): TrailerCatalogResponse => ({ entries, complete: true, language: "fr" });
const resolved = (audio?: TrailerAudio): ResolvedTrailer => ({
  kind: "hls", validUntil: NOW + 5 * 60 * MINUTE, heights: [1080], subtitles: [], ...(audio ? { audio } : {}),
});
const ENGLISH: TrailerAudio = { content: "original", lang: "en-US" };
const FRENCH_DUB: TrailerAudio = { content: "dubbed", lang: "fr" };

/** `vfAiDubbed1` : « VF » selon TMDB, l'originale anglaise une fois le doublage automatique retiré. */
function relayHears(audio: Record<string, TrailerAudio | undefined>) {
  relay.resolveTrailer.mockImplementation(async (ytId) => (ytId in audio ? resolved(audio[ytId]) : null));
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

describe("aperçu › doublage par IA", () => {
  it("une « VF » qu'on entend en anglais est rendue comme VO quand rien de mieux n'existe", async () => {
    buildCatalog.mockResolvedValue(catalog(video("vfAiDubbed1", "localized")));
    relayHears({ vfAiDubbed1: ENGLISH });
    expect(await decidePreview(title, "fr", "alice")).toMatchObject({ kind: "found", ref: "vfAiDubbed1", version: "original" });
    expect(storedDecisions()[0].decision).toMatchObject({ version: "original" });
  });

  it("une vraie VF plus loin dans le catalogue passe devant la fausse", async () => {
    buildCatalog.mockResolvedValue(catalog(video("vfAiDubbed1", "localized"), video("vfRealDub01", "localized"), video("enTrailer01", "original")));
    relayHears({ vfAiDubbed1: ENGLISH, vfRealDub01: undefined, enTrailer01: ENGLISH });
    expect(await decidePreview(title, "fr", "alice")).toMatchObject({ kind: "found", ref: "vfRealDub01", version: "localized" });
    expect(relay.resolveTrailer).not.toHaveBeenCalledWith("enTrailer01", expect.anything());
  });

  it("une VO plus loin ne vaut pas mieux que la fausse VF : la première sert, sans essai de plus", async () => {
    buildCatalog.mockResolvedValue(catalog(video("vfAiDubbed1", "localized"), video("enTrailer01", "original")));
    relayHears({ vfAiDubbed1: ENGLISH, enTrailer01: ENGLISH });
    expect(await decidePreview(title, "fr", "alice")).toMatchObject({ kind: "found", ref: "vfAiDubbed1", version: "original" });
    expect(relay.resolveTrailer).toHaveBeenCalledTimes(1);
    // Une langue de repli : gardée dix minutes, la VF peut revenir.
    expect(storedDecisions()[0].until).toBe(NOW + 10 * MINUTE);
  });

  it("un doublage HUMAIN en français reste une VF", async () => {
    buildCatalog.mockResolvedValue(catalog(video("enMultiAud1", "original")));
    relayHears({ enMultiAud1: FRENCH_DUB });
    expect(await decidePreview(title, "fr", "alice")).toMatchObject({ kind: "found", ref: "enMultiAud1", version: "localized" });
  });

  it("une vidéo à une seule piste garde la version du catalogue", async () => {
    buildCatalog.mockResolvedValue(catalog(video("vfTrailer01", "localized")));
    relayHears({ vfTrailer01: undefined });
    expect(await decidePreview(title, "fr", "alice")).toMatchObject({ kind: "found", ref: "vfTrailer01", version: "localized" });
  });
});
