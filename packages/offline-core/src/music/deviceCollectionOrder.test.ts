import { describe, expect, it } from "vitest";
import { orderDeviceCollections } from "./deviceCollectionOrder";

const keys = (list: { key: string }[]) => list.map((c) => c.key);
const c = (key: string) => ({ key });

describe("orderDeviceCollections", () => {
  it("les likés en tête, les playlists dans l'ordre de la bibliothèque, puis le reste dans l'ordre d'avant", () => {
    const kept = [c("album:a"), c("playlist:jf:p2"), c("playlist:liked"), c("playlist:jf:p1"), c("album:b"), c("playlist:jf:p9")];
    expect(keys(orderDeviceCollections(kept, ["jf:p1", "jf:p3", "jf:p2"]))).toEqual(["playlist:liked", "playlist:jf:p1", "playlist:jf:p2", "album:a", "album:b", "playlist:jf:p9"]);
  });
  it("sans ordre connu (cache vide) : l'ordre d'avant, les likés en tête", () => {
    expect(keys(orderDeviceCollections([c("album:a"), c("playlist:liked")], []))).toEqual(["playlist:liked", "album:a"]);
  });
});
