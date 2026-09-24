import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { heroImageUrl, heroPosterUrl } from "./heroImages";
import { slideHalo, slideVisual, type HeroSlide } from "./heroSlides";

const client = {
  getImageUrl: (id: string, type: string, opts?: { width?: number }) => `${id}/${type}/${opts?.width ?? 0}`,
};

const item = (over: Partial<MediaItem>): MediaItem => ({ Id: "m1", Name: "Titre", Type: "Movie", ...over }) as MediaItem;

describe("heroPosterUrl", () => {
  it("prend l'affiche du film", () => {
    expect(heroPosterUrl(client, item({ ImageTags: { Primary: "t" } }))).toBe("m1/Primary/1080");
  });

  it("prend l'affiche de la SÉRIE pour un épisode — sa Primary est une vignette 16/9", () => {
    const ep = item({ Id: "e1", Type: "Episode", SeriesId: "s1", SeriesPrimaryImageTag: "t", ImageTags: { Primary: "x" } });
    expect(heroPosterUrl(client, ep, 256)).toBe("s1/Primary/256");
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
