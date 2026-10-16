import { GUEST_PARENTAL_NONE, type GuestParentalControls } from "@tentacle-tv/shared";
import { describe, expect, it } from "vitest";
import {
  cappedByCeiling,
  currentCappedByCeiling,
  currentParentalAge,
  parentalAgeChoices,
  parentalRatingNames,
  parentalAgeSlots,
  withParentalAge,
  type ParentalAgeChoice,
} from "./parentalAge";

/** Une table française de Jellyfin 10.11 (relevée sur le banc parental), plus deux entrées à sous-note au score 12 :
 *  la sous-note 1 n'y couvre pas tout le score (« 12 – avertissement » passe au-dessus). */
const FR = [
  { name: "U", score: 0, subScore: null },
  { name: "6+", score: 6, subScore: null },
  { name: "10", score: 10, subScore: null },
  { name: "12", score: 12, subScore: null },
  { name: "16", score: 16, subScore: null },
  { name: "18", score: 18, subScore: null },
  { name: "Approved", score: 12, subScore: 1 },
  { name: "12 – avertissement", score: 12, subScore: 2 },
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

describe("parentalAgeSlots", () => {
  const choices = parentalAgeChoices(FR);

  it("sans réglage fait ailleurs : les paliers tels quels", () => {
    expect(parentalAgeSlots(choices, { kind: "choice", key: "age:12" }).map((slot) => slot.key)).toEqual(choices.map((choice) => choice.key));
  });

  it("un réglage fait ailleurs se range à sa place dans l'échelle", () => {
    const custom = currentParentalAge(choices, { ...GUEST_PARENTAL_NONE, maxParentalRating: 12, maxParentalSubRating: 1 }, FR);
    expect(parentalAgeSlots(choices, custom).map((slot) => slot.key)).toEqual(["age:0", "age:6", "age:10", "age:12", "custom", "age:16", "none"]);
    const above = currentParentalAge(choices, { ...GUEST_PARENTAL_NONE, maxParentalRating: 18 }, FR);
    expect(parentalAgeSlots(choices, above).map((slot) => slot.key)).toEqual(["age:0", "age:6", "age:10", "age:12", "age:16", "custom", "none"]);
  });
});

describe("currentCappedByCeiling", () => {
  const choices = parentalAgeChoices(FR);

  it("un palier ou un réglage fait ailleurs au-delà du plafond", () => {
    expect(currentCappedByCeiling(choices, { kind: "choice", key: "none" }, { maxParentalRating: 12 })).toBe(true);
    expect(currentCappedByCeiling(choices, { kind: "choice", key: "age:6" }, { maxParentalRating: 12 })).toBe(false);
    const custom = currentParentalAge(choices, { ...GUEST_PARENTAL_NONE, maxParentalRating: 18 }, FR);
    expect(currentCappedByCeiling(choices, custom, { maxParentalRating: 12 })).toBe(true);
    expect(currentCappedByCeiling(choices, custom, null)).toBe(false);
  });
});

describe("parentalRatingNames", () => {
  // Une table américaine où « R » porte une sous-note (relevé du banc, 16/10) : une note posée à 17 sans sous-note.
  const US_SUB = [
    { name: "PG-13", score: 13, subScore: null },
    { name: "R", score: 17, subScore: 0 },
    { name: "TV-MA", score: 17, subScore: 1 },
  ];

  it("sans sous-note : tous les noms du score, jamais une note muette", () => {
    expect(parentalRatingNames(US_SUB, 17, null)).toEqual(["R", "TV-MA"]);
    expect(currentParentalAge(parentalAgeChoices(US_SUB), { ...GUEST_PARENTAL_NONE, maxParentalRating: 17 }, US_SUB)).toMatchObject({
      kind: "custom",
      names: ["R", "TV-MA"],
    });
  });

  it("avec une sous-note : les siens, sinon ceux du score ; un score inconnu : aucun", () => {
    expect(parentalRatingNames(US_SUB, 17, 1)).toEqual(["TV-MA"]);
    expect(parentalRatingNames(US_SUB, 17, 5)).toEqual(["R", "TV-MA"]);
    expect(parentalRatingNames(US_SUB, 9, null)).toEqual([]);
  });
});

describe("currentParentalAge — une sous-note qui couvre tout son score", () => {
  // PG et TV-PG au score 10, chacun avec la sous-note 0 : une note posée ailleurs avec cette sous-note EST « 10 ans ».
  const US_PG = [
    { name: "G", score: 0, subScore: null },
    { name: "PG", score: 10, subScore: 0 },
    { name: "TV-PG", score: 10, subScore: 0 },
    { name: "PG-13", score: 13, subScore: null },
    { name: "TV-14", score: 14, subScore: 0 },
    { name: "TV-14-V", score: 14, subScore: 2 },
  ];
  const choices = parentalAgeChoices(US_PG);
  const at = (rating: number, sub: number | null) => ({ ...GUEST_PARENTAL_NONE, maxParentalRating: rating, maxParentalSubRating: sub });

  it("elle laisse passer toutes les entrées du score : le palier", () => {
    expect(currentParentalAge(choices, at(10, 0), US_PG)).toEqual({ kind: "choice", key: "age:10" });
  });

  it("elle en écarte une : plus stricte que le palier, montrée telle quelle", () => {
    expect(currentParentalAge(choices, at(14, 0), US_PG)).toMatchObject({ kind: "custom", score: 14, subScore: 0, names: ["TV-14"] });
  });
});
