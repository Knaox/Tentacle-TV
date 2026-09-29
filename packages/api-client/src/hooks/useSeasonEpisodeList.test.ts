import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { getSeasonEpisodeSourcesKey, mergeSeasonSources } from "./useSeasonEpisodeList";
import { SEASON_FIELDS } from "./useSeasons";

const episode = (id: string, extra: Partial<MediaItem> = {}): MediaItem =>
  ({ Id: id, Name: id, Type: "Episode", ...extra }) as MediaItem;

describe("liste d'épisodes d'une saison", () => {
  it("les sources vivent hors du préfixe `episodes` : une coche « vu » ne les redemande pas", () => {
    expect(getSeasonEpisodeSourcesKey("serie", "saison")[0]).not.toBe("episodes");
  });

  it("greffe les sources par identifiant, sans toucher à l'état « vu » de la liste légère", () => {
    const lite = [
      episode("e1", { UserData: { Played: true, PlaybackPositionTicks: 0, PlayCount: 1, IsFavorite: false } }),
      episode("e2"),
    ];
    const sources = [episode("e2", { MediaSources: [{ Id: "ms2" }] as MediaItem["MediaSources"] }), episode("e1", { MediaSources: [{ Id: "ms1" }] as MediaItem["MediaSources"] })];
    const merged = mergeSeasonSources(lite, sources)!;
    expect(merged.map((ep) => ep.MediaSources?.[0]?.Id)).toEqual(["ms1", "ms2"]);
    expect(merged[0].UserData?.Played).toBe(true);
  });

  it("rien tant qu'il manque la liste ou ses sources ; un épisode sans source reste tel quel", () => {
    expect(mergeSeasonSources(undefined, [])).toBeUndefined();
    expect(mergeSeasonSources([episode("e1")], undefined)).toBeUndefined();
    const lone = episode("e3");
    expect(mergeSeasonSources([lone], [])![0]).toBe(lone);
  });

  it("les saisons portent leurs compteurs : épisodes, extras, bandes-annonces locales et distantes", () => {
    expect(SEASON_FIELDS.split(",")).toEqual(
      expect.arrayContaining(["RecursiveItemCount", "SpecialFeatureCount", "LocalTrailerCount", "RemoteTrailers"]),
    );
  });
});
