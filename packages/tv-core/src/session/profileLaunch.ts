import { sameUserId, type TvProfileDto, type TvProfilesDto } from "@tentacle-tv/shared";
import { pairedAccountOf, profileManages, type ProfileLaunch } from "./tvProfileSession";

/**
 * QUEL PROFIL OUVRIR, une fois « Qui regarde ? » lu (`GET /api/family/tv/profiles`)
 * — module pur, horloge injectée. Le serveur décide de tout (le PIN se
 * vérifie chez lui, « Rester » aussi) ; ces règles disent seulement quel écran
 * montrer pour ne JAMAIS faire voir un refus : un profil bloqué ne s'ouvre pas
 * à l'aveugle, un profil protégé demande son code avant l'appel.
 *
 * - `launch` (démarrage) : le profil retenu par « Ne plus proposer à
 *   l'ouverture » s'ouvre seul, sans PIN ; sinon le compte de la TV s'il est
 *   dans AUCUNE famille et sans PIN (`soloProfile`) — il n'y a personne
 *   d'autre à choisir ; sinon « Qui regarde ? », même pour un profil seul
 *   protégé par un code.
 * - `switch` (« Changer de profil ») : toujours « Qui regarde ? » — c'est là
 *   que vit « Gérer les profils » ; la case y arrive décochée.
 */

export type ProfileIntent = "launch" | "switch";

export type LaunchPlan =
  | { kind: "open"; profileId: string; remember: true; launch: "sticky" }
  | { kind: "open"; profileId: string; remember: false; launch: "solo" }
  | { kind: "picker" };

type ListingForSolo = Pick<TvProfilesDto, "profiles" | "owner"> & Partial<Pick<TvProfilesDto, "pairedBy">>;

/**
 * Le compte de la TV quand il n'est dans AUCUNE famille (le serveur ne rend
 * alors que lui — ou une famille réduite à lui, les invités coupés) et sans
 * PIN : il n'y a personne à choisir ni de code à demander, la TV entre
 * directement. Sinon null.
 */
export function soloProfile(listing: ListingForSolo): TvProfileDto | null {
  if (listing.profiles.length !== 1) return null;
  const only = listing.profiles[0];
  if (only.hasPin || !sameUserId(only.userId, pairedAccountOf(listing).userId)) return null;
  return only;
}

/**
 * Une session `solo` reprise au démarrage l'est-elle toujours ? La famille a
 * pu naître pendant que l'app dormait (un invité créé, une invitation
 * acceptée), ou un PIN se poser : la TV repasse alors par « Qui regarde ? ».
 */
export function soloStillHolds(listing: ListingForSolo, profileId: string): boolean {
  const solo = soloProfile(listing);
  return !!solo && sameUserId(solo.userId, profileId);
}

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
  const solo = soloProfile(listing);
  if (solo) return { kind: "open", profileId: solo.userId, remember: false, launch: "solo" };
  return { kind: "picker" };
}

/**
 * La case « Ne plus proposer à l'ouverture » à l'arrivée sur « Qui regarde ? » :
 * cochée seulement au LANCEMENT, si la TV a encore un profil retenu (bloqué,
 * il n'a pas pu s'ouvrir seul). « Changer de profil » la rend DÉCOCHÉE : le
 * choix vaut pour un profil, jamais pour le suivant — qui veut que le profil
 * choisi ensuite s'ouvre seul la recoche (le serveur a oublié l'ancien en
 * fermant sa session).
 */
export function pickerRemembers(listing: Pick<TvProfilesDto, "stickyProfileId">, intent: ProfileIntent): boolean {
  return intent === "launch" && !!listing.stickyProfileId;
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
  listing: Pick<TvProfilesDto, "stickyProfileId"> & ListingForSolo,
  remember: boolean,
  now: number,
): PickPlan {
  if (isProfileLocked(profile, now)) return { kind: "locked", until: profile.lockedUntil as string };
  // Le compte seul choisi depuis « Changer de profil » : il se reprendra au lancement, comme s'il s'était ouvert d'office.
  const solo = soloProfile(listing);
  const launch: ProfileLaunch = remember ? "sticky" : solo && sameUserId(solo.userId, profile.userId) ? "solo" : "picked";
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
