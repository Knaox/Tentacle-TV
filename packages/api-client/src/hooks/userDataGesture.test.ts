import { beforeEach, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { updateItemUserDataInCache } from "./cacheUtils";
import { pendingUserDataFor, resetPendingUserDataForTests, withPendingUserData } from "./pendingUserData";
import { beginUserDataGesture, failUserDataGesture, settleUserDataGesture } from "./userDataGesture";
import { WATCHLIST_SERIES_IDS_KEY } from "./watchlistEffects";

/**
 * Défaut C du relevé : « vu », favori et Ma liste ne changeaient pas tout de
 * suite sur certains écrans — un titre arrivé sans `UserData`, une liste que
 * le patch ne connaissait pas, un ensemble de séries pas encore chargé, une
 * carte de recommandation dont la fiche n'est pas en cache.
 */

const movie = (Id: string, UserData?: Partial<MediaItem["UserData"]>): MediaItem =>
  ({ Id, Type: "Movie", Name: Id, ...(UserData ? { UserData } : {}) }) as MediaItem;
const episode = (Id: string, SeriesId: string): MediaItem =>
  ({ Id, Type: "Episode", SeriesId, UserData: { Played: false, PlayCount: 0, IsFavorite: false, PlaybackPositionTicks: 0 } }) as MediaItem;

let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  resetPendingUserDataForTests();
});

describe("le patch des caches", () => {
  it("donne son état à un titre arrivé SANS `UserData` (recherche, similaires)", () => {
    qc.setQueryData(["similar", "x"], [movie("m1"), movie("m2", { Played: false })]);
    updateItemUserDataInCache(qc, "m1", () => ({ Played: true, PlayedPercentage: 100 }));
    const [patched, other] = qc.getQueryData<MediaItem[]>(["similar", "x"]) ?? [];
    expect(patched?.UserData?.Played).toBe(true);
    expect(other?.UserData?.Played).toBe(false);
  });

  it("donne son état à la fiche en cache même sans `UserData`", () => {
    qc.setQueryData(["item", "m1"], movie("m1"));
    updateItemUserDataInCache(qc, "m1", () => ({ IsFavorite: true }));
    expect(qc.getQueryData<MediaItem>(["item", "m1"])?.UserData?.IsFavorite).toBe(true);
  });

  it.each(["series-episodes", "all-episodes", "special-features"])("patche la liste « %s »", (prefix) => {
    qc.setQueryData([prefix, "serie"], [episode("e1", "serie"), episode("e2", "serie")]);
    updateItemUserDataInCache(qc, "e2", () => ({ Played: true }));
    expect(qc.getQueryData<MediaItem[]>([prefix, "serie"])?.map((item) => item.UserData?.Played)).toEqual([false, true]);
  });
});

describe("le geste, avant le serveur", () => {
  it("tient l'état d'un titre qu'aucun cache ne porte (carte de recommandation, fiche en cours de chargement)", async () => {
    const face = { Id: "m1", Type: "Movie", ProviderIds: { Tmdb: "603" } } as unknown as MediaItem;
    const context = await beginUserDataGesture(qc, { itemId: "m1", target: "m1", patch: { Likes: true } });
    expect(context.snapshot.size).toBe(0);
    expect(withPendingUserData(face, pendingUserDataFor("m1")).UserData?.Likes).toBe(true);

    // Le serveur a confirmé : la vérité est demandée (la fiche), puis le geste est relâché.
    await settleUserDataGesture(qc, context, { itemId: "m1", fetchItem: async () => movie("m1", { Likes: true }) });
    expect(pendingUserDataFor("m1")).toBeUndefined();
    expect(qc.getQueryData<MediaItem>(["item", "m1"])?.UserData?.Likes).toBe(true);
  });

  it("ne redemande pas la fiche quand un cache porte déjà le titre", async () => {
    qc.setQueryData(["similar", "x"], [movie("m1")]);
    const context = await beginUserDataGesture(qc, { itemId: "m1", target: "m1", patch: { Played: true } });
    let fetched = 0;
    await settleUserDataGesture(qc, context, { itemId: "m1", fetchItem: async () => { fetched += 1; return movie("m1"); } });
    expect(fetched).toBe(0);
    expect(pendingUserDataFor("m1")).toBeUndefined();
  });

  it("dit tout de suite « dans Ma liste » pour une série dont l'ensemble n'est pas chargé", async () => {
    const context = await beginUserDataGesture(qc, {
      itemId: "serie", target: { matchId: "serie", matchSeriesId: "serie" }, patch: { Likes: true },
      seriesSet: { key: WATCHLIST_SERIES_IDS_KEY, seriesId: "serie", add: true },
    });
    // L'ensemble n'est pas inventé (les autres séries y manqueraient)…
    expect(qc.getQueryData(WATCHLIST_SERIES_IDS_KEY)).toBeUndefined();
    // … c'est le geste qui répond.
    expect(pendingUserDataFor("serie")?.Likes).toBe(true);
    failUserDataGesture(qc, context);
    expect(pendingUserDataFor("serie")).toBeUndefined();
  });

  it("interrompt le chargement de l'ensemble : une réponse d'avant le geste ne l'écrase pas", async () => {
    let resolveFetch: (ids: string[]) => void = () => undefined;
    const fetching = qc.fetchQuery({
      queryKey: WATCHLIST_SERIES_IDS_KEY,
      queryFn: () => new Promise<string[]>((resolve) => { resolveFetch = resolve; }),
    }).catch(() => undefined);
    qc.setQueryData(WATCHLIST_SERIES_IDS_KEY, ["autre"]);
    await beginUserDataGesture(qc, {
      itemId: "serie", target: { matchId: "serie", matchSeriesId: "serie" }, patch: { Likes: true },
      seriesSet: { key: WATCHLIST_SERIES_IDS_KEY, seriesId: "serie", add: true },
    });
    resolveFetch(["autre"]);
    await fetching;
    expect(qc.getQueryData<string[]>(WATCHLIST_SERIES_IDS_KEY)).toEqual(["autre", "serie"]);
  });

  it("empile deux gestes sur le même titre et les défait un par un", async () => {
    const list = await beginUserDataGesture(qc, { itemId: "m1", target: "m1", patch: { Likes: true } });
    const heart = await beginUserDataGesture(qc, { itemId: "m1", target: "m1", patch: { IsFavorite: true } });
    expect(pendingUserDataFor("m1")).toEqual({ Likes: true, IsFavorite: true });
    failUserDataGesture(qc, list);
    expect(pendingUserDataFor("m1")).toEqual({ IsFavorite: true });
    failUserDataGesture(qc, heart);
    expect(pendingUserDataFor("m1")).toBeUndefined();
  });

  it("un échec remet les caches et relâche le geste", async () => {
    qc.setQueryData(["item", "m1"], movie("m1", { Played: false }));
    const context = await beginUserDataGesture(qc, { itemId: "m1", target: "m1", patch: { Played: true } });
    expect(qc.getQueryData<MediaItem>(["item", "m1"])?.UserData?.Played).toBe(true);
    failUserDataGesture(qc, context);
    expect(qc.getQueryData<MediaItem>(["item", "m1"])?.UserData?.Played).toBe(false);
    expect(pendingUserDataFor("m1")).toBeUndefined();
  });
});
