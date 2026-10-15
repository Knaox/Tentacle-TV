import { describe, expect, it } from "vitest";
import {
  addSchedule,
  addTag,
  bitsFromMbps,
  currentRating,
  formatHour,
  isNeverSchedule,
  mbpsFromBits,
  ratingChoices,
  ratingLabel,
  removeSchedule,
  scheduleIsValid,
  tagSuggestions,
  toggleInList,
} from "./parentalModel";

/** Le contrôle parental, sans React : l'échelle de Jellyfin, les étiquettes, les plages. */

const TABLE = [
  { name: "FR-18", score: 18, subScore: null },
  { name: "TV-Y", score: 0, subScore: null },
  { name: "PG-13", score: 13, subScore: null },
  { name: "FR-12", score: 12, subScore: null },
  { name: "12", score: 12, subScore: null },
  { name: "FR-12", score: 12, subScore: null },
  { name: "TV-14 V", score: 14, subScore: 1 },
  { name: "TV-14", score: 14, subScore: null },
];

describe("l'échelle des notes", () => {
  it("regroupe les noms d'un même niveau, sans doublon, du plus permissif au plus strict", () => {
    const choices = ratingChoices(TABLE);
    expect(choices.map((choice) => choice.key)).toEqual(["0", "12", "13", "14", "14.1", "18"]);
    expect(choices[1].names).toEqual(["FR-12", "12"]);
  });

  it("retrouve le niveau posé, et garde une note que la table ne connaît plus", () => {
    const choices = ratingChoices(TABLE);
    expect(currentRating(choices, null, null)).toBeNull();
    expect(currentRating(choices, 14, 1)?.names).toEqual(["TV-14 V"]);
    expect(currentRating(choices, 16, null)).toEqual({ key: "16", score: 16, subScore: null, names: [] });
  });

  it("raccourcit les noms d'un niveau", () => {
    expect(ratingLabel({ key: "12", score: 12, subScore: null, names: ["a", "b", "c", "d"] }, 2)).toBe("a, b +2");
  });
});

describe("les étiquettes", () => {
  it("ajoute sans doublon (casse ignorée) ni vide, espaces resserrés", () => {
    expect(addTag(["Horreur"], "  horreur ")).toEqual(["Horreur"]);
    expect(addTag(["Horreur"], "   ")).toEqual(["Horreur"]);
    expect(addTag([], "  Gore   extrême ")).toEqual(["Gore extrême"]);
  });

  it("propose les étiquettes connues absentes de la liste et qui contiennent la saisie", () => {
    expect(tagSuggestions(["Horreur", "Gore", "Comédie"], ["gore"], "o")).toEqual(["Horreur", "Comédie"]);
  });

  it("coche et décoche un identifiant sans doublon", () => {
    expect(toggleInList(["a", "b"], "a", true)).toEqual(["b", "a"]);
    expect(toggleInList(["a", "b"], "a", false)).toEqual(["b"]);
  });
});

describe("les plages horaires", () => {
  it("dit l'heure à la demi-heure", () => {
    expect(formatHour(7.5)).toBe("07:30");
    expect(formatHour(24)).toBe("24:00");
  });

  it("refuse une fin avant le début, et une plage déjà posée", () => {
    const evening = { dayOfWeek: "Weekday" as const, startHour: 18, endHour: 21 };
    expect(scheduleIsValid({ ...evening, endHour: 18 })).toBe(false);
    expect(addSchedule([evening], evening)).toEqual([evening]);
    expect(addSchedule([], { ...evening, startHour: 22 })).toEqual([]);
    expect(removeSchedule(addSchedule([], evening), 0)).toEqual([]);
  });
});

describe("le débit", () => {
  it("passe des bits par seconde aux Mbit/s et retour, 0 restant « sans limite »", () => {
    expect(mbpsFromBits(8_000_000)).toBe(8);
    expect(mbpsFromBits(0)).toBe(0);
    expect(bitsFromMbps(2.5)).toBe(2_500_000);
    expect(bitsFromMbps(-1)).toBe(0);
  });
});

describe("« Jamais » : aucune plage ne se recoupe", () => {
  const never = [{ dayOfWeek: "Sunday" as const, startHour: 24, endHour: 24 }];

  it("la plage sentinelle du serveur se dit « Jamais », pas « Dimanche »", () => {
    expect(isNeverSchedule(never)).toBe(true);
    expect(isNeverSchedule([])).toBe(false);
    expect(isNeverSchedule([{ dayOfWeek: "Sunday", startHour: 20, endHour: 24 }])).toBe(false);
  });

  it("une vraie plage remplace « Jamais » au lieu de s'y ajouter", () => {
    const evening = { dayOfWeek: "Weekday" as const, startHour: 18, endHour: 21 };
    expect(addSchedule(never, evening)).toEqual([evening]);
  });
});
