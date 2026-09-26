import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { heroImageUrl, heroPosterUrl, pageIndex, slideHalo, slideVisual, type HeroSlide } from "./heroSlides";

const client = {
  getImageUrl: (id: string, type: string, opts?: { width?: number }) => `${id}/${type}/${opts?.width ?? 0}`,
};
const item = (over: Partial<MediaItem>): MediaItem => ({ Id: "m1", Name: "Titre", Type: "Movie", ...over }) as MediaItem;

describe("heroPosterUrl", () => {
  it("prend l'affiche du film", () => {
    expect(heroPosterUrl(client, item({ ImageTags: { Primary: "t" } }))).toBe("m1/Primary/1080");
  });
  it("prend l'affiche de la SÉRIE pour un épisode", () => {
    const ep = item({ Id: "e1", Type: "Episode", SeriesId: "s1", SeriesPrimaryImageTag: "t", ImageTags: { Primary: "x" } });
    expect(heroPosterUrl(client, ep, 128)).toBe("s1/Primary/128");
  });
  it("rend null sans affiche connue", () => {
    expect(heroPosterUrl(client, item({}))).toBeNull();
    expect(heroPosterUrl(client, item({ Type: "Episode", SeriesId: "s1" }))).toBeNull();
  });
});

describe("heroImageUrl", () => {
  it("garde le backdrop de la série pour un épisode", () => {
    const ep = item({ Id: "e1", Type: "Episode", SeriesId: "s1", ParentBackdropItemId: "s1", ParentBackdropImageTags: ["b"] });
    expect(heroImageUrl(client, ep)).toBe("s1/Backdrop/1280");
  });
  it("retombe sur l'affiche sans backdrop", () => {
    expect(heroImageUrl(client, item({ ImageTags: { Primary: "p" } }))).toBe("m1/Primary/1280");
  });
});

describe("slideVisual / slideHalo", () => {
  const slide: HeroSlide = {
    id: "a",
    backdropUri: "large",
    haloUri: "large-halo",
    posterUri: "poster",
    haloPosterUri: "poster-halo",
    render: () => null,
  };
  it("montre l'affiche et son halo sur une carte portrait", () => {
    expect(slideVisual(slide, true)).toBe("poster");
    expect(slideHalo(slide, true)).toBe("poster-halo");
  });
  it("garde le visuel large sur une carte paysage", () => {
    expect(slideVisual(slide, false)).toBe("large");
    expect(slideHalo(slide, false)).toBe("large-halo");
  });
  it("retombe sur le visuel large quand l'affiche manque", () => {
    const bare: HeroSlide = { ...slide, posterUri: null, haloPosterUri: null };
    expect(slideVisual(bare, true)).toBe("large");
    expect(slideHalo(bare, true)).toBe("large-halo");
  });
});

describe("pageIndex", () => {
  it("arrondit à la page la plus proche et borne", () => {
    expect(pageIndex(0, 300, 3)).toBe(0);
    expect(pageIndex(160, 300, 3)).toBe(1);
    expect(pageIndex(5000, 300, 3)).toBe(2);
    expect(pageIndex(-20, 300, 3)).toBe(0);
    expect(pageIndex(100, 0, 3)).toBe(0);
  });
});
