import { describe, expect, it } from "vitest";
import { titleProvider } from "./pluginTitles";
import { readTitleGaps, requestableGaps, seriesTitleKey, titleGapsUrl } from "./pluginTitleGaps";

const vigie = {
  pluginId: "seer",
  configEnabled: true,
  titles: { state: "/titles/state", request: "/titles/request", seasons: "/titles/seasons", gaps: "/titles/gaps" },
};

describe("les saisons qui manquent aux séries de la bibliothèque", () => {
  it("se demandent en UNE question, pour des séries seulement", () => {
    const provider = titleProvider([vigie])!;
    expect(provider.gapsPath).toBe("/titles/gaps");
    expect(titleGapsUrl(provider, ["tv:1399", "movie:603", "tv:1396"], "fr"))
      .toBe("/api/plugins/seer/titles/gaps?keys=tv%3A1399%2Ctv%3A1396&lang=fr");
    expect(titleGapsUrl(provider, ["movie:603"], "fr")).toBeNull();
  });

  it("manquent sans rien casser chez un plugin d'avant, ou mal formées", () => {
    const old = titleProvider([{ ...vigie, titles: { state: "/titles/state", seasons: "/titles/seasons" } }])!;
    expect(old.gapsPath).toBeNull();
    expect(titleGapsUrl(old, ["tv:1399"], "fr")).toBeNull();
    const bad = titleProvider([{ ...vigie, titles: { state: "/s", gaps: "//evil/x" } }])!;
    expect(bad.gapsPath).toBeNull();
  });

  it("ne lit que les séries demandées, saison par saison", () => {
    const gaps = readTitleGaps({
      items: {
        "tv:1399": {
          seasons: [
            { number: 7, name: "Saison 7", episodeCount: 7, badge: { label: "Demandée", tone: "info" }, requestable: false },
            { number: 8, name: "Saison 8", episodeCount: 6, badge: null, requestable: true },
            { number: 8, name: "Doublon", requestable: true },
            { number: "9", requestable: true },
          ],
        },
        "tv:1396": { seasons: [] },
        "tv:42": { seasons: [{ number: 1, requestable: true }] },
        "movie:603": { seasons: [{ number: 1, requestable: true }] },
      },
    }, ["tv:1399", "tv:1396", "movie:603"]);
    expect([...gaps.keys()]).toEqual(["tv:1399", "movie:603"]);
    expect(gaps.get("tv:1399")?.map((s) => [s.number, s.requestable])).toEqual([[7, false], [8, true]]);
    expect(requestableGaps(gaps.get("tv:1399")).map((s) => s.number)).toEqual([8]);
  });

  it("une réponse illisible ne dit rien", () => {
    expect(readTitleGaps(null, ["tv:1"]).size).toBe(0);
    expect(readTitleGaps({ items: [] }, ["tv:1"]).size).toBe(0);
    expect(readTitleGaps({ items: { "tv:1": { seasons: "1,2" } } }, ["tv:1"]).size).toBe(0);
    expect(requestableGaps(undefined)).toEqual([]);
  });

  it("la clé d'une série de la bibliothèque vient de son identité TMDB", () => {
    expect(seriesTitleKey({ Type: "Series", ProviderIds: { Tmdb: "1396" } })).toBe("tv:1396");
    expect(seriesTitleKey({ Type: "Movie", ProviderIds: { Tmdb: "603" } })).toBeNull();
    expect(seriesTitleKey({ Type: "Series" })).toBeNull();
    expect(seriesTitleKey({ Type: "Series", ProviderIds: { Tmdb: "abc" } })).toBeNull();
    expect(seriesTitleKey({ Type: "Series", ProviderIds: { Tmdb: "0" } })).toBeNull();
  });
});
