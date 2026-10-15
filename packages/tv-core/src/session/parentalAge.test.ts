import { GUEST_PARENTAL_NONE, type GuestParentalControls } from "@tentacle-tv/shared";
import { describe, expect, it } from "vitest";
import {
  cappedByCeiling,
  currentParentalAge,
  parentalAgeChoices,
  withParentalAge,
  type ParentalAgeChoice,
} from "./parentalAge";

/** Une table française de Jellyfin 10.11 (relevée sur le banc parental), plus une entrée à sous-note. */
const FR = [
  { name: "U", score: 0, subScore: null },
  { name: "6+", score: 6, subScore: null },
  { name: "10", score: 10, subScore: null },
  { name: "12", score: 12, subScore: null },
  { name: "16", score: 16, subScore: null },
  { name: "18", score: 18, subScore: null },
  { name: "Approved", score: 12, subScore: 1 },
];

/** Une table américaine : PG = 10, PG-13 = 13, R = 17. */
const US = [
  { name: "G", score: 0, subScore: null },
  { name: "PG", score: 10, subScore: null },
  { name: "PG-13", score: 13, subScore: null },
  { name: "R", score: 17, subScore: null },
];

const keys = (choices: ParentalAgeChoice[]) => choices.map((choice) => choice.key);

describe("parentalAgeChoices", () => {
  it("un palier par âge quand la table les a tous, puis « Sans limite »", () => {
    expect(keys(parentalAgeChoices(FR))).toEqual(["age:0", "age:6", "age:10", "age:12", "age:16", "none"]);
    expect(parentalAgeChoices(FR).find((choice) => choice.key === "age:16")).toMatchObject({ score: 16 });
  });

  it("un palier vaut le plus grand score qui ne le dépasse pas ; deux paliers sur un score n'en font qu'un, le plus jeune", () => {
    const choices = parentalAgeChoices(US);
    expect(keys(choices)).toEqual(["age:0", "age:10", "age:16", "none"]);
    expect(choices.find((choice) => choice.key === "age:16")).toMatchObject({ score: 13 });
  });

  it("une table vide ne laisse que « Sans limite »", () => {
    expect(keys(parentalAgeChoices([]))).toEqual(["none"]);
  });
});

describe("currentParentalAge", () => {
  const choices = parentalAgeChoices(FR);
  const at = (rating: number | null, sub: number | null = null): GuestParentalControls => ({
    ...GUEST_PARENTAL_NONE,
    maxParentalRating: rating,
    maxParentalSubRating: sub,
  });

  it("aucune note : « Sans limite »", () => {
    expect(currentParentalAge(choices, at(null), FR)).toEqual({ kind: "choice", key: "none" });
  });

  it("une note sur un palier : ce palier", () => {
    expect(currentParentalAge(choices, at(12), FR)).toEqual({ kind: "choice", key: "age:12" });
  });

  it("une note réglée ailleurs, hors palier ou à sous-note : montrée telle quelle, avec ses noms", () => {
    expect(currentParentalAge(choices, at(18), FR)).toEqual({ kind: "custom", key: "custom", score: 18, subScore: null, names: ["18"] });
    expect(currentParentalAge(choices, at(12, 1), FR)).toMatchObject({ kind: "custom", names: ["Approved"] });
    expect(currentParentalAge(choices, at(7), FR)).toMatchObject({ kind: "custom", score: 7, names: [] });
  });
});

describe("withParentalAge", () => {
  const wanted: GuestParentalControls = {
    maxParentalRating: 12,
    maxParentalSubRating: 1,
    blockUnratedItems: ["Movie"],
    blockedTags: ["gore"],
    accessSchedules: [{ dayOfWeek: "Weekday", startHour: 17, endHour: 20 }],
  };

  it("seule la note change, sans sous-note ; le reste réglé ailleurs repart tel quel", () => {
    const six = parentalAgeChoices(FR).find((choice) => choice.key === "age:6") as ParentalAgeChoice;
    expect(withParentalAge(wanted, six)).toEqual({ ...wanted, maxParentalRating: 6, maxParentalSubRating: null });
  });

  it("« Sans limite » retire la note", () => {
    expect(withParentalAge(wanted, { kind: "none", key: "none" })).toMatchObject({ maxParentalRating: null, maxParentalSubRating: null, blockedTags: ["gore"] });
  });
});

describe("cappedByCeiling", () => {
  const choices = parentalAgeChoices(FR);
  const sixteen = choices.find((choice) => choice.key === "age:16") as ParentalAgeChoice;
  const ten = choices.find((choice) => choice.key === "age:10") as ParentalAgeChoice;

  it("un plafond plus strict que le palier : Jellyfin appliquera le plafond", () => {
    expect(cappedByCeiling(sixteen, { maxParentalRating: 12 })).toBe(true);
    expect(cappedByCeiling({ kind: "none", key: "none" }, { maxParentalRating: 12 })).toBe(true);
    expect(cappedByCeiling(ten, { maxParentalRating: 12 })).toBe(false);
  });

  it("sans plafond, ou plafond inconnu : rien à dire", () => {
    expect(cappedByCeiling(sixteen, { maxParentalRating: null })).toBe(false);
    expect(cappedByCeiling(sixteen, null)).toBe(false);
  });
});
