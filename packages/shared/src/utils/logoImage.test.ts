import { describe, expect, it } from "vitest";
import type { MediaItem } from "../types/media";
import { resolveLogoImage } from "./logoImage";

const item = (fields: Partial<MediaItem>): MediaItem => ({ Id: "x", Name: "Nom", Type: "Movie", ...fields });

describe("resolveLogoImage", () => {
  it("prend le logo propre d'un film, avec son tag", () => {
    expect(resolveLogoImage(item({ Id: "m", ImageTags: { Primary: "p", Logo: "l" } }))).toEqual({ id: "m", tag: "l" });
  });

  it("prend pour un épisode le logo hérité de sa série", () => {
    const episode = item({ Id: "e", Type: "Episode", SeriesId: "s", ParentLogoItemId: "s", ParentLogoImageTag: "t" });
    expect(resolveLogoImage(episode)).toEqual({ id: "s", tag: "t" });
  });

  it("ne demande rien pour un épisode dont la série n'annonce aucun logo", () => {
    // Le cas de la bannière d'accueil : la série est connue, son logo non.
    const episode = item({ Id: "e", Type: "Episode", SeriesId: "s", ImageTags: { Primary: "p" } });
    expect(resolveLogoImage(episode)).toBeNull();
  });

  it("exige l'item ET le tag du logo hérité", () => {
    expect(resolveLogoImage(item({ Type: "Episode", ParentLogoItemId: "s" }))).toBeNull();
    expect(resolveLogoImage(item({ Type: "Episode", ParentLogoImageTag: "t" }))).toBeNull();
  });

  it("préfère le logo propre au logo hérité", () => {
    const episode = item({ Id: "e", Type: "Episode", ImageTags: { Logo: "l" }, ParentLogoItemId: "s", ParentLogoImageTag: "t" });
    expect(resolveLogoImage(episode)).toEqual({ id: "e", tag: "l" });
  });

  it("ne demande rien sans annonce, même sans `ImageTags`", () => {
    expect(resolveLogoImage(item({}))).toBeNull();
  });
});
