import { describe, expect, it } from "vitest";
import i18next from "i18next";
import type { MediaItem } from "../types/media";
import type { LatestAdditions } from "../latestAdditions/latestAdditionsTypes";
import fr from "../i18n/locales/fr/cards";
import en from "../i18n/locales/en/cards";
import { latestAdditionsCaption, latestAdditionsDetailQuery, latestAdditionsLine, latestAdditionsSeasonId } from "./latestAdditions";

const i18n = i18next.createInstance();
await i18n.init({ lng: "fr", resources: { fr: { cards: fr }, en: { cards: en } }, interpolation: { escapeValue: false } });

const additions = (partial: Partial<LatestAdditions>): LatestAdditions => ({
  EpisodeCount: 0, SeasonNumbers: [], NewSeasonNumbers: [], NewSeries: false,
  LatestDate: "2026-10-02T20:00:00Z", LatestSeasonId: "s2", LatestSeasonNumber: 2, ...partial,
});
const grouped = (partial: Partial<LatestAdditions>): MediaItem =>
  ({ Id: "a", Name: "Série", Type: "Series", ProductionYear: 2019, LatestAdditions: additions(partial) });

describe("latestAdditionsLine", () => {
  it("« 3 nouveaux épisodes », « 1 nouvel épisode »", async () => {
    await i18n.changeLanguage("fr");
    expect(latestAdditionsLine(i18n.t, grouped({ EpisodeCount: 3, SeasonNumbers: [1, 2] }))).toBe("3 nouveaux épisodes");
    expect(latestAdditionsLine(i18n.t, grouped({ EpisodeCount: 1 }))).toBe("1 nouvel épisode");
  });

  it("une saison nouvelle l'emporte sur le compte de ses épisodes", async () => {
    await i18n.changeLanguage("fr");
    expect(latestAdditionsLine(i18n.t, grouped({ EpisodeCount: 10, NewSeasonNumbers: [3] }))).toBe("Nouvelle saison");
    expect(latestAdditionsLine(i18n.t, grouped({ EpisodeCount: 20, NewSeasonNumbers: [3, 4] }))).toBe("2 nouvelles saisons");
  });

  it("une série nouvelle l'emporte sur tout", async () => {
    await i18n.changeLanguage("fr");
    expect(latestAdditionsLine(i18n.t, grouped({ EpisodeCount: 24, NewSeasonNumbers: [1, 2], NewSeries: true }))).toBe("Nouvelle série");
  });

  it("en anglais", async () => {
    await i18n.changeLanguage("en");
    expect(latestAdditionsLine(i18n.t, grouped({ EpisodeCount: 3 }))).toBe("3 new episodes");
    expect(latestAdditionsLine(i18n.t, grouped({ NewSeasonNumbers: [2] }))).toBe("New season");
    expect(latestAdditionsLine(i18n.t, grouped({ NewSeries: true }))).toBe("New series");
  });

  it("la tuile « +N » qu'un client fabrique face à un serveur plus ancien dit son compte de la même façon", async () => {
    await i18n.changeLanguage("fr");
    const tile = { Id: "a", Name: "Série", Type: "Series", RecentlyAddedCount: 4 } as MediaItem;
    expect(latestAdditionsLine(i18n.t, tile)).toBe("4 nouveaux épisodes");
  });

  it("rien pour une carte ordinaire : elle garde sa légende", () => {
    const movie = { Id: "m", Name: "Film", Type: "Movie", ProductionYear: 2024 } as MediaItem;
    expect(latestAdditionsCaption(movie)).toBeNull();
    expect(latestAdditionsCaption({ ...movie, RecentlyAddedCount: 1 })).toBeNull();
    expect(latestAdditionsCaption(grouped({}))).toBeNull();
  });
});

describe("latestAdditionsSeasonId", () => {
  it("la saison de l'ajout le plus récent, rien hors regroupement", () => {
    expect(latestAdditionsSeasonId(grouped({ LatestSeasonId: "s3" }))).toBe("s3");
    expect(latestAdditionsSeasonId(grouped({ LatestSeasonId: null }))).toBeUndefined();
    expect(latestAdditionsSeasonId({ Id: "m", Name: "Film", Type: "Movie" })).toBeUndefined();
  });

  it("l'adresse de la fiche porte la saison, et rien d'autre pour une carte ordinaire", () => {
    expect(latestAdditionsDetailQuery(grouped({ LatestSeasonId: "s3" }))).toBe("?season=s3");
    expect(latestAdditionsDetailQuery({ Id: "m", Name: "Film", Type: "Movie" })).toBe("");
  });
});
