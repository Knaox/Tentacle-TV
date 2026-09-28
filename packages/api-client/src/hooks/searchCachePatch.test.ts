import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { patchSearchResponse } from "./searchCachePatch";

const movie = (Id: string): MediaItem =>
  ({ Id, Name: Id, Type: "Movie", UserData: { Played: false, IsFavorite: false, PlaybackPositionTicks: 0, PlayCount: 0 } }) as MediaItem;
const liked = (item: MediaItem): MediaItem => ({ ...item, UserData: { ...item.UserData!, Likes: true } });
const isM1 = (item: MediaItem) => item.Id === "m1";

describe("patchSearchResponse", () => {
  it("patche un titre dans ses sections, et le meilleur résultat", () => {
    const hit = { item: movie("m1"), match: { field: "title" }, score: 1 };
    const data = { query: "x", top: { kind: "item", hit }, movies: [hit, { item: movie("m2") }], series: [], people: [] };
    const next = patchSearchResponse(data, isM1, liked) as typeof data;
    expect(next.movies[0]?.item.UserData?.Likes).toBe(true);
    expect(next.movies[1]?.item.UserData?.Likes).toBeUndefined();
    expect(next.top.hit.item.UserData?.Likes).toBe(true);
    expect(data.movies[0]?.item.UserData?.Likes).toBeUndefined();
  });

  it("patche les épisodes rendus à plat", () => {
    const data = { query: "x", episodes: [movie("m1"), movie("m3")] };
    const next = patchSearchResponse(data, isM1, liked) as typeof data;
    expect(next.episodes[0]?.UserData?.Likes).toBe(true);
    expect(next.episodes[1]).toBe(data.episodes[1]);
  });

  it("rend null quand rien ne correspond", () => {
    expect(patchSearchResponse({ genres: [{ name: "Drame", count: 3 }] }, isM1, liked)).toBeNull();
    expect(patchSearchResponse({ items: [{ item: movie("m9") }] }, isM1, liked)).toBeNull();
  });
});
