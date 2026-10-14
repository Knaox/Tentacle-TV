/**
 * La décision d'un aperçu : les candidates essayées dans l'ordre (trois au
 * plus) jusqu'à la première LISIBLE, la mémoire de la décision (trouvée :
 * jusqu'à l'échéance des URL ; aucune bande-annonce : une heure ; aucune
 * lisible : dix minutes), le partage des demandes simultanées, le seau du
 * compte et le plafond du serveur. Le relais et TMDB sont factices.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedTrailer } from "../trailerRelay";
import type { TrailerCatalogResponse, TrailerEntry } from "../../../trailers/trailerCatalog";

const { relay, buildCatalog, prewarmExtraction } = vi.hoisted(() => ({
  prewarmExtraction: vi.fn(),
  relay: {
    holdsSource: vi.fn<(ytId: string) => boolean>(),
    peekTrailer: vi.fn<(ytId: string) => ResolvedTrailer | null>(),
    resolveTrailer: vi.fn<(ytId: string, options?: unknown) => Promise<ResolvedTrailer | null>>(),
    prepareTrailer: vi.fn<(ytId: string, options?: unknown) => Promise<boolean>>(),
    warmStart: vi.fn<(ytId: string) => Promise<void>>(),
  },
  buildCatalog: vi.fn<(request: unknown, account: string) => Promise<TrailerCatalogResponse>>(),
}));
vi.mock("../trailerRelay", () => ({ resolveTrailer: relay.resolveTrailer }));
vi.mock("../trailerPrepare", () => ({
  holdsSource: relay.holdsSource, peekTrailer: relay.peekTrailer, prepareTrailer: relay.prepareTrailer, warmStart: relay.warmStart,
}));
vi.mock("../catalog/catalogBuild", () => ({ buildCatalog }));
vi.mock("../ytExtract", () => ({ prewarmExtraction }));

import { countPreviewExtraction, resetYouTubeGuard, tripYouTubeBreaker } from "../youtubeGuard";
import { decidePreview, resetPreviewDecisions } from "./previewDecision";
import type { PreviewTarget } from "./previewDecision";

const NOW = new Date("2026-10-14T20:00:00Z").getTime();
const HOUR = 3600_000;
const title = (n = 1): PreviewTarget => ({ key: `tmdb:movie:${n}`, catalog: { tmdbId: n, mediaType: "movie" } });
const trailers = (...ids: string[]): TrailerCatalogResponse => ({
  entries: ids.map((ytId): TrailerEntry => ({
    scope: { kind: "movie" }, playback: { kind: "youtube", ytId }, name: ytId, version: "localized", type: "trailer", source: "tmdb",
  })),
  complete: true,
  language: "fr",
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

describe("essais successifs", () => {
  it("la saison ne se lit pas : la portée suivante a son tour (trois par portée, cinq en tout)", async () => {
    const entry = (ytId: string, scope: TrailerEntry["scope"]): TrailerEntry => ({
      scope, playback: { kind: "youtube", ytId }, name: ytId, version: "localized", type: "trailer", source: "tmdb",
    });
    const s7 = { kind: "season", season: 7 } as const;
    buildCatalog.mockResolvedValue({
      entries: [entry("s7aaaaaaaaa", s7), entry("s7bbbbbbbbb", s7), entry("s7ccccccccc", s7), entry("s7ddddddddd", s7), entry("s6aaaaaaaaa", { kind: "season", season: 6 })],
      complete: true,
      language: "fr",
    });
    relayKnows(["s7ddddddddd", "s6aaaaaaaaa"]);
    expect(await decidePreview(title(), "fr", "alice")).toMatchObject({ kind: "found", ref: "s6aaaaaaaaa" });
    expect(relay.resolveTrailer.mock.calls.map(([id]) => id)).toEqual(["s7aaaaaaaaa", "s7bbbbbbbbb", "s7ccccccccc", "s6aaaaaaaaa"]);
  });

  it("essaie dans l'ordre jusqu'à la première lisible, trois au plus, en aperçu (après les lectures)", async () => {
    buildCatalog.mockResolvedValue(trailers("aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"));
    relayKnows(["bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"], ["ccccccccccc", "ddddddddddd"]);
    const outcome = await decidePreview(title(), "fr", "alice");
    expect(outcome).toEqual({ kind: "found", ref: "ccccccccccc", resolved: hls(), version: "localized" });
    expect(relay.resolveTrailer.mock.calls.map(([id]) => id)).toEqual(["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"]);
    expect(relay.resolveTrailer).toHaveBeenCalledWith("aaaaaaaaaaa", expect.objectContaining({ priority: "preview", budgetMs: 20_000 }));
    expect(buildCatalog).toHaveBeenCalledWith({ tmdbId: 1, mediaType: "movie" }, "alice");
    // Le départ au plus haut part dès qu'une vidéo s'extrait, en même temps que sa vérification.
    expect(relay.warmStart.mock.calls).toEqual([["bbbbbbbbbbb"], ["ccccccccccc"]]);
  });

  it("trois échecs : « aucune lisible », la quatrième n'est jamais essayée", async () => {
    buildCatalog.mockResolvedValue(trailers("aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"));
    relayKnows(["ddddddddddd"]);
    expect(await decidePreview(title(), "fr", "alice")).toEqual({ kind: "refused", error: "unavailable" });
    expect(relay.resolveTrailer).toHaveBeenCalledTimes(3);
  });
});

describe("mémoire de la décision", () => {
  it("trouvée : servie telle quelle tant que le relais la tient, jusqu'à l'échéance des URL", async () => {
    buildCatalog.mockResolvedValue(trailers("aaaaaaaaaaa"));
    relayKnows(["aaaaaaaaaaa"]);
    prewarmExtraction.mockClear();
    await decidePreview(title(), "fr", "alice");
    // Une décision à prendre : l'ouvrier yt-dlp démarre d'avance ; une décision gardée, non.
    expect(prewarmExtraction).toHaveBeenCalledTimes(1);
    relay.peekTrailer.mockReturnValue(hls());
    expect(await decidePreview(title(), "fr", "bob")).toMatchObject({ kind: "found", ref: "aaaaaaaaaaa" });
    expect(buildCatalog).toHaveBeenCalledTimes(1);
    expect(relay.resolveTrailer).toHaveBeenCalledTimes(1);
    expect(prewarmExtraction).toHaveBeenCalledTimes(1);
    // Ses premiers segments repartent pour ce lecteur-ci (sans effet s'ils sont encore en mémoire).
    expect(relay.warmStart).toHaveBeenLastCalledWith("aaaaaaaaaaa");
    // Passé l'échéance, la décision se reprend.
    vi.setSystemTime(NOW + 5 * HOUR + 1);
    await decidePreview(title(), "fr", "alice");
    expect(buildCatalog).toHaveBeenCalledTimes(2);
  });

  it("le relais l'a oubliée : reprise par la vidéo connue, sans relire TMDB", async () => {
    buildCatalog.mockResolvedValue(trailers("aaaaaaaaaaa"));
    relayKnows(["aaaaaaaaaaa"]);
    await decidePreview(title(), "fr", "alice");
    expect(await decidePreview(title(), "fr", "alice")).toMatchObject({ kind: "found", ref: "aaaaaaaaaaa" });
    expect(buildCatalog).toHaveBeenCalledTimes(1);
    expect(relay.resolveTrailer).toHaveBeenCalledTimes(2);
  });

  it("le relais tient encore la SOURCE (listes relâchées, redémarrage) : reprise sans démarrer l'ouvrier yt-dlp", async () => {
    buildCatalog.mockResolvedValue(trailers("aaaaaaaaaaa"));
    relayKnows(["aaaaaaaaaaa"]);
    await decidePreview(title(), "fr", "alice");
    prewarmExtraction.mockClear();
    // La source est tenue, mais plus « prête » (maître non lu) : aucune extraction ne suivra.
    relay.holdsSource.mockReturnValue(true);
    expect(await decidePreview(title(), "fr", "alice")).toMatchObject({ kind: "found", ref: "aaaaaaaaaaa" });
    expect(prewarmExtraction).not.toHaveBeenCalled();
    expect(buildCatalog).toHaveBeenCalledTimes(1);
  });

  it("une source GARDÉE (redémarrage, révocation) qui ne se lit plus : une extraction neuve, une seule", async () => {
    buildCatalog.mockResolvedValue(trailers("aaaaaaaaaaa"));
    relay.holdsSource.mockReturnValue(true);
    relay.resolveTrailer.mockResolvedValue(hls());
    relay.prepareTrailer.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await decidePreview(title(), "fr", "alice")).toMatchObject({ kind: "found", ref: "aaaaaaaaaaa" });
    expect(relay.resolveTrailer.mock.calls).toEqual([
      ["aaaaaaaaaaa", expect.objectContaining({ priority: "preview", budgetMs: 20_000 })],
      ["aaaaaaaaaaa", expect.objectContaining({ priority: "preview", budgetMs: 20_000, fresh: true })],
    ]);
  });

  it("aucune bande-annonce : gardé une heure ; une par langue", async () => {
    buildCatalog.mockResolvedValue({ entries: [], complete: true, language: "fr" });
    expect(await decidePreview(title(), "fr", "alice")).toEqual({ kind: "refused", error: "no_trailer" });
    vi.setSystemTime(NOW + HOUR - 1);
    expect(await decidePreview(title(), "fr", "alice")).toEqual({ kind: "refused", error: "no_trailer" });
    expect(buildCatalog).toHaveBeenCalledTimes(1);
    await decidePreview(title(), "en", "alice");
    expect(buildCatalog).toHaveBeenCalledTimes(2);
    vi.setSystemTime(NOW + HOUR + 1);
    await decidePreview(title(), "fr", "alice");
    expect(buildCatalog).toHaveBeenCalledTimes(3);
  });

  it("aucune lisible : gardé dix minutes", async () => {
    buildCatalog.mockResolvedValue(trailers("aaaaaaaaaaa"));
    relayKnows([]);
    expect(await decidePreview(title(), "fr", "alice")).toEqual({ kind: "refused", error: "unavailable" });
    vi.setSystemTime(NOW + 10 * 60_000 - 1_000);
    await decidePreview(title(), "fr", "alice");
    expect(buildCatalog).toHaveBeenCalledTimes(1);
    vi.setSystemTime(NOW + 10 * 60_000 + 1_000);
    await decidePreview(title(), "fr", "alice");
    expect(buildCatalog).toHaveBeenCalledTimes(2);
  });

  it("un catalogue encore vide (une source finit en fond) : « réessayez » dans 3 s, rien de retenu", async () => {
    buildCatalog.mockResolvedValue({ entries: [], complete: false, language: "fr" });
    expect(await decidePreview(title(), "fr", "alice")).toEqual({ kind: "limited", retryAfterS: 3 });
    await decidePreview(title(), "fr", "alice");
    expect(buildCatalog).toHaveBeenCalledTimes(2);
  });

  it("une décision qui lève une erreur vaut « aucune lisible »", async () => {
    buildCatalog.mockRejectedValue(new Error("imprévu"));
    expect(await decidePreview(title(), "fr", "alice")).toEqual({ kind: "refused", error: "unavailable" });
  });
});

describe("demandes simultanées, seau et plafond", () => {
  it("deux demandes simultanées du même titre partagent une décision", async () => {
    buildCatalog.mockResolvedValue(trailers("aaaaaaaaaaa"));
    relayKnows(["aaaaaaaaaaa"]);
    const [a, b] = await Promise.all([decidePreview(title(), "fr", "alice"), decidePreview(title(), "fr", "bob")]);
    expect(a).toEqual(b);
    expect(buildCatalog).toHaveBeenCalledTimes(1);
    expect(relay.resolveTrailer).toHaveBeenCalledTimes(1);
  });

  it("le seau du compte : dix décisions d'affilée, la onzième attend ; une décision gardée ne coûte rien", async () => {
    buildCatalog.mockResolvedValue({ entries: [], complete: true, language: "fr" });
    for (let n = 1; n <= 10; n++) expect((await decidePreview(title(n), "fr", "alice")).kind).toBe("refused");
    expect(await decidePreview(title(11), "fr", "alice")).toEqual({ kind: "limited", retryAfterS: 3 });
    expect((await decidePreview(title(1), "fr", "alice")).kind).toBe("refused");
    expect((await decidePreview(title(11), "fr", "bob")).kind).toBe("refused");
  });

  it("le plafond du serveur : au-delà de quatre décisions en cours, « réessayez » — la même demande se joint", async () => {
    const gates: Array<(v: TrailerCatalogResponse) => void> = [];
    buildCatalog.mockImplementation(() => new Promise((resolve) => gates.push(resolve)));
    const pending = [1, 2, 3, 4].map((n) => decidePreview(title(n), "fr", `user${n}`));
    expect(await decidePreview(title(5), "fr", "user5")).toEqual({ kind: "limited", retryAfterS: 2 });
    const joined = decidePreview(title(1), "fr", "user5");
    for (const open of gates) open({ entries: [], complete: true, language: "fr" });
    expect((await Promise.all([...pending, joined])).map((o) => o.kind)).toEqual(["refused", "refused", "refused", "refused", "refused"]);
    expect(buildCatalog).toHaveBeenCalledTimes(4);
  });
});

describe("YouTube bride l'adresse (garde-fou réel, relais simulé)", () => {
  it("suspendu : « aucune lisible » tout de suite, sans TMDB ni seau — et rien de retenu par titre", async () => {
    buildCatalog.mockResolvedValue(trailers("aaaaaaaaaaa"));
    relayKnows(["aaaaaaaaaaa"]);
    tripYouTubeBreaker("bot");
    for (let n = 0; n < 10; n++) expect(await decidePreview(title(), "fr", "alice")).toEqual({ kind: "refused", error: "unavailable" });
    expect(buildCatalog).not.toHaveBeenCalled();
    expect(relay.resolveTrailer).not.toHaveBeenCalled();
    // La suspension levée, la décision se prend aussitôt : le refus n'était pas retenu pour le titre.
    resetYouTubeGuard();
    expect(await decidePreview(title(), "fr", "alice")).toMatchObject({ kind: "found", ref: "aaaaaaaaaaa" });
  });

  it("une candidate tombée sur la vérification n'est pas une candidate morte : on n'essaie pas la suivante", async () => {
    buildCatalog.mockResolvedValue(trailers("aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"));
    relay.resolveTrailer.mockImplementation(async () => {
      tripYouTubeBreaker("bot");
      return null;
    });
    expect(await decidePreview(title(), "fr", "alice")).toEqual({ kind: "refused", error: "unavailable" });
    expect(relay.resolveTrailer).toHaveBeenCalledTimes(1);
    resetYouTubeGuard();
    relayKnows(["aaaaaaaaaaa"]);
    expect(await decidePreview(title(), "fr", "alice")).toMatchObject({ kind: "found", ref: "aaaaaaaaaaa" });
  });

  it("budget de l'heure épuisé : « réessayez » dans le délai honnête, sans TMDB", async () => {
    for (let i = 0; i < 30; i++) countPreviewExtraction(NOW - 20 * 60_000);
    expect(await decidePreview(title(), "fr", "alice")).toEqual({ kind: "limited", retryAfterS: 40 * 60 });
    expect(buildCatalog).not.toHaveBeenCalled();
  });

  it("une bande-annonce déjà décidée, que le relais tient encore, se sert pendant une suspension", async () => {
    buildCatalog.mockResolvedValue(trailers("aaaaaaaaaaa"));
    relayKnows(["aaaaaaaaaaa"]);
    await decidePreview(title(), "fr", "alice");
    tripYouTubeBreaker("bot");
    relay.peekTrailer.mockReturnValue(hls());
    expect(await decidePreview(title(), "fr", "bob")).toMatchObject({ kind: "found", ref: "aaaaaaaaaaa" });
  });

  it("une décision dont le relais tient la SOURCE (redémarrage) se reprend pendant une suspension — sans TMDB ni extraction", async () => {
    buildCatalog.mockResolvedValue(trailers("aaaaaaaaaaa"));
    relayKnows(["aaaaaaaaaaa"]);
    await decidePreview(title(), "fr", "alice");
    tripYouTubeBreaker("bot");
    relay.holdsSource.mockReturnValue(true);
    expect(await decidePreview(title(), "fr", "bob")).toMatchObject({ kind: "found", ref: "aaaaaaaaaaa" });
    expect(buildCatalog).toHaveBeenCalledTimes(1);
    // Elle ne se lit plus : l'extraction neuve est refusée par la suspension — « aucune lisible », rien de retenu.
    relay.prepareTrailer.mockResolvedValue(false);
    relay.resolveTrailer.mockImplementation(async (_id, options) => ((options as { fresh?: boolean }).fresh ? null : hls()));
    expect(await decidePreview(title(), "fr", "bob")).toEqual({ kind: "refused", error: "unavailable" });
    expect(buildCatalog).toHaveBeenCalledTimes(1);
    resetYouTubeGuard();
    relayKnows(["aaaaaaaaaaa"]);
    expect(await decidePreview(title(), "fr", "bob")).toMatchObject({ kind: "found", ref: "aaaaaaaaaaa" });
  });
});
