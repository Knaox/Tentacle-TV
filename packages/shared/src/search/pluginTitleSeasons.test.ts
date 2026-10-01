import { describe, expect, it } from "vitest";
import { titleProvider } from "./pluginTitles";
import { MAX_TITLE_SEASONS, readTitleSeasons, titleSeasonsUrl } from "./pluginTitleSeasons";

const vigie = {
  pluginId: "seer",
  configEnabled: true,
  titles: { state: "/titles/state", request: "/titles/request", seasons: "/titles/seasons" },
};

describe("les saisons d'une série dans le contrat titles", () => {
  it("se lisent sur la déclaration, pour une série seulement", () => {
    const provider = titleProvider([vigie])!;
    expect(provider.seasonsPath).toBe("/titles/seasons");
    expect(titleSeasonsUrl(provider, "tv:1399", "fr")).toBe("/api/plugins/seer/titles/seasons?key=tv%3A1399&lang=fr");
    expect(titleSeasonsUrl(provider, "movie:603", "fr")).toBeNull();
  });

  it("manquent sans rien casser chez un plugin d'avant, ou mal formées", () => {
    const old = titleProvider([{ ...vigie, titles: { state: "/titles/state", request: "/titles/request" } }])!;
    expect(old.seasonsPath).toBeNull();
    expect(titleSeasonsUrl(old, "tv:1399", "fr")).toBeNull();
    const bad = titleProvider([{ ...vigie, titles: { state: "/s", seasons: "https://x.y/z" } }])!;
    expect(bad.seasonsPath).toBeNull();
  });

  it("valide chaque saison, et écarte l'illisible et les doublons", () => {
    const answer = readTitleSeasons({
      seasons: [
        { number: 1, name: "Saison 1", episodeCount: 10, badge: { label: "Disponible", tone: "success" }, requestable: false },
        { number: 2, name: "  ", episodeCount: -3, badge: { label: "Demandée", tone: "rouge" }, requestable: true },
        { number: 2, name: "Doublon", requestable: true },
        { number: 1.5, requestable: true },
        { number: "3", requestable: true },
        null,
      ],
    });
    expect(answer).toEqual({
      failure: null,
      seasons: [
        { number: 1, name: "Saison 1", episodeCount: 10, badge: { label: "Disponible", tone: "success" }, requestable: false },
        { number: 2, name: null, episodeCount: null, badge: { label: "Demandée", tone: "neutral" }, requestable: true },
      ],
    });
  });

  it("dit quand le plugin ne peut pas répondre, et borne la liste", () => {
    expect(readTitleSeasons({ ok: false, message: "Indisponible.", seasons: [] })).toEqual({ seasons: [], failure: "Indisponible." });
    expect(readTitleSeasons(null)).toEqual({ seasons: [], failure: null });
    const many = Array.from({ length: MAX_TITLE_SEASONS + 5 }, (_, i) => ({ number: i, requestable: true }));
    expect(readTitleSeasons({ seasons: many }).seasons).toHaveLength(MAX_TITLE_SEASONS);
  });
});
