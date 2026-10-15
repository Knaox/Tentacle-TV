import { describe, expect, it } from "vitest";
import type { FamilyProfileDto } from "@tentacle-tv/shared";
import { EMPTY_GUEST_PARENTAL, guestCeilingOf, guestParentalOf, hasGuestParental, sameGuestParental } from "./guestParental";

/** Le contrôle parental d'un invité, lu dans son profil de la Famille. */

const GUEST: FamilyProfileDto = {
  userId: "g-1", kind: "guest", name: "Zoé", color: "violet", hasPin: false, imageTag: null, since: null,
  createdBy: "o-1", createdByName: "Damien", rights: null,
} as FamilyProfileDto;

describe("le contrôle parental d'un invité", () => {
  it("un serveur d'avant (aucun champ) : rien de posé, aucune limite du créateur", () => {
    expect(guestParentalOf(GUEST)).toEqual(EMPTY_GUEST_PARENTAL);
    expect(guestCeilingOf(GUEST)).toBeNull();
    expect(hasGuestParental(guestParentalOf(GUEST))).toBe(false);
  });

  it("lit la valeur voulue et complète un champ manquant", () => {
    const profile = { ...GUEST, parental: { maxParentalRating: 10, blockedTags: ["horreur"] } } as unknown as FamilyProfileDto;
    expect(guestParentalOf(profile)).toEqual({ ...EMPTY_GUEST_PARENTAL, maxParentalRating: 10, blockedTags: ["horreur"] });
    expect(hasGuestParental(guestParentalOf(profile))).toBe(true);
  });

  it("compare deux réglages pour savoir s'il y a quelque chose à enregistrer", () => {
    expect(sameGuestParental(EMPTY_GUEST_PARENTAL, { ...EMPTY_GUEST_PARENTAL })).toBe(true);
    expect(sameGuestParental(EMPTY_GUEST_PARENTAL, { ...EMPTY_GUEST_PARENTAL, blockUnratedItems: ["Movie"] })).toBe(false);
  });
});
