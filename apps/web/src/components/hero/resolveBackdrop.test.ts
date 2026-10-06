import { describe, expect, it } from "vitest";
import type { JellyfinClient } from "@tentacle-tv/api-client";
import { heroImagePlan, type MediaItem } from "@tentacle-tv/shared";
import { heroBackdropUrl, heroOptionUrl } from "./resolveBackdrop";

const client = {
  getImageUrl: (id: string, type: string, o?: { width?: number; quality?: number; index?: number }) =>
    `/Items/${id}/Images/${type}${o?.index ? `/${o.index}` : ""}?w=${o?.width}&q=${o?.quality}`,
} as unknown as JellyfinClient;

const movie: MediaItem = { Id: "m1", Name: "Film", Type: "Movie", BackdropImageTags: ["b"], ImageTags: { Primary: "p" } };

describe("heroOptionUrl", () => {
  it("le fond d'un titre : la MÊME URL que la fiche et la transition (cache partagé)", () => {
    expect(heroOptionUrl(client, heroImagePlan(movie)[0])).toBe(heroBackdropUrl(client, movie));
  });

  it("un autre fond du repli : son rang dans l'URL", () => {
    const plan = heroImagePlan(movie, [{ kind: "jellyfin", itemId: "m1", type: "Backdrop", index: 2 }]);
    expect(heroOptionUrl(client, plan[1])).toBe("/Items/m1/Images/Backdrop/2?w=1920&q=85");
  });

  it("un fond TMDB : tel quel, en w300 pour le halo", () => {
    const [tmdb] = heroImagePlan({ ...movie, BackdropImageTags: [] }, [{ kind: "tmdb", url: "https://image.tmdb.org/t/p/w1280/x.jpg" }]);
    expect(heroOptionUrl(client, tmdb)).toBe("https://image.tmdb.org/t/p/w1280/x.jpg");
    expect(heroOptionUrl(client, tmdb, 128, 70)).toBe("https://image.tmdb.org/t/p/w300/x.jpg");
  });
});
