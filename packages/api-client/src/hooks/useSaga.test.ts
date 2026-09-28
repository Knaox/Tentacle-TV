import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { readSagaResponse, SAGA_ITEMS_KEY } from "./useSaga";
import { updateItemUserDataInCache } from "./cacheUtils";

/**
 * La réponse de /api/sagas relue sans confiance, et les films de la saga
 * tenus à jour en cache par les bascules « vu », comme les autres rangées.
 */

const ID_A = "a".repeat(32);
const ID_B = "b".repeat(32);

describe("readSagaResponse", () => {
  it("garde la saga et les films bien formés", () => {
    const res = readSagaResponse({
      collectionId: 1241,
      saga: { collectionId: 1241, name: "Harry Potter - Saga", parts: [{ tmdbId: 671, title: "HP 1", releaseDate: "2001-11-16" }] },
      members: [{ itemId: ID_A, tmdbId: 671 }, { itemId: ID_B, tmdbId: null }],
    }, 1241);
    expect(res).toEqual({
      collectionId: 1241,
      saga: { collectionId: 1241, name: "Harry Potter - Saga", parts: [{ tmdbId: 671, title: "HP 1", releaseDate: "2001-11-16" }] },
      members: [{ itemId: ID_A, tmdbId: 671 }, { itemId: ID_B, tmdbId: null }],
    });
  });

  it("écarte un identifiant qui n'en est pas un, un volet illisible ; une saga illisible vaut null", () => {
    const res = readSagaResponse({
      saga: { name: 3, parts: [] },
      members: [{ itemId: "../../etc", tmdbId: 1 }, { itemId: ID_A, tmdbId: "671" }],
    }, 7);
    expect(res).toEqual({ collectionId: 7, saga: null, members: [{ itemId: ID_A, tmdbId: null }] });
    const parts = readSagaResponse({ saga: { name: "S", parts: [{ tmdbId: "x", title: "?" }, { tmdbId: 2, title: "B" }] }, members: [] }, 7);
    expect(parts?.saga?.parts).toEqual([{ tmdbId: 2, title: "B", releaseDate: null }]);
  });

  it("une réponse sans liste de films : rien", () => {
    expect(readSagaResponse(null, 1)).toBeNull();
    expect(readSagaResponse({ saga: null }, 1)).toBeNull();
  });
});

describe("les films d'une saga en cache", () => {
  it("une bascule « vu » les patche comme les autres rangées", () => {
    const qc = new QueryClient();
    const film = (id: string): MediaItem => ({
      Id: id, Name: id, Type: "Movie",
      UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false },
    });
    const key = [SAGA_ITEMS_KEY, 1241, `${ID_A},${ID_B}`];
    qc.setQueryData(key, [film(ID_A), film(ID_B)]);
    updateItemUserDataInCache(qc, ID_B, () => ({ Played: true }));
    const cached = qc.getQueryData<MediaItem[]>(key);
    expect(cached?.map((i) => i.UserData?.Played)).toEqual([false, true]);
  });
});
