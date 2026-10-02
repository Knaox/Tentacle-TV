import { describe, expect, it } from "vitest";
import i18next from "i18next";
import fr from "../i18n/locales/fr/requests";
import en from "../i18n/locales/en/requests";
import type { TitleSeason, TitleSeasonsAnswer } from "./pluginTitleSeasons";
import { requestableSeasonNumbers, seasonPick } from "./seasonPick";

/**
 * La feuille des saisons, la même partout : l'extension dit ce qui se demande,
 * la bibliothèque dit ce qu'on a — et ce qu'on a ne se coche jamais.
 */

const i18n = i18next.createInstance();
await i18n.init({ lng: "fr", resources: { fr: { requests: fr }, en: { requests: en } }, interpolation: { escapeValue: false } });

const season = (number: number, partial: Partial<TitleSeason> = {}): TitleSeason => ({
  number, name: `Saison ${number}`, episodeCount: 10, badge: null, requestable: true, ...partial,
});
const answer = (seasons: TitleSeason[]): TitleSeasonsAnswer => ({ seasons, failure: null });
const NONE = new Set<number>();

describe("seasonPick", () => {
  it("dit « Dans la bibliothèque » des saisons qu'on a, même quand l'extension les offre encore", () => {
    const pick = seasonPick(i18n.t, answer([
      season(1, { badge: { label: "Disponible", tone: "success" }, requestable: false }),
      season(2),
      season(3),
      season(4, { badge: { label: "Demandée", tone: "info" }, requestable: false }),
      season(5),
    ]), false, new Set([3, 5]), new Set([1, 2]));
    expect(pick.rows?.map((row) => [row.number, row.status?.label ?? null, row.selected])).toEqual([
      [1, "Dans la bibliothèque", false],
      [2, "Dans la bibliothèque", false],
      [3, null, true],
      [4, "Demandée", false],
      [5, null, true],
    ]);
    expect(pick.rows?.[3].status?.tone).toBe("pending");
    expect(pick.requestable).toEqual([3, 5]);
    expect(pick.chosen).toEqual([3, 5]);
    expect(pick.submitLabel).toBe("Demander 2 saisons");
    expect(pick.message).toBeUndefined();
  });

  it("ne compte que ce qui se coche : une case d'une saison qu'on a n'envoie rien", () => {
    const pick = seasonPick(i18n.t, answer([season(1), season(2)]), false, new Set([1]), new Set([1]));
    expect(pick.chosen).toEqual([]);
    expect(pick.submitLabel).toBeNull();
    expect(requestableSeasonNumbers(answer([season(1), season(2)]), new Set([1]))).toEqual([2]);
  });

  it("dit la lecture, l'échec, et quand il n'y a plus rien à demander", () => {
    expect(seasonPick(i18n.t, null, false, NONE).message).toBe("Lecture des saisons…");
    expect(seasonPick(i18n.t, null, false, NONE).rows).toBeNull();
    expect(seasonPick(i18n.t, null, true, NONE).message).toBe("Les saisons ne se lisent pas pour l'instant. Réessayez plus tard.");
    expect(seasonPick(i18n.t, { seasons: [], failure: "" }, false, NONE).message).toBe("Les saisons ne se lisent pas pour l'instant. Réessayez plus tard.");
    const done = seasonPick(i18n.t, answer([season(1, { requestable: false })]), false, NONE, new Set([1]));
    expect(done.message).toBe("Toutes ses saisons sont déjà là ou demandées.");
  });

  it("nomme une saison sans nom, compte ses épisodes, en anglais aussi", async () => {
    await i18n.changeLanguage("en");
    const pick = seasonPick(i18n.t, answer([season(2, { name: null, episodeCount: 1 })]), false, new Set([2]), new Set([1]));
    expect(pick.rows?.[0]).toEqual({ number: 2, label: "Season 2", detail: "1 episode", selected: true });
    expect(pick.submitLabel).toBe("Request 1 season");
    await i18n.changeLanguage("fr");
  });
});
