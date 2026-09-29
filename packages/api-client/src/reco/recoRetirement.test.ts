/**
 * Un titre jugé depuis « Pour vous » en sort quand la carte est LÂCHÉE —
 * jamais sous le curseur. Éprouvés avec un vrai QueryClient, sur les caches
 * que lisent les marqueurs des cartes : ce qui juge un titre (Ma liste,
 * cœur, vu, note, mise de côté d'une carte Vigie), le lâcher qui le retire
 * de toutes les pages — et des pages servies ensuite —, les prises qui se
 * cumulent (rangée + feuille), la carte d'une TV qui ne connaît que l'item,
 * la note qui attend le lâcher, et « Ne plus me proposer » qui n'attend pas.
 */

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaItem, UserItemData } from "@tentacle-tv/shared";
import type { RecoRowItem } from "../hooks/recoTypes";
import type { UserRatingEntry } from "../hooks/useRatings";
import { RECO_PAGE_KEY, selectRecoPage, type RecoPage } from "../hooks/useRecoPage";
import { WATCHLIST_PENDING_KEY } from "../hooks/useWatchlistPending";
import { FAVORITE_PENDING_KEY } from "../hooks/useFavoritePending";
import { FAVORITE_SERIES_IDS_KEY, WATCHLIST_SERIES_IDS_KEY } from "../hooks/watchlistEffects";
import { dropRecoItemUnlessHeld } from "./recoCacheItems";
import { RECO_LEAVE_MS, isRecoItemJudged, releaseRecoCard } from "./recoRetirement";
import { holdRecoCard, isRecoLeaving, markRecoDismissed, resetRecoRetirementForTests } from "./recoRetirementState";
import { heldRecoView } from "./useRecoHold";

const reco = (key: string, jellyfinItemId: string | null = null): RecoRowItem => ({
  key,
  mediaType: key.startsWith("tv:") ? "tv" : "movie",
  tmdbId: Number(key.split(":")[1]),
  title: key,
  year: null,
  posterPath: null,
  backdropPath: null,
  jellyfinItemId,
  source: "x",
  score: 1,
  voteAverage: null,
  reasons: [],
  providers: null,
});

const MOVIE = reco("movie:603", "m603");
const SERIES = reco("tv:1399", "s1399");
const VIGIE = reco("movie:11");
const OTHER = reco("movie:12", "m12");

const page = (rows: Array<RecoRowItem[]>): RecoPage => ({
  state: "ready", signalCount: 20, generating: false, refining: false, exploring: false,
  generatedAt: null, poolGeneratedAt: null, tmdbConfigured: true, personalized: true, filter: null,
  rows: rows.map((items, i) => ({ key: `row${i}`, items })),
});

let qc: QueryClient;
const keysOf = (filter = "all") =>
  (qc.getQueryData<RecoPage>([RECO_PAGE_KEY, filter])?.rows ?? []).map((row) => row.items.map((i) => i.key));
// Le fondu de sortie, puis le retrait (asynchrone : il annule d'abord les requêtes en vol).
const flush = () => vi.advanceTimersByTimeAsync(RECO_LEAVE_MS + 1);
const movieFace = (over: Partial<UserItemData>) =>
  ({
    Id: "m603", Name: "Film", Type: "Movie",
    UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, ...over },
  }) as MediaItem;
const rating = (mediaType: "movie" | "series", tmdbId: number): UserRatingEntry => ({
  id: "r", mediaType, tmdbId, jellyfinItemId: null, seasonNumber: 0, episodeNumber: 0, score: 8,
  syncStatus: "synced", updatedAt: "2026-09-29T00:00:00Z",
} as UserRatingEntry);

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
  resetRecoRetirementForTests();
  qc = new QueryClient();
  qc.setQueryData([RECO_PAGE_KEY, "all"], page([[MOVIE, SERIES, VIGIE], [OTHER, MOVIE]]));
  qc.setQueryData([RECO_PAGE_KEY, "8"], page([[MOVIE, OTHER]]));
});

describe("ce qui juge un titre, lu dans les caches des marqueurs", () => {
  it("rien : pas jugé", () => {
    expect([MOVIE, SERIES, VIGIE].map((i) => isRecoItemJudged(qc, i))).toEqual([false, false, false]);
  });

  it("un film : Ma liste, cœur ou « vu » dans sa fiche en cache", () => {
    for (const over of [{ Likes: true }, { IsFavorite: true }, { Played: true }]) {
      qc.setQueryData(["item", "m603"], movieFace(over));
      expect(isRecoItemJudged(qc, MOVIE)).toBe(true);
    }
  });

  it("une série : les Sets Ma liste et favoris", () => {
    qc.setQueryData(WATCHLIST_SERIES_IDS_KEY, ["s1399"]);
    expect(isRecoItemJudged(qc, SERIES)).toBe(true);
    qc.setQueryData(WATCHLIST_SERIES_IDS_KEY, []);
    qc.setQueryData(FAVORITE_SERIES_IDS_KEY, ["s1399"]);
    expect(isRecoItemJudged(qc, SERIES)).toBe(true);
  });

  it("une note, retrouvée par le TMDB même sans fiche en cache", () => {
    qc.setQueryData(["ratings"], [rating("series", 1399)]);
    expect(isRecoItemJudged(qc, SERIES)).toBe(true);
  });

  it("une carte Vigie : sa mise de côté pour Ma liste", () => {
    qc.setQueryData(WATCHLIST_PENDING_KEY, ["movie:11"]);
    expect(isRecoItemJudged(qc, VIGIE)).toBe(true);
  });

  it("une carte Vigie : son cœur qui attend l'arrivée du titre — le sien, pas celui d'un autre", () => {
    qc.setQueryData(FAVORITE_PENDING_KEY, ["movie:12"]);
    expect(isRecoItemJudged(qc, VIGIE)).toBe(false);
    qc.setQueryData(FAVORITE_PENDING_KEY, ["movie:12", "movie:11"]);
    expect(isRecoItemJudged(qc, VIGIE)).toBe(true);
  });
});

describe("le lâcher", () => {
  it("retire le titre jugé de TOUTES les pages, et des pages servies ensuite", async () => {
    holdRecoCard("movie:603");
    qc.setQueryData(["item", "m603"], movieFace({ Likes: true }));
    expect(keysOf()).toEqual([["movie:603", "tv:1399", "movie:11"], ["movie:12", "movie:603"]]);
    releaseRecoCard(qc, "movie:603");
    await flush();
    expect(keysOf()).toEqual([["tv:1399", "movie:11"], ["movie:12"]]);
    expect(keysOf("8")).toEqual([["movie:12"]]);
    // Une page calculée AVANT le geste, servie après, ne le remontre pas.
    const stale = selectRecoPage(page([[MOVIE, OTHER]]));
    expect(stale.rows.map((r) => r.items.map((i) => i.key))).toEqual([["movie:12"]]);
  });

  it("s'efface d'abord : le titre reste en cache le temps du fondu", async () => {
    qc.setQueryData(WATCHLIST_PENDING_KEY, ["movie:11"]);
    holdRecoCard("movie:11");
    releaseRecoCard(qc, "movie:11");
    expect(isRecoLeaving("movie:11")).toBe(true);
    await vi.advanceTimersByTimeAsync(RECO_LEAVE_MS - 20);
    expect(keysOf()[0]).toContain("movie:11");
    await flush();
    expect(keysOf()[0]).not.toContain("movie:11");
  });

  it("une carte reprise pendant son fondu reste", async () => {
    qc.setQueryData(WATCHLIST_PENDING_KEY, ["movie:11"]);
    holdRecoCard("movie:11");
    releaseRecoCard(qc, "movie:11");
    holdRecoCard("movie:11");
    expect(isRecoLeaving("movie:11")).toBe(false);
    await flush();
    expect(keysOf()[0]).toContain("movie:11");
  });

  it("garde un titre qui n'est pas (ou plus) jugé", async () => {
    holdRecoCard("movie:603");
    releaseRecoCard(qc, "movie:603");
    await flush();
    expect(keysOf()[0]).toContain("movie:603");
  });

  it("attend la DERNIÈRE prise : la rangée et la feuille tiennent ensemble", async () => {
    qc.setQueryData(WATCHLIST_PENDING_KEY, ["movie:11"]);
    holdRecoCard("movie:11");
    holdRecoCard("movie:11");
    releaseRecoCard(qc, "movie:11");
    await flush();
    expect(keysOf()[0]).toContain("movie:11");
    releaseRecoCard(qc, "movie:11");
    await flush();
    expect(keysOf()[0]).not.toContain("movie:11");
  });

  it("la carte d'une TV se tient par son item Jellyfin ; la rangée qui la tient par sa clé passe avant", async () => {
    qc.setQueryData(["item", "m603"], movieFace({ Played: true }));
    holdRecoCard("movie:603");
    holdRecoCard("m603");
    releaseRecoCard(qc, "m603");
    await flush();
    expect(keysOf()[0]).toContain("movie:603");
    releaseRecoCard(qc, "movie:603");
    await flush();
    expect(keysOf()[0]).not.toContain("movie:603");
  });
});

describe("la note et « Ne plus me proposer »", () => {
  it("une note retire tout de suite un titre libre, et laisse un titre tenu à son lâcher", async () => {
    await dropRecoItemUnlessHeld(qc, "tv:1399");
    expect(keysOf()[0]).not.toContain("tv:1399");
    holdRecoCard("m603");
    await dropRecoItemUnlessHeld(qc, "movie:603");
    expect(keysOf()[0]).toContain("movie:603");
  });

  it("une rangée tenue montre sa photographie, moins ce qui est écarté", () => {
    const frozen = [MOVIE, SERIES, VIGIE];
    expect(heldRecoView([SERIES], frozen, true).map((i) => i.key)).toEqual(["movie:603", "tv:1399", "movie:11"]);
    markRecoDismissed("tv:1399");
    expect(heldRecoView([MOVIE], frozen, true).map((i) => i.key)).toEqual(["movie:603", "movie:11"]);
    expect(heldRecoView([MOVIE], frozen, false)).toEqual([MOVIE]);
  });
});
