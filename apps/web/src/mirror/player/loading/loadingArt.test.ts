import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { loadingArt } from "./loadingArt";

const client = {
  getImageUrl: (id: string, type: string) => `${id}/${type}`,
} as unknown as Parameters<typeof loadingArt>[0];

const item = (fields: Partial<MediaItem>): MediaItem => ({ Id: "x", Name: "Nom", Type: "Movie", ...fields }) as MediaItem;

/** La même chaîne de repli que l'app (`loadingArt.ts`) : rien de demandé pour rien. */
describe("loadingArt", () => {
  it("ne montre rien sans média", () => {
    expect(loadingArt(client, null)).toEqual({ backdropUrl: null, posterUrl: null, logoUrl: null, title: "", subtitle: null });
  });

  it("prend le fond, l'affiche et le logo d'un film quand ils existent", () => {
    const art = loadingArt(client, item({
      Id: "m", BackdropImageTags: ["b"], ImageTags: { Primary: "p", Logo: "l" }, ProductionYear: 2024,
    }));
    expect(art).toEqual({ backdropUrl: "m/Backdrop", posterUrl: "m/Primary", logoUrl: "m/Logo", title: "Nom", subtitle: "2024" });
  });

  it("remonte à la série pour un épisode", () => {
    const art = loadingArt(client, item({
      Id: "e", Type: "Episode", Name: "Pilote", SeriesId: "s", SeriesName: "Série",
      SeriesPrimaryImageTag: "t", ParentIndexNumber: 1, IndexNumber: 2,
    }));
    expect(art.backdropUrl).toBe("s/Backdrop");
    expect(art.posterUrl).toBe("s/Primary");
    expect(art.logoUrl).toBeNull();
    expect(art.title).toBe("Série");
    expect(art.subtitle).toMatch(/Pilote$/);
  });
});
