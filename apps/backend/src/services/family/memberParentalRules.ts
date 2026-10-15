import { effectiveGuestParental, type GuestParentalCeiling, type GuestParentalControls } from "../../family/familyParental";
import type { AccessScheduleDto } from "../../userRights/userRightsContract";
import { schedulesToJellyfin, type JellyfinPolicy } from "../userRights/policyMapping";
import { ceilingFromPolicy } from "./guestParentalPolicy";

/**
 * Le contrôle parental d'un MEMBRE mineur — règles pures (docs/DROITS-UTILISATEURS.md
 * § 9.4). Jellyfin porte la politique EFFECTIVE : l'intersection de la BASE (les
 * champs parentaux que règle l'administrateur) et du contrôle VOULU par la famille.
 * Tentacle garde la base, le voulu et la dernière écriture ; au retrait, la base
 * est rendue telle quelle.
 *
 * Un champ de la politique qui diffère de ce que Tentacle y a écrit a été changé
 * AILLEURS — par l'administrateur, depuis Tentacle (le service des droits écrit
 * d'abord, puis prévient) ou directement dans Jellyfin : ce champ devient la base.
 * Pour les listes que la famille ALLONGE (types non classés, étiquettes bloquées),
 * seul ce que l'administrateur y a mis entre dans la base — jamais ce que la famille
 * y avait ajouté, sinon le retrait ne rendrait pas la base d'origine.
 */

function fold(value: string): string {
  return value.trim().toLowerCase();
}

function sameSet(a: readonly string[], b: readonly string[], key: (value: string) => string = (value) => value): boolean {
  const left = new Set(a.map(key));
  const right = new Set(b.map(key));
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function scheduleKey(entry: AccessScheduleDto): string {
  return `${entry.dayOfWeek}|${entry.startHour}|${entry.endHour}`;
}

function sameSchedules(a: readonly AccessScheduleDto[], b: readonly AccessScheduleDto[]): boolean {
  return sameSet(a.map(scheduleKey), b.map(scheduleKey));
}

/** Deux jeux de champs parentaux disent-ils la même chose ? (listes sans ordre, étiquettes sans casse) */
export function sameParental(a: GuestParentalCeiling, b: GuestParentalCeiling): boolean {
  return (
    a.maxParentalRating === b.maxParentalRating &&
    a.maxParentalSubRating === b.maxParentalSubRating &&
    sameSet(a.blockUnratedItems, b.blockUnratedItems) &&
    sameSet(a.blockedTags, b.blockedTags, fold) &&
    sameSet(a.allowedTags, b.allowedTags, fold) &&
    sameSchedules(a.accessSchedules, b.accessSchedules)
  );
}

/** Ce que l'administrateur a mis dans une liste que la famille allonge : la liste lue, moins les ajouts de la famille. */
function adminPart<T extends string>(current: readonly T[], previous: readonly T[], base: readonly T[], key: (value: string) => string): T[] {
  const fromFamily = new Set(previous.filter((value) => !base.some((entry) => key(entry) === key(value))).map(key));
  return current.filter((value) => !fromFamily.has(key(value)));
}

/**
 * La base mise à jour d'après la politique LUE (`current`) : chaque champ qui diffère de
 * la dernière écriture (`previous`) devient la base ; les autres la gardent.
 */
export function rebaseMemberParental(base: GuestParentalCeiling, previous: GuestParentalCeiling, current: GuestParentalCeiling): GuestParentalCeiling {
  const next: GuestParentalCeiling = { ...base };
  if (current.maxParentalRating !== previous.maxParentalRating || current.maxParentalSubRating !== previous.maxParentalSubRating) {
    next.maxParentalRating = current.maxParentalRating;
    next.maxParentalSubRating = current.maxParentalSubRating;
  }
  if (!sameSet(current.blockUnratedItems, previous.blockUnratedItems)) {
    next.blockUnratedItems = adminPart(current.blockUnratedItems, previous.blockUnratedItems, base.blockUnratedItems, (value) => value);
  }
  if (!sameSet(current.blockedTags, previous.blockedTags, fold)) {
    next.blockedTags = adminPart(current.blockedTags, previous.blockedTags, base.blockedTags, fold);
  }
  if (!sameSet(current.allowedTags, previous.allowedTags, fold)) next.allowedTags = [...current.allowedTags];
  if (!sameSchedules(current.accessSchedules, previous.accessSchedules)) next.accessSchedules = [...current.accessSchedules];
  return next;
}

/** Ce que Jellyfin doit porter : la base recoupée avec le contrôle voulu (null : retiré — la base seule). */
export function memberParentalTarget(base: GuestParentalCeiling, wanted: GuestParentalControls | null): GuestParentalCeiling {
  return wanted ? effectiveGuestParental(base, wanted) : { ...base, allowedTags: [...base.allowedTags] };
}

/** La dernière écriture connue ; sans relecture confirmée, ce que Tentacle a voulu écrire. */
export function previousWrite(base: GuestParentalCeiling, wanted: GuestParentalControls | null, written: GuestParentalCeiling | null): GuestParentalCeiling {
  return written ?? memberParentalTarget(base, wanted);
}

/** Pose ces champs parentaux sur la politique d'un compte ; le reste repart à l'octet près. */
export function withParentalFields(userId: string, policy: JellyfinPolicy, fields: GuestParentalCeiling): JellyfinPolicy {
  return {
    ...policy,
    MaxParentalRating: fields.maxParentalRating,
    MaxParentalSubRating: fields.maxParentalSubRating,
    BlockUnratedItems: [...fields.blockUnratedItems],
    BlockedTags: [...fields.blockedTags],
    AllowedTags: [...fields.allowedTags],
    AccessSchedules: schedulesToJellyfin(userId, fields.accessSchedules),
  };
}

/** Les champs parentaux d'une politique, sous la forme du contrat. */
export function parentalOfPolicy(policy: JellyfinPolicy): GuestParentalCeiling {
  return ceilingFromPolicy(policy);
}
