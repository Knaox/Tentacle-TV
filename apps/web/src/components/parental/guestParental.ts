import type {
  FamilyGuestParentalFields,
  GuestParentalControls,
  ParentalCeiling,
} from "@tentacle-tv/api-client";
import type { FamilyProfileDto } from "@tentacle-tv/shared";

/**
 * Le contrôle parental d'un invité de la Famille, lu dans son profil — sans
 * React. La valeur VOULUE par son créateur (`parental`) ; la politique
 * effective, elle, vit dans Jellyfin, intersection de ce réglage et des
 * restrictions du créateur (`parentalCeiling`).
 */

export const EMPTY_GUEST_PARENTAL: GuestParentalControls = {
  maxParentalRating: null,
  maxParentalSubRating: null,
  blockUnratedItems: [],
  blockedTags: [],
  accessSchedules: [],
};

type ProfileWithParental = FamilyProfileDto & FamilyGuestParentalFields;

export function guestParentalOf(profile: FamilyProfileDto): GuestParentalControls {
  const parental = (profile as ProfileWithParental).parental;
  return parental ? { ...EMPTY_GUEST_PARENTAL, ...parental } : EMPTY_GUEST_PARENTAL;
}

export function guestCeilingOf(profile: FamilyProfileDto): ParentalCeiling | null {
  return (profile as ProfileWithParental).parentalCeiling ?? null;
}

/** Vrai dès que le créateur a posé quelque chose : note, type non classé, étiquette ou plage. */
export function hasGuestParental(controls: GuestParentalControls): boolean {
  return controls.maxParentalRating !== null
    || controls.blockUnratedItems.length > 0
    || controls.blockedTags.length > 0
    || controls.accessSchedules.length > 0;
}

export function sameGuestParental(a: GuestParentalControls, b: GuestParentalControls): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
