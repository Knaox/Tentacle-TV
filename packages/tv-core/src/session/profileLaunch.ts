import { sameUserId, type TvProfileDto, type TvProfilesDto } from "@tentacle-tv/shared";
import type { ProfileLaunch } from "./tvProfileSession";

/**
 * QUEL PROFIL OUVRIR, une fois « Qui regarde ? » lu (`GET /api/family/tv/profiles`)
 * — module pur, horloge injectée. Le serveur décide de tout (le PIN se
 * vérifie chez lui, « Rester » aussi) ; ces règles disent seulement quel écran
 * montrer pour ne JAMAIS faire voir un refus : un profil bloqué ne s'ouvre pas
 * à l'aveugle, un profil protégé demande son code avant l'appel.
 *
 * - `launch` (démarrage, session terminée par le serveur) : le profil « Rester »
 *   s'ouvre seul, sans PIN ; le SEUL profil de la TV aussi — après son PIN
 *   s'il en a un ; sinon « Qui regarde ? ».
 * - `switch` (« Changer de profil ») : toujours « Qui regarde ? », même pour un
 *   profil seul — c'est là que vit « Gérer les profils ».
 */

export type ProfileIntent = "launch" | "switch";

export type LaunchPlan =
  | { kind: "open"; profileId: string; remember: boolean; launch: Exclude<ProfileLaunch, "picked"> }
  | { kind: "pin"; profileId: string; launch: "single" }
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
  if (!listing.pickerRequired && listing.profiles.length === 1) {
    const only = listing.profiles[0];
    if (isProfileLocked(only, now)) return { kind: "picker" };
    if (only.hasPin) return { kind: "pin", profileId: only.userId, launch: "single" };
    return { kind: "open", profileId: only.userId, remember: false, launch: "single" };
  }
  return { kind: "picker" };
}

export type PickPlan =
  | { kind: "open"; remember: boolean; launch: ProfileLaunch }
  | { kind: "pin"; remember: boolean; launch: ProfileLaunch }
  | { kind: "locked"; until: string };

/**
 * OK sur un profil de « Qui regarde ? ». `remember` : « Rester sur ce profil »
 * coché. Le profil « Rester » de cette TV s'ouvre sans PIN (le serveur l'en
 * dispense) ; tout autre profil protégé demande son code d'abord.
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
