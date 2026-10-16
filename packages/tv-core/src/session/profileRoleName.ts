import type { FamilyProfileKind, FamilyRights, TvProfileDto } from "@tentacle-tv/shared";

/**
 * Le NOM du rôle d'un profil sur une TV (Réglages › Compte, « Gérer les
 * profils ») — module pur, sans dépendance de session : la session de profil
 * le retient à l'ouverture (`profileRecordOf`), Réglages le relit
 * (`openProfileState`).
 */

/** Le rôle tel qu'une TV le nomme : un membre nommé PARENT (1.30.0) se dit à part. */
export type TvProfileRole = "owner" | "parent" | "member" | "guest";

/** Un parent : il gère les mineurs, jamais les membres (`familyRightsOf`). */
function rightsOfParent(manage: FamilyRights | null | undefined): boolean {
  return !!manage && manage.manageMinors === true && !manage.manageMembers;
}

/**
 * Le rôle d'un profil de la liste : `parent` (serveur 1.30.0) ; sans lui,
 * déduit de ses droits — qu'un profil sans code ne porte plus (`manage`
 * nul) : il se dit alors « Membre ».
 */
export function tvProfileRoleOf(profile: Pick<TvProfileDto, "kind" | "manage" | "parent">): TvProfileRole {
  if (profile.kind !== "member") return profile.kind;
  return profile.parent === true || rightsOfParent(profile.manage) ? "parent" : "member";
}

/** Le rôle retenu à l'ouverture (`parent`, absent d'un enregistrement d'avant : membre). */
export function recordRoleOf(record: { kind: FamilyProfileKind; parent?: boolean }): TvProfileRole {
  if (record.kind !== "member") return record.kind;
  return record.parent === true ? "parent" : "member";
}
