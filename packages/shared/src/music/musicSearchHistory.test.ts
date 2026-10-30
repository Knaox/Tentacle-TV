import { describe, expect, it } from "vitest";
import type { MusicTrack } from "./musicTypes";
import {
  EMPTY_SEARCH_HISTORY, forgetInSearchHistory, mergeSearchHistory, normalizeSearchQuery, parseSearchHistoryAdd, parseSearchHistoryForget,
} from "./musicSearchHistory";

const track = (key: string, extra: Partial<MusicTrack> = {}) =>
  ({ key, title: `Titre ${key}`, artists: [{ name: "Daft Punk", jellyfinId: null }], artworkUrl: null, ...extra }) as unknown as MusicTrack;

describe("historique de la recherche (contrat)", () => {
  it("une requête : espaces resserrés, 2 à 200 caractères", () => {
    expect(normalizeSearchQuery("  daft   punk ")).toBe("daft punk");
    expect(normalizeSearchQuery("a")).toBeNull();
    expect(normalizeSearchQuery("x".repeat(201))).toBeNull();
    expect(normalizeSearchQuery(42)).toBeNull();
  });

  it("l'ajout : la plus récente d'une clé gagne, sans casse, le plus récent en tête", () => {
    const first = mergeSearchHistory(EMPTY_SEARCH_HISTORY, { queries: [{ text: "Daft Punk", at: 1 }, { text: "Justice", at: 2 }] });
    const next = mergeSearchHistory(first, { queries: [{ text: "daft punk", at: 3 }], tracks: [{ track: track("jf:a"), at: 3 }] });
    expect(next.queries.map((q) => q.text)).toEqual(["daft punk", "Justice"]);
    expect(next.tracks.map((t) => t.track.key)).toEqual(["jf:a"]);
  });

  it("verser l'historique d'un appareil ne fait pas remonter de vieilles entrées devant les récentes", () => {
    const server = mergeSearchHistory(EMPTY_SEARCH_HISTORY, { queries: [{ text: "récente", at: 100 }] });
    const merged = mergeSearchHistory(server, { queries: [{ text: "ancienne", at: 10 }, { text: "RÉCENTE", at: 5 }] });
    expect(merged.queries.map((q) => q.text)).toEqual(["récente", "ancienne"]);
  });

  it("borne chaque sorte", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ text: `requête ${i}`, at: i }));
    expect(mergeSearchHistory(EMPTY_SEARCH_HISTORY, { queries: many }, 20).queries).toHaveLength(20);
  });

  it("le corps d'un POST : entrées invalides écartées, date future ramenée à maintenant", () => {
    const parsed = parseSearchHistoryAdd({ queries: [{ text: "ok ok", at: 9_999 }, { text: "x" }, null], tracks: [{ track: track("jf:b"), at: 5 }, { track: { key: 1 } }] }, 1_000);
    expect(parsed).toEqual({ queries: [{ text: "ok ok", at: 1_000 }], tracks: [{ track: track("jf:b"), at: 5 }] });
    expect(parseSearchHistoryAdd({ queries: "non" }, 1)).toBeNull();
    expect(parseSearchHistoryAdd({ tracks: Array.from({ length: 21 }, () => ({ track: track("jf:c"), at: 1 })) }, 1)).toBeNull();
  });

  it("refuse un instantané trop lourd", () => {
    const heavy = track("jf:d", { title: "x".repeat(9_000) });
    expect(parseSearchHistoryAdd({ tracks: [{ track: heavy, at: 1 }] }, 2)?.tracks).toEqual([]);
  });

  it("effacer : une requête (sans casse), un titre, tout", () => {
    const h = mergeSearchHistory(EMPTY_SEARCH_HISTORY, { queries: [{ text: "Daft Punk", at: 1 }], tracks: [{ track: track("jf:a"), at: 1 }] });
    expect(forgetInSearchHistory(h, { kind: "query", text: "DAFT punk" }).queries).toEqual([]);
    expect(forgetInSearchHistory(h, { kind: "track", key: "jf:a" }).tracks).toEqual([]);
    expect(forgetInSearchHistory(h, { kind: "all" })).toEqual(EMPTY_SEARCH_HISTORY);
    expect(parseSearchHistoryForget({ kind: "track" })).toBeNull();
    expect(parseSearchHistoryForget({ kind: "all" })).toEqual({ kind: "all" });
  });
});
