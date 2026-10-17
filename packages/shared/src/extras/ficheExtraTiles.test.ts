import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import type { RichTrailer } from "../trailers";
import { ficheExtraTiles } from "./ficheExtraTiles";
import type { RelayedTrailerEntry } from "./trailerTarget";

const t = ((key: string, options?: { season?: number }) => (options?.season ? `${key}:${options.season}` : key)) as unknown as TFunction;
const ALLOCINE: RelayedTrailerEntry = {
  scope: { kind: "season", season: 2 }, playback: { kind: "dailymotion", videoId: "x8abcde" },
  name: "Saison 2 Bande-annonce VF", version: "localized", type: "trailer", source: "allocine",
};
const TMDB: RelayedTrailerEntry = {
  scope: { kind: "series" }, playback: { kind: "youtube", ytId: "aaaaaaaaaaa" },
  name: "Official Trailer", version: "original", type: "trailer", source: "tmdb",
};
const BONUS = { Id: "bonus1", Name: "Coulisses", ExtraType: "BehindTheScenes" };
const LEGACY: RichTrailer = { Name: "Trailer", Url: "https://www.youtube.com/watch?v=bbbbbbbbbbb" };

describe("extras › les tuiles du carrousel d'une fiche", () => {
  it("avec le catalogue : les extras locaux puis TOUTES ses vidéos, AlloCiné compris — jamais les vidéos d'avant", () => {
    const tiles = ficheExtraTiles(t, {
      local: [BONUS], ownerOf: new Map(), remote: [LEGACY], catalog: { entries: [ALLOCINE, TMDB], language: "fr" }, seasonNames: null,
    });
    expect(tiles.map((tile) => tile.target.kind)).toEqual(["local", "relay", "relay"]);
    expect(tiles[1]).toMatchObject({ title: "Saison 2 Bande-annonce VF", thumbUrl: "https://www.dailymotion.com/thumbnail/video/x8abcde" });
    expect(tiles[1].subtitle).toContain("common:trailerOrigin_allocine");
    expect(tiles[2]).toMatchObject({ youtubeId: "aaaaaaaaaaa" });
  });

  it("un carrousel qui réunit des saisons nomme la saison de chaque vidéo", () => {
    const tiles = ficheExtraTiles(t, {
      local: [], ownerOf: new Map(), remote: [], catalog: { entries: [ALLOCINE], language: "fr" }, seasonNames: new Map(),
    });
    expect(tiles[0].subtitle.startsWith("common:trailerScopeSeason:2 · ")).toBe(true);
  });

  it("sans catalogue : les vidéos d'avant (Jellyfin, TMDB), lues comme avant", () => {
    const tiles = ficheExtraTiles(t, { local: [], ownerOf: new Map(), remote: [LEGACY], catalog: null, seasonNames: null });
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ youtubeId: "bbbbbbbbbbb", target: { kind: "remote", trailer: LEGACY } });
  });
});
