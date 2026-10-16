import { sameUserId, type TvProfileDto, type TvProfilesDto } from "@tentacle-tv/shared";
import { recordRoleOf, tvProfileRoleOf, type TvProfileRole } from "./profileRoleName";
import { profileManages, recordManages, type TvProfileRecord } from "./tvProfileSession";

export { recordRoleOf, tvProfileRoleOf, type TvProfileRole } from "./profileRoleName";

/**
 * Le RÔLE du profil ouvert et ce qu'il GÈRE, tels que Réglages › Compte les
 * disent (Apple TV, Android TV) — module pur. La source est la liste de « Qui
 * regarde ? » RELUE (le rôle a pu changer sur le bureau pendant que le profil
 * était ouvert : le constat du 16/10, « Parent » affiché « Membre ») ; ce que la
 * TV a retenu à l'ouverture (`TvProfileRecord`) ne sert qu'en attendant.
 *
 * Décisions du 16/10 : sans code PIN, aucune gestion depuis un profil — la TV
 * le dit (« Posez un code… ») au lieu de proposer « Gérer les profils » ; le
 * code n'ouvre que la porte, les droits restent ceux du rôle.
 */

/** Ce que Réglages propose : la gestion, l'indice « posez un code », ou rien. */
export type ProfileManageState = "manage" | "needsPin" | "none";

/**
 * La règle commune : un profil qui GÉRERAIT (ses droits, ou le serveur qui dit
 * « il gérerait avec un code ») gère s'il a un code, sinon on l'invite à en
 * poser un. Un invité, le compte de démonstration : rien.
 */
function manageStateOf(kind: TvProfileDto["kind"], would: boolean, hasPin: boolean): ProfileManageState {
  if (kind === "guest" || !would) return "none";
  return hasPin ? "manage" : "needsPin";
}

/** D'après la liste relue. `hasPin` : la TV en sait plus tôt que la liste (code posé à l'instant). */
export function profileManageState(
  profile: TvProfileDto,
  listing: Pick<TvProfilesDto, "canManage">,
  hasPin: boolean = profile.hasPin,
): ProfileManageState {
  return manageStateOf(profile.kind, profileManages(profile, listing) || profile.manageNeedsPin === true, hasPin);
}

/** D'après ce que la TV a retenu à l'ouverture. */
export function recordManageState(record: TvProfileRecord): ProfileManageState {
  return manageStateOf(record.kind, recordManages(record) || record.manageNeedsPin === true, record.hasPin);
}

/** Ce que Réglages › Compte montre du profil ouvert. */
export interface OpenProfileState {
  /** Null : aucun rôle à dire — un compte sans famille, dont le compte de démonstration de la revue
   *  (ni famille ni rôle) ; jamais « Propriétaire de la famille » pour lui. */
  role: TvProfileRole | null;
  manage: ProfileManageState;
  hasPin: boolean;
}

/**
 * Le profil ouvert : la liste relue s'il y figure, sinon ce que la TV a
 * retenu. Le code, TOUJOURS d'après la TV : elle retient celui posé ou retiré
 * depuis ce profil avant que la liste ne soit relue, et un code changé
 * ailleurs ferme la session (le serveur coupe le profil sur les TV).
 */
export function openProfileState(record: TvProfileRecord, listing: TvProfilesDto | null): OpenProfileState {
  const live = listing?.profiles.find((profile) => sameUserId(profile.userId, record.profileId)) ?? null;
  const hasPin = record.hasPin;
  if (!live || !listing) {
    // Sans la liste : un « propriétaire » qui ne gère rien (le compte de revue) ne se dit pas propriétaire.
    const role = recordRoleOf(record);
    return { role: role === "owner" && !recordManages(record) ? null : role, manage: recordManageState(record), hasPin };
  }
  // Un propriétaire SEUL dans la liste n'a pas de famille (elle naît à son premier invité ou à sa
  // première invitation) : aucun rôle à dire — le compte de revue, qui n'en crée jamais, en premier.
  const alone = listing.profiles.every((profile) => sameUserId(profile.userId, record.profileId));
  const role = tvProfileRoleOf(live);
  return { role: role === "owner" && alone ? null : role, manage: profileManageState(live, listing, hasPin), hasPin };
}

/**
 * Ce que dit « Oublier ce jumelage » dans Réglages › Compte : `family` — la
 * TV oublie sa famille, les invités restent ; `plain` — un jumelage sans
 * famille (aucun rôle à dire : un compte seul, le compte de démonstration de
 * la revue), le texte d'avant les profils ; `ownerOnly` — seul le compte qui a
 * jumelé la TV la déjumelle.
 */
export type UnpairCaption = "family" | "plain" | "ownerOnly";

export function unpairCaptionOf(state: Pick<OpenProfileState, "role">, pairedTheTv: boolean): UnpairCaption {
  if (!pairedTheTv) return "ownerOnly";
  return state.role === null ? "plain" : "family";
}

