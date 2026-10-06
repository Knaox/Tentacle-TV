import { describe, expect, it } from "vitest";
import type { MediaItem } from "../types/media";
import { heroImageOption, heroImagePlan, needsHeroArtwork, type HeroArtwork } from "./heroArtwork";

const posterOnly: MediaItem = { Id: "m1", Name: "Film", Type: "Movie", ImageTags: { Primary: "p" }, BackdropImageTags: [] };
const withBackdrop: MediaItem = { ...posterOnly, BackdropImageTags: ["b"] };
const artwork: HeroArtwork[] = [
  { kind: "tmdb", url: "https://image.tmdb.org/t/p/w1280/x.jpg" },
  { kind: "jellyfin", itemId: "m1", type: "Backdrop", index: 1, tag: "b1" },
  { kind: "jellyfin", itemId: "m1", type: "Primary", tag: "p" },
  { kind: "jellyfin", itemId: "m1", type: "Disc" },
];

describe("heroImagePlan", () => {
  it("affiche seule : le repli (TMDB, autre fond) passe AVANT l'affiche, sans doublon ni type inconnu", () => {
    const plan = heroImagePlan(posterOnly, artwork);
    expect(plan.map((o) => o.key)).toEqual(["https://image.tmdb.org/t/p/w1280/x.jpg", "m1/Backdrop/1", "m1/Primary"]);
  });

  it("le fond annoncé reste en tête ; le repli suit", () => {
    expect(heroImagePlan(withBackdrop, artwork)[0].key).toBe("m1/Backdrop");
  });

  it("sans repli connu : les images annoncées seules", () => {
    expect(heroImagePlan(posterOnly).map((o) => o.key)).toEqual(["m1/Primary"]);
  });
});

describe("needsHeroArtwork / heroImageOption", () => {
  it("un fond annoncé intact : pas de requête ; en échec : le repli est demandé", () => {
    expect(needsHeroArtwork(withBackdrop, new Set())).toBe(false);
    expect(needsHeroArtwork(withBackdrop, new Set(["m1/Backdrop"]))).toBe(true);
    expect(needsHeroArtwork(posterOnly, new Set())).toBe(true);
  });

  it("la première image qui n'a pas échoué", () => {
    const plan = heroImagePlan(posterOnly, artwork);
    expect(heroImageOption(plan, new Set(["https://image.tmdb.org/t/p/w1280/x.jpg"]))?.key).toBe("m1/Backdrop/1");
    expect(heroImageOption(plan, new Set(plan.map((o) => o.key)))).toBeNull();
  });
});
