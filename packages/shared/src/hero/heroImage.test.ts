import { describe, expect, it } from "vitest";
import type { MediaItem } from "../types/media";
import { hasHeroImage, heroImageCandidates, heroImageFor, heroImageKey } from "./heroImage";

const movie = (over: Partial<MediaItem> = {}): MediaItem => ({ Id: "m1", Name: "Film", Type: "Movie", ...over });

describe("heroImageCandidates", () => {
  it("un film : son fond, puis sa vignette, puis son affiche", () => {
    const item = movie({ BackdropImageTags: ["b"], ImageTags: { Primary: "p", Thumb: "t" } });
    expect(heroImageCandidates(item)).toEqual([
      { id: "m1", type: "Backdrop", tag: "b" },
      { id: "m1", type: "Thumb", tag: "t" },
      { id: "m1", type: "Primary", tag: "p" },
    ]);
  });

  it("un épisode : le fond de SA SÉRIE d'abord, puis son image, puis l'affiche de la série", () => {
    const item: MediaItem = {
      Id: "e1", Name: "Épisode", Type: "Episode", SeriesId: "s1",
      ParentBackdropImageTags: ["pb"], ParentBackdropItemId: "s1",
      ImageTags: { Primary: "ep" }, SeriesPrimaryImageTag: "sp",
    };
    expect(heroImageCandidates(item).map((r) => `${r.id}/${r.type}`)).toEqual(["s1/Backdrop", "e1/Primary", "s1/Primary"]);
  });

  it("le fond hérité d'un épisode sans ParentBackdropItemId se demande à la série", () => {
    const item: MediaItem = { Id: "e1", Name: "É", Type: "Episode", SeriesId: "s1", ParentBackdropImageTags: ["pb"] };
    expect(heroImageCandidates(item)[0]).toEqual({ id: "s1", type: "Backdrop", tag: "pb" });
  });

  it("rien d'annoncé : rien à demander, et le titre n'a pas d'image", () => {
    expect(heroImageCandidates(movie())).toEqual([]);
    expect(hasHeroImage(movie({ ImageTags: {}, BackdropImageTags: [] }))).toBe(false);
    expect(hasHeroImage(movie({ ImageTags: { Primary: "p" } }))).toBe(true);
  });
});

describe("heroImageFor", () => {
  it("une image en échec passe la main à la suivante, puis à rien", () => {
    const item = movie({ BackdropImageTags: ["b"], ImageTags: { Primary: "p" } });
    const failed = new Set<string>();
    expect(heroImageFor(item, failed)?.type).toBe("Backdrop");
    failed.add(heroImageKey({ id: "m1", type: "Backdrop" }));
    expect(heroImageFor(item, failed)?.type).toBe("Primary");
    failed.add(heroImageKey({ id: "m1", type: "Primary" }));
    expect(heroImageFor(item, failed)).toBeNull();
  });
});
