import type { PickedProfileDto, PickerProfileDto, PickerProfilesDto } from "./familyPickerContract";
import { stayOverridesPicker, type PickerStay } from "./familyPickerStay";
import { sameUserId } from "./familyRules";

/**
 * « Qui regarde ? » sur le BUREAU, côté client — ce que l'écran décide de
 * MONTRER d'après la réponse du serveur. Rien n'y est décidé à la place du
 * serveur : le PIN, les profils permis et la session viennent de lui
 * (docs/FAMILLE.md, « Le bureau »). Pas de miroir : le serveur n'en a pas
 * besoin. Module pur : `familyPickerClient.test.ts`.
 */

/** « Qui regarde ? » au lancement : la préférence du compte pour cette
 *  plateforme, et au moins deux profils — sinon il est sans objet. */
export function showPickerAtLaunch(listing: Pick<PickerProfilesDto, "atLaunch" | "pickerRequired">): boolean {
  return listing.atLaunch && listing.pickerRequired;
}

/** Le profil du compte lui-même (la session personnelle) ; null sur une
 *  réponse inattendue. */
export function personalPickerProfile(listing: Pick<PickerProfilesDto, "profiles">): PickerProfileDto | null {
  return listing.profiles.find((profile) => profile.personal) ?? null;
}

/** Le profil en cours sur cet appareil d'après le serveur. */
export function currentPickerProfile(listing: Pick<PickerProfilesDto, "profiles" | "currentProfileId">): PickerProfileDto | null {
  return listing.profiles.find((profile) => profile.userId === listing.currentProfileId) ?? null;
}

/** Ce profil est-il bloqué (trop d'essais de PIN) à cet instant ? */
export function isPickerProfileLocked(profile: Pick<PickerProfileDto, "lockedUntil">, now: number): boolean {
  return profile.lockedUntil !== null && Date.parse(profile.lockedUntil) > now;
}

/**
 * Au lancement, que montrer :
 * - `picker` : « Qui regarde ? » — la préférence le demande, ou le serveur
 *   dit l'appareil dans une session de profil dont l'application n'a plus le
 *   jeton (revenir au compte sans son PIN serait un contournement) ;
 * - `resume` : la session de profil gardée par l'application, celle que le
 *   serveur dit en cours sur cet appareil ;
 * - `personal` : la session du compte, comme avant.
 *
 * `held` : le profil de la session de profil que l'application a gardée (son
 * jeton), ou null. `stay` : le profil que CET appareil ne propose plus de
 * choisir (« Ne plus proposer sur cet appareil », `familyPickerStay.ts`) — il
 * lève la préférence pour lui seul, puis la règle ci-dessous s'applique
 * entière : jamais une session dont l'application n'a pas le jeton.
 */
export type PickerLaunch = "picker" | "resume" | "personal";

export function pickerLaunch(
  listing: Pick<PickerProfilesDto, "atLaunch" | "pickerRequired" | "currentProfileId" | "account"> & Partial<Pick<PickerProfilesDto, "profiles">>,
  held: { profileId: string } | null,
  stay: PickerStay | null = null,
  now: number = Date.now(),
): PickerLaunch {
  if (showPickerAtLaunch(listing) && !stayOverridesPicker({ profiles: listing.profiles ?? [], currentProfileId: listing.currentProfileId }, stay, now)) {
    return "picker";
  }
  const inProfile = listing.currentProfileId !== listing.account.userId;
  if (!inProfile) return "personal";
  return held?.profileId === listing.currentProfileId ? "resume" : "picker";
}

/** Le jeton d'une session de profil choisie ; null : le compte lui-même. */
export function pickedSessionToken(picked: PickedProfileDto): string | null {
  return picked.personal ? null : picked.token;
}

/**
 * Le cadenas FERMÉ d'une tuile de « Qui regarde ? » : seulement si la choisir
 * demandera VRAIMENT le code. `opensWithoutPin` : les profils que cet écran
 * ouvre sans le pavé — le profil en cours quand on vient de « Changer de
 * profil » (on y est déjà : l'écran se referme), ou le profil retenu d'une TV
 * (le serveur l'en dispense). Un null y est ignoré. AFFICHAGE seul : le serveur
 * reste maître du PIN, et redemande le code à toute ouverture qu'il exige.
 */
export function pickerShowsPinLock(
  profile: { userId: string; hasPin: boolean },
  opensWithoutPin: readonly (string | null | undefined)[],
): boolean {
  if (!profile.hasPin) return false;
  return !opensWithoutPin.some((id) => typeof id === "string" && sameUserId(id, profile.userId));
}
