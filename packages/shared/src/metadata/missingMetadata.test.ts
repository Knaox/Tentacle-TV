import { describe, expect, it } from "vitest";
import { hasProviderIdentity, lacksMetadata, type MetadataProbeItem } from "./missingMetadata";

/** Un titre tel que Jellyfin le rend quand il n'a rien trouvé : identifiants lus, tous vides. */
const bare = (Type: MetadataProbeItem["Type"], extra: Partial<MetadataProbeItem> = {}): MetadataProbeItem => ({
  Type,
  ProviderIds: {},
  ...extra,
});

describe("lacksMetadata — un titre que Jellyfin n'a pas trouvé", () => {
  it("une série, un film, une saison, un épisode sans rien : oui", () => {
    for (const type of ["Series", "Movie", "Season", "Episode"] as const) {
      expect(lacksMetadata(bare(type))).toBe(true);
    }
  });

  it("un identifiant de fournisseur suffit à dire « trouvé »", () => {
    expect(lacksMetadata(bare("Series", { ProviderIds: { Tmdb: "12345" } }))).toBe(false);
    expect(lacksMetadata(bare("Movie", { ProviderIds: { Imdb: "tt0000001" } }))).toBe(false);
  });

  it("des identifiants vides ou blancs ne comptent pas", () => {
    expect(lacksMetadata(bare("Movie", { ProviderIds: { Tmdb: "", Imdb: "  " } }))).toBe(true);
  });

  it("un résumé (NFO local, saisie manuelle) suffit aussi", () => {
    expect(lacksMetadata(bare("Movie", { Overview: "Un lama et un pingouin." }))).toBe(false);
    expect(lacksMetadata(bare("Movie", { Overview: "   " }))).toBe(true);
  });

  it("un épisode ou une saison d'une série qui a ses images n'est qu'en retard : non", () => {
    expect(lacksMetadata(bare("Episode", { SeriesPrimaryImageTag: "abc" }))).toBe(false);
    expect(lacksMetadata(bare("Episode", { ParentBackdropImageTags: ["b1"] }))).toBe(false);
    expect(lacksMetadata(bare("Season", { ParentLogoImageTag: "l1" }))).toBe(false);
    // Une série sans rien : l'épisode est concerné.
    expect(lacksMetadata(bare("Episode", { ParentBackdropImageTags: [] }))).toBe(true);
  });

  it("faute de savoir (identifiants non demandés), non", () => {
    expect(lacksMetadata({ Type: "Series" })).toBe(false);
    expect(lacksMetadata(null)).toBe(false);
    expect(lacksMetadata(undefined)).toBe(false);
  });

  it("une collection ou un album ne sont pas concernés", () => {
    expect(lacksMetadata(bare("BoxSet"))).toBe(false);
    expect(lacksMetadata(bare("MusicAlbum"))).toBe(false);
  });
});

describe("hasProviderIdentity", () => {
  it("lit les valeurs, pas les clés", () => {
    expect(hasProviderIdentity({ Tvdb: "81189" })).toBe(true);
    expect(hasProviderIdentity({ Tvdb: "" })).toBe(false);
    expect(hasProviderIdentity(undefined)).toBe(false);
  });
});
