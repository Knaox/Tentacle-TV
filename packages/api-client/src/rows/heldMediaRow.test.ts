import { describe, expect, it } from "vitest";
import type { MediaItem, UserItemData } from "@tentacle-tv/shared";
import { cachedUserData, mergeCachedUserData } from "./heldMediaRow";
import { heldRowView } from "./heldRow";

/**
 * « Vu » dans Reprendre, sous le curseur : la liste filtrée perd la carte au
 * rendu même du patch optimiste. La rangée tenue la garde, avec l'état que le
 * cache vient de dire — le bouton passe à « vu » tout de suite.
 */

const media = (Id: string, Played = false, extra: Partial<MediaItem> = {}): MediaItem =>
  ({ Id, Name: Id, Type: "Episode", UserData: { Played, IsFavorite: false, PlaybackPositionTicks: 10 }, ...extra }) as MediaItem;
const key = (item: MediaItem) => item.Id;
const played = (Played: boolean): UserItemData => ({ Played, IsFavorite: false, PlaybackPositionTicks: 10, PlayCount: 0 });

describe("le UserData d'une réponse en cache", () => {
  const wanted = new Set(["b"]);

  it("se lit dans une liste, une réponse { Items }, des pages et une fiche seule", () => {
    expect(cachedUserData([media("a"), media("b", true)], wanted).get("b")?.Played).toBe(true);
    expect(cachedUserData({ Items: [media("b", true)] }, wanted).get("b")?.Played).toBe(true);
    expect(cachedUserData({ pages: [{ Items: [media("b", true)] }], pageParams: [0] }, wanted).get("b")?.Played).toBe(true);
    expect(cachedUserData({ pages: [[media("b", true)]] }, wanted).get("b")?.Played).toBe(true);
    expect(cachedUserData(media("b", true), wanted).get("b")?.Played).toBe(true);
  });

  it("ignore les titres hors de la rangée et ce qui n'est pas un titre", () => {
    expect(cachedUserData([media("a", true)], wanted).size).toBe(0);
    expect(cachedUserData({ sections: [] }, wanted).size).toBe(0);
    expect(cachedUserData(null, wanted).size).toBe(0);
  });
});

describe("une carte que la liste perd au patch de « vu »", () => {
  const photo = [media("a"), media("b", false, { ImageTags: { Primary: "t1" } })];

  it("garde sa place et son image, avec l'état dit par le cache", () => {
    const fresh = mergeCachedUserData(new Map(), cachedUserData([media("b", true)], new Set(["b"])), (id) => photo.find((m) => m.Id === id));
    const view = heldRowView([media("a")], photo, true, key, undefined, fresh);
    expect(view.map(key)).toEqual(["a", "b"]);
    expect(view[1].UserData?.Played).toBe(true);
    expect(view[1].ImageTags).toEqual({ Primary: "t1" });
    // Le reste du UserData de la carte est gardé.
    expect(view[1].UserData?.PlaybackPositionTicks).toBe(10);
  });

  it("suit un second geste — « non vu » rétabli", () => {
    const baseOf = (id: string) => photo.find((m) => m.Id === id);
    const watched = mergeCachedUserData(new Map(), new Map([["b", played(true)]]), baseOf);
    const unwatched = mergeCachedUserData(watched, new Map([["b", played(false)]]), baseOf);
    expect(unwatched.get("b")?.UserData?.Played).toBe(false);
  });

  it("rien de neuf : la même Map, aucun rendu de plus", () => {
    const baseOf = (id: string) => photo.find((m) => m.Id === id);
    const watched = mergeCachedUserData(new Map(), new Map([["b", played(true)]]), baseOf);
    expect(mergeCachedUserData(watched, new Map([["b", played(true)]]), baseOf)).toBe(watched);
    // Une carte inconnue de la rangée n'entre pas.
    expect(mergeCachedUserData(watched, new Map([["z", played(true)]]), baseOf)).toBe(watched);
  });
});
