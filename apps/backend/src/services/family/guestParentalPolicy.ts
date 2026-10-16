import {
  GUEST_PARENTAL_NONE,
  effectiveGuestParental,
  type GuestParentalCeiling,
  type GuestParentalControls,
} from "../../family/familyParental";
import { UNRATED_ITEM_TYPES } from "../../userRights/userRightsContract";
import { parseUserRightsPatch } from "../../userRights/userRightsPatch";
import { rightsFromPolicy, schedulesToJellyfin, type JellyfinPolicy } from "../userRights/policyMapping";

/**
 * Le contrôle parental d'un invité dans la forme de Jellyfin — règles pures
 * (docs/DROITS-UTILISATEURS.md § 4). Le contrôle VOULU est gardé en base
 * (`family_members.parentalControls`) ; la politique EFFECTIVE de l'invité, écrite
 * dans Jellyfin, est l'intersection avec les restrictions de son créateur.
 */

const PARENTAL_KEYS = ["maxParentalRating", "maxParentalSubRating", "blockUnratedItems", "blockedTags", "accessSchedules"] as const;

/** Un contrôle illisible en base : le plus fermé, jamais « aucun ». */
export const GUEST_PARENTAL_CLOSED: Readonly<GuestParentalControls> = {
  maxParentalRating: 0,
  maxParentalSubRating: null,
  blockUnratedItems: [...UNRATED_ITEM_TYPES],
  blockedTags: [],
  accessSchedules: [],
};

/** Le corps de `setGuestParental` : les cinq champs, ni plus ni moins, validés ; null sinon. */
export function parseGuestParental(body: unknown): GuestParentalControls | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const keys = Object.keys(body).sort();
  if (keys.join(",") !== [...PARENTAL_KEYS].sort().join(",")) return null;
  const parsed = parseUserRightsPatch(body);
  if (!parsed.ok) return null;
  const patch = parsed.patch;
  const rating = patch.maxParentalRating ?? null;
  return {
    maxParentalRating: rating,
    // Une sous-note sans note ne veut rien dire : elle tombe.
    maxParentalSubRating: rating === null ? null : (patch.maxParentalSubRating ?? null),
    blockUnratedItems: patch.blockUnratedItems ?? [],
    blockedTags: patch.blockedTags ?? [],
    accessSchedules: patch.accessSchedules ?? [],
  };
}

/** Le contrôle voulu, relu en base : absent = aucun ; illisible = le plus fermé. */
export function storedGuestParental(raw: string | null | undefined): GuestParentalControls {
  if (raw === null || raw === undefined || raw === "") return { ...GUEST_PARENTAL_NONE };
  try {
    return parseGuestParental(JSON.parse(raw)) ?? { ...GUEST_PARENTAL_CLOSED };
  } catch {
    return { ...GUEST_PARENTAL_CLOSED };
  }
}

/** Le plafond : les restrictions du créateur, lues dans sa politique. */
export function ceilingFromPolicy(policy: JellyfinPolicy): GuestParentalCeiling {
  const rights = rightsFromPolicy(policy);
  return {
    maxParentalRating: rights.maxParentalRating,
    maxParentalSubRating: rights.maxParentalSubRating,
    blockUnratedItems: rights.blockUnratedItems,
    blockedTags: rights.blockedTags,
    allowedTags: rights.allowedTags,
    accessSchedules: rights.accessSchedules,
  };
}

/** Pose sur la politique de l'invité le contrôle EFFECTIVE (créateur ∩ voulu). */
export function withGuestParental(guestUserId: string, policy: JellyfinPolicy, creator: JellyfinPolicy, wanted: GuestParentalControls): JellyfinPolicy {
  const effective = effectiveGuestParental(ceilingFromPolicy(creator), wanted);
  return {
    ...policy,
    MaxParentalRating: effective.maxParentalRating,
    MaxParentalSubRating: effective.maxParentalSubRating,
    BlockUnratedItems: effective.blockUnratedItems,
    BlockedTags: effective.blockedTags,
    AllowedTags: effective.allowedTags,
    AccessSchedules: schedulesToJellyfin(guestUserId, effective.accessSchedules),
  };
}

/** Deux politiques disent-elles la même chose ? Les plages se comparent sans `Id`/`UserId`, les
 *  bibliothèques sans ordre ni forme d'identifiant (Jellyfin peut les rendre autrement). */
export function samePolicy(a: JellyfinPolicy, b: JellyfinPolicy): boolean {
  const plain = (policy: JellyfinPolicy): JellyfinPolicy => ({
    ...policy,
    AccessSchedules: rightsFromPolicy(policy).accessSchedules,
    ...(Array.isArray(policy.EnabledFolders) ? { EnabledFolders: [...rightsFromPolicy(policy).enabledFolders].sort() } : {}),
  });
  const left = plain(a);
  const right = plain(b);
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => JSON.stringify(left[key] ?? null) === JSON.stringify(right[key] ?? null));
}

/** Le contrôle effectif s'est-il posé tel que voulu ? (relecture) */
export function parentalApplied(written: JellyfinPolicy, reread: JellyfinPolicy): boolean {
  const keys = ["MaxParentalRating", "MaxParentalSubRating", "BlockUnratedItems", "BlockedTags", "AllowedTags", "AccessSchedules"];
  return samePolicy(
    Object.fromEntries(keys.map((key) => [key, written[key]])),
    Object.fromEntries(keys.map((key) => [key, reread[key]])),
  );
}
