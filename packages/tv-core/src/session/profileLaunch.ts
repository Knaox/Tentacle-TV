import { sameUserId, type TvProfileDto, type TvProfilesDto } from "@tentacle-tv/shared";
import { pairedAccountOf, profileManages, type ProfileLaunch } from "./tvProfileSession";

/**
 * QUEL PROFIL OUVRIR, une fois « Qui regarde ? » lu (`GET /api/family/tv/profiles`)
 * — module pur, horloge injectée. Le serveur décide de tout (le PIN se
 * vérifie chez lui, « Rester » aussi) ; ces règles disent seulement quel écran
 * montrer pour ne JAMAIS faire voir un refus : un profil bloqué ne s'ouvre pas
 * à l'aveugle, un profil protégé demande son code avant l'appel.
 *
 * - `launch` (démarrage, session terminée par le serveur) : le profil retenu
 *   par « Ne plus proposer à l'ouverture » s'ouvre seul, sans PIN ; sinon
 *   « Qui regarde ? » — TOUJOURS, même pour un profil seul (`pickerRequired`
 *   du serveur n'y change rien : l'Apple TV montre qui regarde).
 * - `switch` (« Changer de profil ») : toujours « Qui regarde ? » — c'est là
 *   que vit « Gérer les profils », et que la case se décoche.
 */

export type ProfileIntent = "launch" | "switch";

export type LaunchPlan =
  | { kind: "open"; profileId: string; remember: true; launch: "sticky" }
  | { kind: "picker" };

/** Un profil bloqué par trop d'essais ratés (toutes TV confondues), à `now`. */
export function isProfileLocked(profile: Pick<TvProfileDto, "lockedUntil">, now: number): boolean {
  if (!profile.lockedUntil) return false;
  const until = Date.parse(profile.lockedUntil);
  return Number.isFinite(until) && until > now;
}

export function findProfile(listing: Pick<TvProfilesDto, "profiles">, profileId: string | null | undefined): TvProfileDto | null {
  if (!profileId) return null;
  return listing.profiles.find((profile) => sameUserId(profile.userId, profileId)) ?? null;
}

export function planProfileLaunch(listing: TvProfilesDto, intent: ProfileIntent, now: number): LaunchPlan {
  if (intent === "switch") return { kind: "picker" };
  const sticky = findProfile(listing, listing.stickyProfileId);
  if (sticky && !isProfileLocked(sticky, now)) {
    return { kind: "open", profileId: sticky.userId, remember: true, launch: "sticky" };
  }
  return { kind: "picker" };
}

/**
 * La case « Ne plus proposer à l'ouverture » à l'arrivée sur « Qui regarde ? » :
 * cochée si la TV a encore un profil retenu, ou si l'on vient de QUITTER un
 * profil retenu (« Changer de profil » : le serveur l'a oublié en fermant la
 * session — la case le rappelle, et le profil choisi ensuite le devient à son
 * tour). Une session coupée par le serveur (retrait, départ, PIN changé) ne
 * la coche pas : c'est lui qui a révoqué le choix.
 */
export function pickerRemembers(listing: Pick<TvProfilesDto, "stickyProfileId">, leftRemembered: boolean): boolean {
  return leftRemembered || !!listing.stickyProfileId;
}

export type PickPlan =
  | { kind: "open"; remember: boolean; launch: ProfileLaunch }
  | { kind: "pin"; remember: boolean; launch: ProfileLaunch }
  | { kind: "locked"; until: string };

/**
 * OK sur un profil de « Qui regarde ? ». `remember` : « Ne plus proposer à
 * l'ouverture » coché. Le profil retenu de cette TV s'ouvre sans PIN (le
 * serveur l'en dispense) ; tout autre profil protégé demande son code d'abord.
 */
export function planProfilePick(
  profile: TvProfileDto,
  listing: Pick<TvProfilesDto, "stickyProfileId">,
  remember: boolean,
  now: number,
): PickPlan {
  if (isProfileLocked(profile, now)) return { kind: "locked", until: profile.lockedUntil as string };
  const launch: ProfileLaunch = remember ? "sticky" : "picked";
  const sticky = !!listing.stickyProfileId && sameUserId(listing.stickyProfileId, profile.userId);
  if (profile.hasPin && !sticky) return { kind: "pin", remember, launch };
  return { kind: "open", remember, launch };
}

/** Le profil où « Qui regarde ? » pose le focus : celui qu'on vient de quitter s'il est encore là, sinon le premier. */
export function pickerEntryIndex(listing: Pick<TvProfilesDto, "profiles">, previousId: string | null): number {
  if (!previousId) return 0;
  return Math.max(0, listing.profiles.findIndex((profile) => sameUserId(profile.userId, previousId)));
}

/**
 * « Gérer les profils » depuis « Qui regarde ? » : QUI gère (derrière SON
 * PIN, avec SES droits — v2) — le profil du compte qui a jumelé la TV s'il a
 * quelque chose à gérer, sinon le premier profil qui gère (le propriétaire de
 * la famille). Rien à gérer sur cette TV : null, l'entrée n'existe pas.
 */
export function manageEntryProfile(listing: TvProfilesDto): TvProfileDto | null {
  if (!listing.canManage) return null;
  const managers = listing.profiles.filter((profile) => profileManages(profile, listing));
  const paired = pairedAccountOf(listing);
  return managers.find((profile) => sameUserId(profile.userId, paired.userId)) ?? managers[0] ?? null;
}

/**
 * L'ORDRE de « Qui regarde ? » : le profil du compte qui a JUMELÉ la TV en
 * tête — c'est lui qui la regarde d'ordinaire, et le focus s'y pose d'emblée
 * (`pickerEntryIndex`), dès le tout premier échange —, puis les autres dans
 * l'ordre du serveur (propriétaire, membres, invités). Sur la TV du
 * propriétaire, rien ne bouge : il est déjà premier.
 */
export function pickerOrder<T extends Pick<TvProfilesDto, "profiles" | "owner"> & Partial<Pick<TvProfilesDto, "pairedBy">>>(listing: T): T {
  const paired = pairedAccountOf(listing);
  const index = listing.profiles.findIndex((profile) => sameUserId(profile.userId, paired.userId));
  if (index <= 0) return listing;
  const profiles = [listing.profiles[index], ...listing.profiles.slice(0, index), ...listing.profiles.slice(index + 1)];
  return { ...listing, profiles };
}
