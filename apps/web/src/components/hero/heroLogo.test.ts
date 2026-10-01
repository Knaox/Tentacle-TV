import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { heroLogoUrl } from "./heroLogo";

const client = {
  getImageUrl: (id: string, type: string, options?: { tag?: string }) => `${id}/${type}?tag=${options?.tag}`,
} as unknown as Parameters<typeof heroLogoUrl>[0];

const item = (fields: Partial<MediaItem>): MediaItem => ({ Id: "x", Name: "Nom", Type: "Movie", ...fields });

describe("heroLogoUrl", () => {
  it("ne demande pas le logo d'une série qui n'en annonce aucun", () => {
    // La bannière demandait `/Items/<SeriesId>/Images/Logo` sans condition :
    // 404, puis l'image cassée et son texte de remplacement à la place du titre.
    const episode = item({ Id: "e", Type: "Episode", SeriesId: "s", SeriesName: "Série" });
    expect(heroLogoUrl(client, episode)).toBeNull();
  });

  it("demande le logo hérité d'un épisode, par son tag", () => {
    const episode = item({ Id: "e", Type: "Episode", SeriesId: "s", ParentLogoItemId: "s", ParentLogoImageTag: "t" });
    expect(heroLogoUrl(client, episode)).toBe("s/Logo?tag=t");
  });

  it("demande le logo propre d'un film", () => {
    expect(heroLogoUrl(client, item({ Id: "m", ImageTags: { Logo: "l" } }))).toBe("m/Logo?tag=l");
  });
});
