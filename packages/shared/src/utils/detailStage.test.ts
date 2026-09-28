import { describe, expect, it } from "vitest";
import { detailGallery, galleryIndexOf, resumeState, splitMinutes, DETAIL_GALLERY_MAX } from "./detailStage";

const user = (position: number, extra: Record<string, unknown> = {}) => ({
  UserData: { PlaybackPositionTicks: position, PlayCount: 0, IsFavorite: false, Played: false, ...extra },
});

describe("detailGallery", () => {
  it("un film : ses décors d'abord, puis son affiche", () => {
    const gallery = detailGallery({ Id: "m", Type: "Movie", ImageTags: { Primary: "p" }, BackdropImageTags: ["a", "b"] });
    expect(gallery.map((g) => [g.kind, g.itemId, g.index, g.tag])).toEqual([
      ["backdrop", "m", 0, "a"],
      ["backdrop", "m", 1, "b"],
      ["poster", "m", 0, "p"],
    ]);
    expect(gallery[2].aspect).toBeCloseTo(2 / 3);
  });

  it("un épisode : son image d'abord, puis les décors de la série", () => {
    const gallery = detailGallery({
      Id: "e", Type: "Episode", SeriesId: "s", ImageTags: { Primary: "still" }, ParentBackdropImageTags: ["x"],
    });
    expect(gallery.map((g) => [g.kind, g.itemId])).toEqual([["still", "e"], ["backdrop", "s"]]);
    expect(gallery[0].aspect).toBeCloseTo(16 / 9);
  });

  it("préfère l'item porteur annoncé par Jellyfin, et rend vide sans image", () => {
    const gallery = detailGallery({
      Id: "season", Type: "Season", SeriesId: "s", ParentBackdropItemId: "owner", ParentBackdropImageTags: ["x"],
    });
    expect(gallery.map((g) => g.itemId)).toEqual(["owner"]);
    expect(detailGallery({ Id: "z", Type: "BoxSet" })).toEqual([]);
  });

  it("bornée, avec des clés uniques", () => {
    const tags = Array.from({ length: 20 }, (_, i) => `t${i}`);
    const gallery = detailGallery({ Id: "m", Type: "Movie", ImageTags: { Primary: "p" }, BackdropImageTags: tags });
    expect(gallery).toHaveLength(DETAIL_GALLERY_MAX);
    expect(new Set(gallery.map((g) => g.key)).size).toBe(DETAIL_GALLERY_MAX);
  });

  it("retrouve l'affiche, sinon la première image", () => {
    const gallery = detailGallery({ Id: "m", Type: "Movie", ImageTags: { Primary: "p" }, BackdropImageTags: ["a"] });
    expect(galleryIndexOf(gallery, "poster")).toBe(1);
    expect(galleryIndexOf(gallery, "still")).toBe(0);
  });
});

describe("resumeState", () => {
  const hour = 3600 * 1e7;

  it("avancement et minutes restantes", () => {
    expect(resumeState({ Type: "Movie", RunTimeTicks: 2 * hour, ...user(hour / 2) })).toEqual({ progress: 0.25, remainingMinutes: 90 });
  });

  it("rien à reprendre : pas commencé, vu jusqu'au générique, ou une série", () => {
    expect(resumeState({ Type: "Movie", RunTimeTicks: hour, ...user(0) })).toBeNull();
    expect(resumeState({ Type: "Movie", RunTimeTicks: hour, ...user(hour * 0.995) })).toBeNull();
    expect(resumeState({ Type: "Series", RunTimeTicks: hour, ...user(hour / 2) })).toBeNull();
  });

  it("sans durée : le pourcentage de Jellyfin, sans minutes", () => {
    expect(resumeState({ Type: "Episode", ...user(10, { PlayedPercentage: 40 }) })).toEqual({ progress: 0.4, remainingMinutes: null });
  });
});

describe("splitMinutes", () => {
  it("heures et minutes", () => {
    expect(splitMinutes(102)).toEqual({ hours: 1, minutes: 42 });
    expect(splitMinutes(42)).toEqual({ hours: 0, minutes: 42 });
  });
});
