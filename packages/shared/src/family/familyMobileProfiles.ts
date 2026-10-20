import type { IncomingInvitationDto, FamilyCapability } from "./familyContract";
import type { PickerProfilesDto } from "./familyPickerContract";
import { pickerLaunch, type PickerLaunch } from "./familyPickerClient";
import { pickerStayState, type PickerStay } from "./familyPickerStay";
import { isFamilyAvailable } from "./familyClient";

/**
 * « Qui regarde ? » sur le MOBILE (téléphone, tablette ; serveur 1.31.1,
 * capacité `family.mobileProfiles`) — ce que l'app MONTRE d'après la réponse du
 * serveur. Le serveur décide de tout le reste (profils permis, PIN, session) :
 * les mêmes routes que le bureau, plateforme `mobile`. Module pur :
 * `familyMobileProfiles.test.ts`.
 *
 * Décision de Damien (20/10) : le choix est MÉMORISÉ sur l'appareil et n'est
 * plus redemandé — sauf s'il ne vaut plus (profil disparu, code posé ou
 * retiré : `pickerStayState` → `stale` ; bloqué : `locked`). On change de
 * profil depuis Réglages › Compte. Le mobile ne lit pas la politique
 * d'ouverture du bureau (`launchPolicy`) : elle règle les ordinateurs.
 */

/** Le choix de l'appareil, par serveur et par compte (`{ "<serveur>|<compte>": PickerStay }`).
 *  ⚠️ Clé traversée par une chaîne : jamais renommée. */
export const MOBILE_PROFILE_STAY_KEY = "tentacle_mobile_profile_stay";

/** Ce que « Qui regarde ? » exige pour exister sur ce mobile. */
export interface MobileProfilesGate {
  /** Le serveur déclare `family.mobileProfiles`. */
  capable: boolean;
  /** `features.family` du serveur (absent d'un serveur d'avant). */
  family: FamilyCapability | undefined;
  offline: boolean;
  /** Une session PERSONNELLE existe sur l'appareil (le compte, ou sa réserve pendant un profil). */
  hasAccountSession: boolean;
}

/** L'app peut-elle demander la famille de « Qui regarde ? » ? */
export function mobileProfilesEnabled(gate: MobileProfilesGate): boolean {
  return gate.capable && gate.hasAccountSession && isFamilyAvailable(gate.family, gate.offline);
}

/** « Changer de profil » (Réglages › Compte) : seulement quand il y a à choisir. */
export function canSwitchMobileProfile(gate: MobileProfilesGate, listing: Pick<PickerProfilesDto, "pickerRequired"> | null | undefined): boolean {
  return mobileProfilesEnabled(gate) && listing?.pickerRequired === true;
}

function stayKey(serverUrl: string, accountId: string): string {
  return `${serverUrl.replace(/\/+$/, "").toLowerCase()}|${accountId.replace(/-/g, "").toLowerCase()}`;
}

function isStay(value: unknown): value is PickerStay {
  return !!value && typeof value === "object" && typeof (value as PickerStay).profileId === "string"
    && !!(value as PickerStay).profileId && typeof (value as PickerStay).hasPin === "boolean";
}

function readAll(raw: string | null): Record<string, PickerStay> {
  try {
    const parsed: unknown = JSON.parse(raw ?? "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter((entry): entry is [string, PickerStay] => isStay(entry[1])));
  } catch {
    return {};
  }
}

/** Le profil retenu par cet appareil pour ce compte sur ce serveur, ou null. */
export function readMobileStay(raw: string | null, serverUrl: string, accountId: string): PickerStay | null {
  return readAll(raw)[stayKey(serverUrl, accountId)] ?? null;
}

/** La valeur à écrire : `stay` retenu, ou oublié (null). Les autres comptes et serveurs restent. */
export function writeMobileStay(raw: string | null, serverUrl: string, accountId: string, stay: PickerStay | null): string {
  const all = readAll(raw);
  const key = stayKey(serverUrl, accountId);
  if (stay) all[key] = { profileId: stay.profileId, hasPin: stay.hasPin };
  else delete all[key];
  return JSON.stringify(all);
}

/**
 * À l'ouverture : `picker` (« Qui regarde ? » plein écran), `resume` (la
 * session de profil que l'app garde, celle que le serveur dit en cours) ou
 * `personal` (le compte). La règle du bureau (`pickerLaunch`), « au
 * lancement » toujours demandé : seul un choix retenu qui vaut ENCORE, et qui
 * est le profil en cours sur l'appareil d'après le serveur, l'en dispense —
 * jamais le compte ouvert sans son code parce que la session d'un enfant a
 * pris fin. `held` : le profil dont l'app garde le jeton, ou null.
 */
export function mobileProfileLaunch(
  listing: Pick<PickerProfilesDto, "pickerRequired" | "currentProfileId" | "account" | "profiles">,
  held: { profileId: string } | null,
  stay: PickerStay | null,
  now: number,
): PickerLaunch {
  const usable = stay !== null && pickerStayState(listing, stay, now) !== "stale" ? stay : null;
  return pickerLaunch({ ...listing, atLaunch: true }, held, usable, now);
}

/** Le choix retenu ne vaut plus (profil disparu, code posé ou retiré) : à oublier. */
export function mobileStayIsStale(listing: Pick<PickerProfilesDto, "profiles">, stay: PickerStay | null, now: number): boolean {
  return stay !== null && pickerStayState(listing, stay, now) === "stale";
}

/** Le badge de Réglages › Compte : les invitations reçues encore valables — « Plus tard » compris
 *  (l'affiche se tait, l'invitation attend toujours une réponse). */
export function pendingInvitationCount(incoming: readonly IncomingInvitationDto[] | null | undefined, now: number): number {
  return (incoming ?? []).filter((invitation) => Date.parse(invitation.expiresAt) > now).length;
}
