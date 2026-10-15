import {
  GUEST_PARENTAL_NONE,
  effectiveGuestParental,
  type FamilyProfileDto,
  type GuestParentalCeiling,
  type GuestParentalControls,
} from "@tentacle-tv/shared";
import { isNeverSchedule } from "./parentalModel";

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

/** Un fragment du résumé : une clé de l'espace `userRights` et ses valeurs. */
export interface ParentalSummaryPart {
  key: string;
  values?: Record<string, string | number>;
}

/**
 * Ce qui sera EN VIGUEUR pour l'invité — la règle du serveur
 * (`effectiveGuestParental`, shared), rejouée sur le brouillon : note la plus
 * basse, blocages réunis, étiquettes permises du créateur, plages recoupées
 * (« Jamais » si elles ne se recoupent pas). `ratingName` nomme un score.
 */
export function effectiveParentalSummary(
  ceiling: GuestParentalCeiling,
  wanted: GuestParentalControls,
  ratingName: (score: number, subScore: number | null) => string | null,
): ParentalSummaryPart[] {
  const effective = effectiveGuestParental(ceiling, wanted);
  const parts: ParentalSummaryPart[] = [];
  if (effective.maxParentalRating !== null) {
    const name = ratingName(effective.maxParentalRating, effective.maxParentalSubRating);
    parts.push(name
      ? { key: "summary.ratingMax", values: { rating: name } }
      : { key: "summary.ratingMaxScore", values: { score: effective.maxParentalRating } });
  }
  if (effective.blockUnratedItems.length) parts.push({ key: "summary.unrated", values: { count: effective.blockUnratedItems.length } });
  if (effective.blockedTags.length) parts.push({ key: "summary.blockedTags", values: { count: effective.blockedTags.length } });
  if (effective.allowedTags.length) parts.push({ key: "summary.allowedTags", values: { count: effective.allowedTags.length } });
  if (isNeverSchedule(effective.accessSchedules)) parts.push({ key: "summary.scheduleNever" });
  else if (effective.accessSchedules.length) parts.push({ key: "summary.schedules", values: { count: effective.accessSchedules.length } });
  return parts.length ? parts : [{ key: "summary.noParental" }];
}
