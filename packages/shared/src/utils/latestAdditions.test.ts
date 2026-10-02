import { describe, expect, it } from "vitest";
import i18next from "i18next";
import type { MediaItem } from "../types/media";
import type { LatestAdditions } from "../latestAdditions/latestAdditionsTypes";
import fr from "../i18n/locales/fr/cards";
import en from "../i18n/locales/en/cards";
import { latestAdditionsCaption, latestAdditionsDetailQuery, latestAdditionsLine, latestAdditionsSeasonId } from "./latestAdditions";

const i18n = i18next.createInstance();
await i18n.init({ lng: "fr", resources: { fr: { cards: fr }, en: { cards: en } }, interpolation: { escapeValue: false } });

/** La ligne lue à l'œil : ses espaces insécables comptent pour des espaces. */
const line = (item: MediaItem): string | null => latestAdditionsLine(i18n.t, item)?.replace(/\u00A0/g, " ") ?? null;

const additions = (partial: Partial<LatestAdditions>): LatestAdditions => ({
  EpisodeCount: 0, SeasonNumbers: [], NewSeasonNumbers: [], NewSeries: false,
  LatestDate: "2026-10-02T20:00:00Z", LatestSeasonId: "s2", LatestSeasonNumber: 2, ...partial,
});
const grouped = (partial: Partial<LatestAdditions>): MediaItem =>
  ({ Id: "a", Name: "Série", Type: "Series", ProductionYear: 2019, LatestAdditions: additions(partial) });

describe("latestAdditionsLine", () => {
  it("« 3 nouveaux épisodes », « 1 nouvel épisode »", async () => {
    await i18n.changeLanguage("fr");
    expect(line(grouped({ EpisodeCount: 3, SeasonNumbers: [1, 2] }))).toBe("3 nouveaux épisodes");
    expect(line(grouped({ EpisodeCount: 1 }))).toBe("1 nouvel épisode");
  });

  it("une saison nouvelle l'emporte, le nombre d'épisodes se lit toujours", async () => {
    await i18n.changeLanguage("fr");
    expect(line(grouped({ EpisodeCount: 10, NewSeasonNumbers: [3] }))).toBe("Nouvelle saison · 10 épisodes");
    expect(line(grouped({ EpisodeCount: 1, NewSeasonNumbers: [3] }))).toBe("Nouvelle saison · 1 épisode");
    expect(line(grouped({ EpisodeCount: 20, NewSeasonNumbers: [3, 4] }))).toBe("2 nouvelles saisons · 20 épisodes");
  });

  it("une série nouvelle l'emporte sur tout, avec son nombre d'épisodes", async () => {
    await i18n.changeLanguage("fr");
    expect(line(grouped({ EpisodeCount: 24, NewSeasonNumbers: [1, 2], NewSeries: true })))
      .toBe("Nouvelle série · 24 épisodes");
  });

  it("un dossier seul, sans épisode dans la rangée : la nouveauté sans compte", async () => {
    await i18n.changeLanguage("fr");
    expect(line(grouped({ NewSeasonNumbers: [4] }))).toBe("Nouvelle saison");
    expect(line(grouped({ NewSeries: true }))).toBe("Nouvelle série");
  });

  it("en anglais", async () => {
    await i18n.changeLanguage("en");
    expect(line(grouped({ EpisodeCount: 3 }))).toBe("3 new episodes");
    expect(line(grouped({ EpisodeCount: 8, NewSeasonNumbers: [2] }))).toBe("New season · 8 episodes");
    expect(line(grouped({ EpisodeCount: 1, NewSeries: true }))).toBe("New series · 1 episode");
  });

  it("une carte étroite passe à la ligne avant le compte, jamais au milieu", async () => {
    await i18n.changeLanguage("fr");
    const raw = latestAdditionsLine(i18n.t, grouped({ EpisodeCount: 8, NewSeasonNumbers: [2] }));
    // Seule coupure possible : après le point médian.
    expect(raw?.split(" ")).toEqual(["Nouvelle", "saison\u00A0·", "8\u00A0épisodes"]);
  });

  it("un écran qui traduit lui-même reçoit les morceaux de la ligne", () => {
    expect(latestAdditionsCaption(grouped({ EpisodeCount: 8, NewSeasonNumbers: [2] }))).toEqual([
      { key: "cards:newSeasons", count: 1 }, { key: "cards:episodeCount", count: 8 },
    ]);
  });

  it("la tuile « +N » qu'un client fabrique face à un serveur plus ancien dit son compte de la même façon", async () => {
    await i18n.changeLanguage("fr");
    const tile = { Id: "a", Name: "Série", Type: "Series", RecentlyAddedCount: 4 } as MediaItem;
    expect(line(tile)).toBe("4 nouveaux épisodes");
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
