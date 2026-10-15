import {
  GUEST_PARENTAL_NONE,
  type FamilyProfileDto,
  type GuestParentalCeiling,
  type GuestParentalControls,
} from "@tentacle-tv/shared";

/**
 * Le contrôle parental d'un invité de la Famille, lu dans son profil — sans
 * React. La valeur VOULUE par son créateur (`parental`) ; la politique
 * effective, elle, vit dans Jellyfin, intersection de ce réglage et des
 * restrictions du créateur (`parentalCeiling`).
 */

export const EMPTY_GUEST_PARENTAL: GuestParentalControls = GUEST_PARENTAL_NONE;

/** La valeur voulue ; absente (serveur d'avant, ou appelant qui ne la règle pas) : aucune. */
export function guestParentalOf(profile: FamilyProfileDto): GuestParentalControls {
  return profile.parental ? { ...GUEST_PARENTAL_NONE, ...profile.parental } : GUEST_PARENTAL_NONE;
}

/** Le plafond du créateur ; null si absent ou si Jellyfin n'a pas répondu. */
export function guestCeilingOf(profile: FamilyProfileDto): GuestParentalCeiling | null {
  return profile.parentalCeiling ?? null;
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
