import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rows = new Map<string, { payload: unknown; generatedAt: Date; expiresAt: Date }>();
vi.mock("../../globalCacheStore", () => ({
  readGlobalCache: async (key: string) => rows.get(key) ?? null,
  writeGlobalCache: async (key: string, payload: unknown, ttlMs: number) =>
    void rows.set(key, { payload, generatedAt: new Date(), expiresAt: new Date(Date.now() + ttlMs) }),
}));

import { resetDailymotionGuard } from "../dailymotionGuard";
import { allocineCacheKey, resetAllocineSearches, searchAllocineVideos } from "./allocineSearch";

const page = (name: string) => readFileSync(join(__dirname, "fixtures", `${name}.json`), "utf8");
const fetchMock = vi.fn();

beforeEach(() => {
  rows.clear();
  resetAllocineSearches();
  resetDailymotionGuard();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ok = (body: string) => new Response(body, { status: 200, headers: { "content-type": "application/json" } });

describe("AlloCiné › la recherche", () => {
  it("ne garde que les bandes-annonces et teasers, et les met en mémoire partagée (7 jours)", async () => {
    fetchMock.mockResolvedValueOnce(ok(page("rick-et-morty")));
    const found = await searchAllocineVideos("Rick et Morty");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/user/allocine/videos?search=Rick%20et%20Morty&fields=id,title,created_time,duration&limit=100&page=1");
    expect(found?.videos.some((v) => v.id === "x8e90ff")).toBe(true);
    expect(found?.videos.some((v) => v.title.startsWith("Give Me Five"))).toBe(false);
    expect(found!.validUntil - found!.fetchedAt).toBe(7 * 86_400_000);
    // Toutes les saisons, tous les comptes : la mémoire répond, aucun nouvel appel.
    await searchAllocineVideos("rick ET morty");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rows.has(allocineCacheKey("Rick et Morty"))).toBe(true);
  });

  it("deux pages au plus quand il y en a davantage", async () => {
    fetchMock.mockResolvedValueOnce(ok(page("breaking-bad"))).mockResolvedValueOnce(ok(page("breaking-bad-2")));
    await searchAllocineVideos("Breaking Bad");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("&page=2");
  });

  it("une série en cours : 2 jours ; rien trouvé : 1 jour", async () => {
    fetchMock.mockResolvedValueOnce(ok(page("the-bear")));
    const bear = await searchAllocineVideos("The Bear", { ongoing: true });
    expect(bear!.validUntil - bear!.fetchedAt).toBe(2 * 86_400_000);
    fetchMock.mockResolvedValueOnce(ok(JSON.stringify({ list: [], has_more: false })));
    const none = await searchAllocineVideos("Inconnu");
    expect(none!.validUntil - none!.fetchedAt).toBe(86_400_000);
  });

  it("deux demandes simultanées n'en font qu'une", async () => {
    fetchMock.mockResolvedValueOnce(ok(page("dune")));
    const [a, b] = await Promise.all([searchAllocineVideos("Dune"), searchAllocineVideos("Dune")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("un appel attendu ne rejoint jamais une recherche de préparation : il lance la sienne", async () => {
    let answer!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (answer = resolve)));
    fetchMock.mockResolvedValueOnce(ok(page("dune")));
    const prepared = searchAllocineVideos("Dune", { priority: "prefetch" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Une autre préparation rejoint celle qui court ; la demande attendue part de son côté.
    void searchAllocineVideos("Dune", { priority: "prefetch" });
    const waited = await searchAllocineVideos("Dune");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(waited?.videos.length).toBeGreaterThan(0);
    answer(ok(page("dune")));
    expect((await prepared)?.videos.length).toBe(waited?.videos.length);
  });

  it("Dailymotion muet ou qui limite : rien à dire (null), rien en mémoire, et le disjoncteur s'ouvre sur un 429", async () => {
    fetchMock.mockRejectedValueOnce(new Error("réseau"));
    expect(await searchAllocineVideos("Dune")).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    expect(await searchAllocineVideos("Dune")).toBeNull();
    expect(rows.size).toBe(0);
    // En pause : plus aucun appel.
    expect(await searchAllocineVideos("Dune")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("une mémoire échue sert tout de suite, et la recherche se refait en fond", async () => {
    rows.set(allocineCacheKey("Dune"), {
      payload: { videos: [{ id: "old", title: "Dune Bande-annonce VF", createdTime: 1, duration: 60 }], fetchedAt: 0, validUntil: 1 },
      generatedAt: new Date(0),
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    fetchMock.mockResolvedValueOnce(ok(page("dune")));
    const stale = await searchAllocineVideos("Dune");
    expect(stale?.videos.map((v) => v.id)).toEqual(["old"]);
    // Le fond attend 30 s après un appel attendu : ici aucun, il part tout de suite.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
