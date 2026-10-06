import { describe, expect, it } from "vitest";
import type { JellyfinClient } from "@tentacle-tv/api-client";
import { heroImageKey, type MediaItem } from "@tentacle-tv/shared";
import { heroBackdropUrl, homeHeroImageUrl } from "./resolveBackdrop";

const client = {
  getImageUrl: (id: string, type: string, o?: { width?: number; quality?: number }) => `/Items/${id}/Images/${type}?w=${o?.width}&q=${o?.quality}`,
} as unknown as JellyfinClient;

const movie: MediaItem = { Id: "m1", Name: "Film", Type: "Movie", BackdropImageTags: ["b"], ImageTags: { Primary: "p" } };

describe("homeHeroImageUrl", () => {
  it("le fond d'un titre : la MÊME URL que la fiche et la transition (cache partagé)", () => {
    expect(homeHeroImageUrl(client, movie, new Set())).toBe(heroBackdropUrl(client, movie));
  });

  it("fond en 404 : l'affiche prend le relais, puis plus rien", () => {
    const failed = new Set([heroImageKey({ id: "m1", type: "Backdrop" })]);
    expect(homeHeroImageUrl(client, movie, failed)).toBe("/Items/m1/Images/Primary?w=1920&q=85");
    failed.add(heroImageKey({ id: "m1", type: "Primary" }));
    expect(homeHeroImageUrl(client, movie, failed)).toBeNull();
  });

  it("un titre sans aucune image annoncée : rien n'est demandé", () => {
    expect(homeHeroImageUrl(client, { Id: "x", Name: "x", Type: "Movie", ImageTags: {} }, new Set())).toBeNull();
  });
});
