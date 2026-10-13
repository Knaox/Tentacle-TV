/**
 * La décision d'un aperçu : les candidates essayées dans l'ordre (trois au
 * plus) jusqu'à la première LISIBLE, la mémoire de la décision (trouvée :
 * jusqu'à l'échéance des URL ; aucune bande-annonce : une heure ; aucune
 * lisible : une minute), le partage des demandes simultanées, le seau du
 * compte et le plafond du serveur. Le relais et TMDB sont factices.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedTrailer } from "../trailerRelay";
import type { TitleVideos } from "../titleVideos";

const { relay, fetchTitleVideos } = vi.hoisted(() => ({
  relay: {
    peekTrailer: vi.fn<(ytId: string) => ResolvedTrailer | null>(),
    resolveTrailer: vi.fn<(ytId: string, options?: unknown) => Promise<ResolvedTrailer | null>>(),
    prepareTrailer: vi.fn<(ytId: string, options?: unknown) => Promise<boolean>>(),
    warmStart: vi.fn<(ytId: string) => Promise<void>>(),
  },
  fetchTitleVideos: vi.fn<(id: number, type: string, lang?: string) => Promise<TitleVideos>>(),
}));
vi.mock("../trailerRelay", () => ({ resolveTrailer: relay.resolveTrailer }));
vi.mock("../trailerPrepare", () => ({ peekTrailer: relay.peekTrailer, prepareTrailer: relay.prepareTrailer, warmStart: relay.warmStart }));
vi.mock("../titleVideos", () => ({ fetchTitleVideos }));

import { decidePreview, resetPreviewDecisions } from "./previewDecision";
import type { PreviewTitle } from "./previewTitle";

const NOW = new Date("2026-10-14T20:00:00Z").getTime();
const HOUR = 3600_000;
const title = (n = 1): PreviewTitle => ({ key: `tmdb:movie:${n}`, jellyfin: [], tmdb: { id: n, mediaType: "movie" } });
const trailers = (...ids: string[]): TitleVideos => ({
  videos: ids.map((key) => ({ key, type: "Trailer", site: "YouTube", lang: "fr", url: `https://www.youtube.com/watch?v=${key}` })),
  complete: true,
});
const hls = (validUntil = NOW + 5 * HOUR): ResolvedTrailer => ({ kind: "hls", validUntil, heights: [1080, 720], subtitles: [] });

/** Le relais factice : les vidéos qui s'extraient, celles qui se lisent jusqu'au bout. */
function relayKnows(resolvable: string[], readable = resolvable) {
  relay.resolveTrailer.mockImplementation(async (ytId) => (resolvable.includes(ytId) ? hls() : null));
  relay.prepareTrailer.mockImplementation(async (ytId) => readable.includes(ytId));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  resetPreviewDecisions();
  for (const mock of [...Object.values(relay), fetchTitleVideos]) mock.mockReset();
  relay.peekTrailer.mockReturnValue(null);
  relay.warmStart.mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("essais successifs", () => {
  it("essaie dans l'ordre jusqu'à la première lisible, trois au plus, en aperçu (après les lectures)", async () => {
    fetchTitleVideos.mockResolvedValue(trailers("aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"));
    relayKnows(["bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"], ["ccccccccccc", "ddddddddddd"]);
    const outcome = await decidePreview(title(), "fr", "alice");
    expect(outcome).toEqual({ kind: "found", ytId: "ccccccccccc", resolved: hls() });
    expect(relay.resolveTrailer.mock.calls.map(([id]) => id)).toEqual(["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"]);
    expect(relay.resolveTrailer).toHaveBeenCalledWith("aaaaaaaaaaa", { priority: "preview", budgetMs: 20_000 });
    expect(fetchTitleVideos).toHaveBeenCalledWith(1, "movie", "fr");
    // Le départ au plus haut part dès qu'une vidéo s'extrait, en même temps que sa vérification.
    expect(relay.warmStart.mock.calls).toEqual([["bbbbbbbbbbb"], ["ccccccccccc"]]);
  });

  it("trois échecs : « aucune lisible », la quatrième n'est jamais essayée", async () => {
    fetchTitleVideos.mockResolvedValue(trailers("aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"));
    relayKnows(["ddddddddddd"]);
    expect(await decidePreview(title(), "fr", "alice")).toEqual({ kind: "refused", error: "unavailable" });
    expect(relay.resolveTrailer).toHaveBeenCalledTimes(3);
  });
});

describe("mémoire de la décision", () => {
  it("trouvée : servie telle quelle tant que le relais la tient, jusqu'à l'échéance des URL", async () => {
    fetchTitleVideos.mockResolvedValue(trailers("aaaaaaaaaaa"));
    relayKnows(["aaaaaaaaaaa"]);
    await decidePreview(title(), "fr", "alice");
    relay.peekTrailer.mockReturnValue(hls());
    expect(await decidePreview(title(), "fr", "bob")).toMatchObject({ kind: "found", ytId: "aaaaaaaaaaa" });
    expect(fetchTitleVideos).toHaveBeenCalledTimes(1);
    expect(relay.resolveTrailer).toHaveBeenCalledTimes(1);
    // Ses premiers segments repartent pour ce lecteur-ci (sans effet s'ils sont encore en mémoire).
    expect(relay.warmStart).toHaveBeenLastCalledWith("aaaaaaaaaaa");
    // Passé l'échéance, la décision se reprend.
    vi.setSystemTime(NOW + 5 * HOUR + 1);
    await decidePreview(title(), "fr", "alice");
    expect(fetchTitleVideos).toHaveBeenCalledTimes(2);
  });

  it("le relais l'a oubliée : reprise par la vidéo connue, sans relire TMDB", async () => {
    fetchTitleVideos.mockResolvedValue(trailers("aaaaaaaaaaa"));
    relayKnows(["aaaaaaaaaaa"]);
    await decidePreview(title(), "fr", "alice");
    expect(await decidePreview(title(), "fr", "alice")).toMatchObject({ kind: "found", ytId: "aaaaaaaaaaa" });
    expect(fetchTitleVideos).toHaveBeenCalledTimes(1);
    expect(relay.resolveTrailer).toHaveBeenCalledTimes(2);
  });

  it("aucune bande-annonce : gardé une heure ; une par langue", async () => {
    fetchTitleVideos.mockResolvedValue({ videos: [], complete: true });
    expect(await decidePreview(title(), "fr", "alice")).toEqual({ kind: "refused", error: "no_trailer" });
    vi.setSystemTime(NOW + HOUR - 1);
    expect(await decidePreview(title(), "fr", "alice")).toEqual({ kind: "refused", error: "no_trailer" });
    expect(fetchTitleVideos).toHaveBeenCalledTimes(1);
    await decidePreview(title(), "en", "alice");
    expect(fetchTitleVideos).toHaveBeenCalledTimes(2);
    vi.setSystemTime(NOW + HOUR + 1);
    await decidePreview(title(), "fr", "alice");
    expect(fetchTitleVideos).toHaveBeenCalledTimes(3);
  });

  it("aucune lisible, ou TMDB muet : gardé une minute seulement", async () => {
    fetchTitleVideos.mockResolvedValue({ videos: [], complete: false });
    expect(await decidePreview(title(), "fr", "alice")).toEqual({ kind: "refused", error: "unavailable" });
    vi.setSystemTime(NOW + 59_000);
    await decidePreview(title(), "fr", "alice");
    expect(fetchTitleVideos).toHaveBeenCalledTimes(1);
    vi.setSystemTime(NOW + 61_000);
    await decidePreview(title(), "fr", "alice");
    expect(fetchTitleVideos).toHaveBeenCalledTimes(2);
  });

  it("une décision qui lève une erreur vaut « aucune lisible »", async () => {
    fetchTitleVideos.mockRejectedValue(new Error("imprévu"));
    expect(await decidePreview(title(), "fr", "alice")).toEqual({ kind: "refused", error: "unavailable" });
  });
});

describe("demandes simultanées, seau et plafond", () => {
  it("deux demandes simultanées du même titre partagent une décision", async () => {
    fetchTitleVideos.mockResolvedValue(trailers("aaaaaaaaaaa"));
    relayKnows(["aaaaaaaaaaa"]);
    const [a, b] = await Promise.all([decidePreview(title(), "fr", "alice"), decidePreview(title(), "fr", "bob")]);
    expect(a).toEqual(b);
    expect(fetchTitleVideos).toHaveBeenCalledTimes(1);
    expect(relay.resolveTrailer).toHaveBeenCalledTimes(1);
  });

  it("le seau du compte : six décisions d'affilée, la septième attend ; une décision gardée ne coûte rien", async () => {
    fetchTitleVideos.mockResolvedValue({ videos: [], complete: true });
    for (let n = 1; n <= 6; n++) expect((await decidePreview(title(n), "fr", "alice")).kind).toBe("refused");
    expect(await decidePreview(title(7), "fr", "alice")).toEqual({ kind: "limited", retryAfterS: 5 });
    expect((await decidePreview(title(1), "fr", "alice")).kind).toBe("refused");
    expect((await decidePreview(title(7), "fr", "bob")).kind).toBe("refused");
  });

  it("le plafond du serveur : au-delà de quatre décisions en cours, « réessayez » — la même demande se joint", async () => {
    const gates: Array<(v: TitleVideos) => void> = [];
    fetchTitleVideos.mockImplementation(() => new Promise((resolve) => gates.push(resolve)));
    const pending = [1, 2, 3, 4].map((n) => decidePreview(title(n), "fr", `user${n}`));
    expect(await decidePreview(title(5), "fr", "user5")).toEqual({ kind: "limited", retryAfterS: 2 });
    const joined = decidePreview(title(1), "fr", "user5");
    for (const open of gates) open({ videos: [], complete: true });
    expect((await Promise.all([...pending, joined])).map((o) => o.kind)).toEqual(["refused", "refused", "refused", "refused", "refused"]);
    expect(fetchTitleVideos).toHaveBeenCalledTimes(4);
  });
});
