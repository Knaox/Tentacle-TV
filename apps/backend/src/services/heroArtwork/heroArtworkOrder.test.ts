import { describe, expect, it } from "vitest";
import { heroArtworkList, orderJellyfinImages } from "./heroArtworkOrder";

describe("orderJellyfinImages", () => {
  it("par type d'abord : les fonds (du titre puis de la série), la vignette, l'affiche ; ni logo ni disque", () => {
    const order = orderJellyfinImages([
      { itemId: "ep", images: [{ ImageType: "Primary", ImageTag: "p" }, { ImageType: "Logo", ImageTag: "l" }] },
      {
        itemId: "series",
        images: [
          { ImageType: "Backdrop", ImageIndex: 1, ImageTag: "b1" },
          { ImageType: "Disc", ImageTag: "d" },
          { ImageType: "Backdrop", ImageIndex: 0, ImageTag: "b0" },
          { ImageType: "Thumb", ImageTag: "t" },
        ],
      },
    ]);
    expect(order.map((a) => (a.kind === "jellyfin" ? `${a.itemId}/${a.type}/${a.index ?? "-"}` : a.url))).toEqual([
      "series/Backdrop/0",
      "series/Backdrop/1",
      "series/Thumb/-",
      "ep/Primary/-",
    ]);
  });
});

describe("heroArtworkList", () => {
  it("le fond TMDB en tête quand il existe", () => {
    const jf = orderJellyfinImages([{ itemId: "m", images: [{ ImageType: "Primary" }] }]);
    expect(heroArtworkList("/abc.jpg", jf)[0]).toEqual({ kind: "tmdb", url: "https://image.tmdb.org/t/p/w1280/abc.jpg" });
    expect(heroArtworkList(null, jf)).toEqual(jf);
  });
});
