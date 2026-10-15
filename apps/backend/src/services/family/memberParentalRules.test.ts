import { describe, expect, it } from "vitest";
import { GUEST_PARENTAL_NONE, type GuestParentalCeiling } from "../../family/familyParental";
import { memberParentalTarget, previousWrite, rebaseMemberParental, sameParental, withParentalFields } from "./memberParentalRules";

/**
 * Le membre mineur — la base gardée, recoupée, puis rendue : un champ changé
 * ailleurs devient la base, jamais ce que la famille y avait ajouté.
 */

const BASE: GuestParentalCeiling = {
  maxParentalRating: 16,
  maxParentalSubRating: null,
  blockUnratedItems: ["Book"],
  blockedTags: ["horreur"],
  allowedTags: [],
  accessSchedules: [],
};

const WANTED = { ...GUEST_PARENTAL_NONE, maxParentalRating: 6, blockUnratedItems: ["Movie" as const], blockedTags: ["guerre"] };

describe("la cible et la dernière écriture", () => {
  it("la base recoupée avec le voulu : la note la plus basse, les listes réunies", () => {
    expect(memberParentalTarget(BASE, WANTED)).toEqual({
      maxParentalRating: 6,
      maxParentalSubRating: null,
      blockUnratedItems: ["Book", "Movie"],
      blockedTags: ["horreur", "guerre"],
      allowedTags: [],
      accessSchedules: [],
    });
  });

  it("retiré : la base seule", () => {
    expect(memberParentalTarget(BASE, null)).toEqual(BASE);
  });

  it("sans relecture confirmée, la dernière écriture est ce qu'on a voulu écrire", () => {
    expect(previousWrite(BASE, WANTED, null)).toEqual(memberParentalTarget(BASE, WANTED));
    expect(previousWrite(BASE, WANTED, BASE)).toEqual(BASE);
  });
});

describe("rebaseMemberParental", () => {
  const written = memberParentalTarget(BASE, WANTED);

  it("rien n'a changé ailleurs : la base reste", () => {
    expect(rebaseMemberParental(BASE, written, written)).toEqual(BASE);
  });

  it("l'administrateur relève la note : elle devient la base (la famille la rabaissera)", () => {
    const next = rebaseMemberParental(BASE, written, { ...written, maxParentalRating: 18 });
    expect(next.maxParentalRating).toBe(18);
    expect(memberParentalTarget(next, WANTED).maxParentalRating).toBe(6);
  });

  it("une étiquette ajoutée par l'administrateur entre dans la base ; celle de la famille, jamais", () => {
    const next = rebaseMemberParental(BASE, written, { ...written, blockedTags: ["horreur", "guerre", "zombies"] });
    expect(next.blockedTags).toEqual(["horreur", "zombies"]);
  });

  it("une étiquette de la base retirée par l'administrateur en sort ; celle de la famille revient au recoupement", () => {
    const next = rebaseMemberParental(BASE, written, { ...written, blockedTags: [] });
    expect(next.blockedTags).toEqual([]);
    expect(memberParentalTarget(next, WANTED).blockedTags).toEqual(["guerre"]);
  });

  it("types non classés : même règle ; étiquettes permises et plages : la valeur lue", () => {
    const schedules = [{ dayOfWeek: "Weekend" as const, startHour: 8, endHour: 20 }];
    const next = rebaseMemberParental(BASE, written, {
      ...written,
      blockUnratedItems: ["Movie", "Series"],
      allowedTags: ["enfants"],
      accessSchedules: schedules,
    });
    expect(next.blockUnratedItems).toEqual(["Series"]);
    expect(next.allowedTags).toEqual(["enfants"]);
    expect(next.accessSchedules).toEqual(schedules);
  });

  it("compare sans ordre ni casse", () => {
    expect(sameParental({ ...BASE, blockedTags: ["A", "b"] }, { ...BASE, blockedTags: ["B", "a"] })).toBe(true);
    expect(sameParental(BASE, { ...BASE, maxParentalSubRating: 1 })).toBe(false);
  });
});

describe("withParentalFields", () => {
  it("pose les six champs au nom du compte, sans toucher au reste", () => {
    const policy = { IsAdministrator: false, AuthenticationProviderId: "x", MaxParentalRating: 16, Unknown: [1] };
    const out = withParentalFields("u1", policy, { ...BASE, accessSchedules: [{ dayOfWeek: "Monday", startHour: 1, endHour: 2 }] });
    expect(out).toEqual({
      IsAdministrator: false,
      AuthenticationProviderId: "x",
      Unknown: [1],
      MaxParentalRating: 16,
      MaxParentalSubRating: null,
      BlockUnratedItems: ["Book"],
      BlockedTags: ["horreur"],
      AllowedTags: [],
      AccessSchedules: [{ DayOfWeek: "Monday", StartHour: 1, EndHour: 2, UserId: "u1" }],
    });
  });
});
