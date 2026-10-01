import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { loadingArt } from "./loadingArt";

const client = {
  getImageUrl: (id: string, type?: string, opts?: { width?: number; height?: number; tag?: string }) =>
    `${id}/${type}${opts?.tag ? `?tag=${opts.tag}` : ""}`,
};

const item = (over: Partial<MediaItem>): MediaItem => ({ Id: "m1", Name: "Titre", Type: "Movie", ...over }) as MediaItem;

describe("loadingArt — logo", () => {
  it("demande le logo hérité d'un épisode, par son tag", () => {
    const ep = item({ Id: "e1", Type: "Episode", SeriesId: "s1", ParentLogoItemId: "s1", ParentLogoImageTag: "t" });
    expect(loadingArt(client, ep).logoUrl).toBe("s1/Logo?tag=t");
  });

  it("ne demande rien pour un épisode dont la série n'annonce aucun logo", () => {
    const ep = item({ Id: "e1", Type: "Episode", SeriesId: "s1", SeriesName: "Série", ImageTags: { Primary: "p" } });
    expect(loadingArt(client, ep).logoUrl).toBeNull();
  });

  it("demande le logo propre d'un film, par son tag", () => {
    expect(loadingArt(client, item({ ImageTags: { Primary: "p", Logo: "l" } })).logoUrl).toBe("m1/Logo?tag=l");
  });

  it("préfère le logo propre d'un épisode à celui de sa série — la règle partagée", () => {
    const ep = item({ Id: "e1", Type: "Episode", ImageTags: { Logo: "l" }, ParentLogoItemId: "s1", ParentLogoImageTag: "t" });
    expect(loadingArt(client, ep).logoUrl).toBe("e1/Logo?tag=l");
  });
});
