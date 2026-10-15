import type { PickerProfileDto, PickerProfilesDto } from "./familyPickerContract";

/**
 * « Ne plus proposer à la prochaine ouverture » — la case de « Qui regarde ? »
 * sur le BUREAU, jumelle de « Ne plus proposer à l'ouverture » de l'Apple TV
 * (tv-core `session/profileLaunch.ts`) : CET ordinateur ne propose plus, et
 * ouvre UN profil — comme le `stickyProfileId` d'une TV. C'est l'un des trois
 * choix de l'appareil (`familyPickerDevice.ts`). Elle est gardée sur la
 * machine, jamais sur le serveur (aucun secret : un identifiant et un
 * drapeau). Module pur, horloge injectée : `familyPickerStay.test.ts`.
 *
 * Les règles de la TV, reprises :
 * - le profil retenu s'ouvre SEUL à l'ouverture, sans son code (il a été
 *   donné quand on l'a choisi) ; bloqué par trop d'essais ratés, il ne s'ouvre
 *   pas à l'aveugle : « Qui regarde ? », la case encore cochée ;
 * - le choix vaut pour UN profil, jamais pour le suivant : un changement de
 *   profil l'oublie (sur la TV, « Changer de profil » ; ici, le menu de
 *   l'avatar), et un choix sur « Qui regarde ? » le remplace (case cochée)
 *   ou l'efface (décochée) ;
 * - un profil disparu de la famille, ou dont le code a été posé ou retiré,
 *   n'est plus retenu (la TV l'oublie quand le serveur coupe ses sessions).
 *
 * Et la règle du bureau, intacte : la case ne fait jamais ouvrir un AUTRE
 * profil que celui en cours sur l'appareil — le compte ne s'ouvre jamais sans
 * son PIN quand l'ordinateur était sur un autre profil (`pickerLaunch`).
 */

/** Le profil retenu par CET appareil, et s'il avait un code quand on l'a choisi. */
export interface PickerStay {
  profileId: string;
  hasPin: boolean;
}

/**
 * - `valid` : le profil retenu peut s'ouvrir seul ;
 * - `locked` : bloqué par trop d'essais — « Qui regarde ? », le choix gardé ;
 * - `stale` : disparu, ou son code a changé d'état — le choix est à oublier.
 */
export type PickerStayState = "valid" | "locked" | "stale";

export function pickerStayState(
  listing: Pick<PickerProfilesDto, "profiles">,
  stay: PickerStay,
  now: number,
): PickerStayState {
  const profile = listing.profiles.find((candidate) => candidate.userId === stay.profileId);
  if (!profile || profile.hasPin !== stay.hasPin) return "stale";
  // La règle de `isPickerProfileLocked`, recopiée : familyPickerClient importe ce module (pas de cycle).
  const locked = profile.lockedUntil !== null && Date.parse(profile.lockedUntil) > now;
  return locked ? "locked" : "valid";
}

/**
 * La préférence du compte peut-elle céder la place, à l'ouverture, au profil
 * retenu ? Seulement si c'est LE profil en cours sur l'appareil d'après le
 * serveur : la suite (`pickerLaunch`) refuse encore d'ouvrir une session dont
 * l'application n'a pas le jeton.
 */
export function stayOverridesPicker(
  listing: Pick<PickerProfilesDto, "profiles" | "currentProfileId">,
  stay: PickerStay | null,
  now: number,
): boolean {
  if (!stay || stay.profileId !== listing.currentProfileId) return false;
  return pickerStayState(listing, stay, now) === "valid";
}

/**
 * La case à l'arrivée sur « Qui regarde ? » : cochée si l'appareil retient
 * encore un profil de la famille (il n'a pas pu s'ouvrir seul : bloqué, ou
 * pas celui en cours) — comme la TV au lancement. Un choix oublié la rend
 * décochée.
 */
export function pickerStayChecked(listing: Pick<PickerProfilesDto, "profiles">, stay: PickerStay | null, now: number): boolean {
  return stay !== null && pickerStayState(listing, stay, now) !== "stale";
}

/** Ce que l'appareil retient d'un profil choisi, case cochée. */
export function pickerStayOf(profile: Pick<PickerProfileDto, "userId" | "hasPin">): PickerStay {
  return { profileId: profile.userId, hasPin: profile.hasPin };
}
