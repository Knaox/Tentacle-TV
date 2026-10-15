/**
 * La Famille — les RÔLES et les DROITS DE CRÉATION (serveur 1.30.0). Partie du
 * contrat : `familyContract.ts` le ré-exporte. Carnet : docs/FAMILLE.md et
 * docs/DROITS-UTILISATEURS.md § 9.4.
 *
 * - Les DROITS DE CRÉATION d'un compte (capacité `family.creationRights`) :
 *   fonder une famille (première invitation, ou premier invité, comprise) et
 *   créer des profils invités. Gardés par Tentacle — ce ne sont pas des champs
 *   de la politique Jellyfin. `inherit` suit le DÉFAUT de l'administration
 *   (NON pour les deux, sur une installation neuve comme sur une mise à jour).
 *   Les interrupteurs « Familles » et « Profils invités » restent MAÎTRES ; un
 *   administrateur Jellyfin peut toujours. Rien de ce qui existe ne tombe : le
 *   droit ne garde que les NOUVELLES créations.
 * - Le rôle de PARENT (`family.roles`) : le propriétaire le donne à un membre,
 *   et le lui retire. Un parent gère les ENFANTS : contrôle parental des
 *   membres mineurs et de tous les invités, réglages des invités (droits,
 *   photo, PIN, suppression) comme le propriétaire, création d'invités s'il en
 *   a le droit de compte. Restent au propriétaire SEUL : inviter et retirer
 *   des membres, nommer ou retirer un parent, dissoudre.
 * - Le contrôle parental d'un MEMBRE MINEUR (`family.memberParental`) : posé
 *   par le propriétaire ou un parent sur un membre qui n'est ni le
 *   propriétaire, ni un parent, ni un administrateur Jellyfin. Il s'écrit dans
 *   SA politique Jellyfin comme l'INTERSECTION de sa politique « de base »
 *   (celle que règle l'administrateur) et du contrôle voulu
 *   (`effectiveGuestParental`) ; retiré, le membre parti ou la famille
 *   dissoute, la base est rendue à l'identique.
 *
 * MIROIR : `apps/backend/src/family/familyRoles.ts`, octet pour octet
 * (commande de recopie : l'en-tête de `familyContract.ts`).
 */

import type { FamilySwitches } from "./familyContract";
import type { GuestParentalCeiling, GuestParentalControls } from "./familyParental";

// ── Droits de création ──────────────────────────────────────────────────────

/** `inherit` : le défaut de l'administration ; `allow` / `deny` : réglé pour CE compte. */
export const FAMILY_CREATION_RIGHT_VALUES = ["inherit", "allow", "deny"] as const;
export type FamilyCreationRightValue = (typeof FAMILY_CREATION_RIGHT_VALUES)[number];

/** Le réglage d'un compte, par l'administration (`inherit` partout tant qu'il n'y a pas touché). */
export interface FamilyCreationRights {
  createFamily: FamilyCreationRightValue;
  createGuests: FamilyCreationRightValue;
}

export const FAMILY_DEFAULT_CREATION_RIGHTS: Readonly<FamilyCreationRights> = { createFamily: "inherit", createGuests: "inherit" };

/** Le défaut de l'administration, pour un compte `inherit` — Admin › Comptes, à côté des interrupteurs. */
export interface FamilyCreationDefaults {
  createFamily: boolean;
  createGuests: boolean;
}

/** NON pour les deux : un compte ne crée rien tant que l'administration ne l'a pas permis. */
export const FAMILY_CREATION_DEFAULTS: Readonly<FamilyCreationDefaults> = { createFamily: false, createGuests: false };

/** Ce qu'un compte peut créer MAINTENANT, tout compris. */
export interface FamilyCreationAllowed {
  /** Fonder une famille (il n'en a pas encore) : inviter, ou créer un premier invité. */
  createFamily: boolean;
  /** Créer un profil invité. Un membre doit EN PLUS avoir la permission du propriétaire (ou être parent). */
  createGuests: boolean;
}

function pick(value: FamilyCreationRightValue, fallback: boolean): boolean {
  return value === "allow" ? true : value === "deny" ? false : fallback;
}

/**
 * La règle : les interrupteurs d'abord (coupés = personne), puis l'administrateur
 * Jellyfin (toujours), puis le réglage du compte, puis le défaut. Un réglage
 * inconnu (serveur plus récent, base abîmée) vaut le défaut.
 */
export function resolveFamilyCreation(input: {
  rights: FamilyCreationRights;
  defaults: FamilyCreationDefaults;
  switches: FamilySwitches;
  isAdministrator: boolean;
}): FamilyCreationAllowed {
  const { rights, defaults, switches, isAdministrator } = input;
  return {
    createFamily: switches.families && (isAdministrator || pick(rights.createFamily, defaults.createFamily)),
    createGuests: switches.families && switches.guests && (isAdministrator || pick(rights.createGuests, defaults.createGuests)),
  };
}

/** Un réglage lu d'ailleurs (base, corps) : une valeur connue, sinon `inherit`. */
export function creationRightValue(value: unknown): FamilyCreationRightValue {
  return (FAMILY_CREATION_RIGHT_VALUES as readonly unknown[]).includes(value) ? (value as FamilyCreationRightValue) : "inherit";
}

/**
 * La fiche « Famille » d'un compte dans l'administration (`adminAccountRights`) :
 * ses droits de création, ce qui en vaut, et sa place dans une famille.
 */
export interface AccountFamilyRightsDto {
  userId: string;
  /** Le réglage du compte. */
  rights: FamilyCreationRights;
  /** Le défaut de l'administration, pour `inherit`. */
  defaults: FamilyCreationDefaults;
  /** Ce qui vaut, interrupteurs et administration compris. */
  allowed: FamilyCreationAllowed;
  /** Administrateur Jellyfin : il peut toujours, quel que soit son réglage ; null : Jellyfin muet. */
  isAdministrator: boolean | null;
  /** Sa place dans une famille ; null : aucune. Un invité ne crée jamais rien. */
  family: { role: "owner" | "member" | "guest"; ownerName: string; parent: boolean } | null;
  /** Membre mineur : un contrôle parental de la famille de `ownerName` s'ajoute à sa politique
   *  (« Restreint par la famille de … ») ; null sinon. */
  restrictedBy: { ownerName: string } | null;
}

/** Seuls les champs présents changent. */
export type SetAccountFamilyRightsBody = Partial<FamilyCreationRights>;
export type SetFamilyCreationDefaultsBody = Partial<FamilyCreationDefaults>;

// ── Rôle de parent ──────────────────────────────────────────────────────────

/** `setMemberRole` : le propriétaire nomme un membre parent (`true`) ou le lui retire (`false`). */
export interface SetMemberRoleBody {
  parent: boolean;
}

export interface MemberRoleDto {
  parent: boolean;
}

// ── Membre mineur ───────────────────────────────────────────────────────────

/** `setMemberParental` : le contrôle ENTIER ; aucun réglage (`GUEST_PARENTAL_NONE`) = RETIRÉ, la base
 *  rendue. La réponse est `GuestParentalDto` : `parentalCeiling` y est la politique de BASE du membre. */
export type SetMemberParentalBody = GuestParentalControls;

/** Un contrôle qui ne restreint rien : vaut un retrait. */
export function isParentalNone(controls: GuestParentalControls): boolean {
  return (
    controls.maxParentalRating === null &&
    controls.blockUnratedItems.length === 0 &&
    controls.blockedTags.length === 0 &&
    controls.accessSchedules.length === 0
  );
}

/**
 * Un membre peut-il recevoir un contrôle parental ? Ni le propriétaire, ni un parent, ni un
 * administrateur Jellyfin (null : on ne sait pas — non).
 */
export function isRestrictableMember(profile: { kind: string; parent?: boolean }, isAdministrator: boolean | null): boolean {
  return profile.kind === "member" && profile.parent !== true && isAdministrator === false;
}

/** La base d'un membre mineur, rendue à l'identique : rien n'y est ajouté par la famille. */
export type MemberParentalBase = GuestParentalCeiling;
