import { describe, expect, it } from "vitest";
import fr from "../i18n/locales/fr/preferences";
import en from "../i18n/locales/en/preferences";
import {
  STILL_WATCHING_AFTER_CHOICES,
  STILL_WATCHING_COUNTDOWN_CHOICES,
  stillWatchingAfterLabel,
  stillWatchingCountdownLabel,
} from "./stillWatchingChoices";

describe("stillWatchingChoices", () => {
  it("dit les durées avant la question en heures, et 1 h 30 à part", () => {
    expect(stillWatchingAfterLabel(3_600_000)).toEqual({ key: "preferences:stillWatchingHours", count: 1 });
    expect(stillWatchingAfterLabel(5_400_000)).toEqual({ key: "preferences:stillWatchingHourHalf" });
    expect(stillWatchingAfterLabel(7_200_000)).toEqual({ key: "preferences:stillWatchingHours", count: 2 });
    expect(stillWatchingAfterLabel(10_800_000)).toEqual({ key: "preferences:stillWatchingHours", count: 3 });
  });

  it("dit les délais de réponse en secondes, et la minute à part", () => {
    expect(stillWatchingCountdownLabel(10_000)).toEqual({ key: "preferences:stillWatchingSeconds", count: 10 });
    expect(stillWatchingCountdownLabel(30_000)).toEqual({ key: "preferences:stillWatchingSeconds", count: 30 });
    expect(stillWatchingCountdownLabel(60_000)).toEqual({ key: "preferences:stillWatchingMinute" });
  });

  it("reprend la liste FERMÉE du contrat, en millisecondes", () => {
    expect(STILL_WATCHING_AFTER_CHOICES.map((choice) => choice.ms)).toEqual([3_600_000, 5_400_000, 7_200_000, 10_800_000]);
    expect(STILL_WATCHING_COUNTDOWN_CHOICES.map((choice) => choice.ms)).toEqual([10_000, 30_000, 60_000]);
  });

  it("chaque clé rendue existe dans l'espace preferences, en français et en anglais", () => {
    for (const table of [fr, en]) {
      const keys = new Set(Object.keys(table));
      for (const { label } of [...STILL_WATCHING_AFTER_CHOICES, ...STILL_WATCHING_COUNTDOWN_CHOICES]) {
        const key = label.key.replace(/^preferences:/, "");
        expect(keys.has(label.count === undefined ? key : `${key}_one`), key).toBe(true);
      }
    }
  });
});
