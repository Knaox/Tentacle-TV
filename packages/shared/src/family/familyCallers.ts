import type { FamilyRights } from "./familyContract";

/**
 * La Famille — les APPELANTS des routes (`FAMILY_ROUTES.callers`), et la règle
 * qui dit quand une SESSION DE PROFIL gère la famille (serveur 1.30.0,
 * capacité `family.profileManage`). Carnet : docs/FAMILLE.md, « Gérer depuis
 * un profil ».
 *
 * MIROIR : `apps/backend/src/family/familyCallers.ts`, octet pour octet (voir
 * l'en-tête de `familyContract.ts`).
 *
 * # Les appelants
 *
 * - `personal` : une session PERSONNELLE — le jeton Jellyfin du web, du
 *   bureau, du mobile (cookie ou `Bearer`). Jamais un jeton d'appareil jumelé,
 *   jamais une session « voir en tant que ».
 * - `ownerProfile` : la session de profil du PROPRIÉTAIRE de la famille, sur
 *   une TV ou un bureau de la famille, « Gérer les profils » ouvert par SON
 *   PIN (`tvManageUnlock`, ou l'ouverture du profil par ce code). Sans code,
 *   jamais (`profileManage`).
 * - `memberProfile` : la même chose pour un MEMBRE, avec les droits de son
 *   rôle seulement (`familyRightsOf` : un parent gère tous les invités et les
 *   membres mineurs, un membre les invités qu'il a créés).
 * - `tvProfile` : une session de profil d'une TV, quel qu'en soit le profil.
 * - `desktopProfile` : une session de profil d'un BUREAU, quel qu'en soit le
 *   profil — elle n'ouvre que la gestion (`tvManageUnlock`).
 * - `tvPairing` : le jeton de jumelage d'une TV passée aux profils — il ne
 *   sert QU'À lister les profils et à en ouvrir un (et à se déjumeler).
 * - `tvLegacy` : le jeton d'appareil d'une TV d'avant les profils — seulement
 *   pour l'échange (`tvEnroll`).
 * - `admin` : un administrateur, en session personnelle.
 *
 * Restent à la session PERSONNELLE, même pour qui gère depuis un profil :
 * accepter, refuser, « plus tard », quitter, dissoudre — et « Qui regarde ? »
 * du bureau (`picker*`). L'acteur se déduit TOUJOURS du jeton : depuis un
 * profil, c'est le compte du PROFIL, jamais celui qui a jumelé la TV ou ouvert
 * la session personnelle du bureau.
 */
export type FamilyCaller =
  | "personal"
  | "ownerProfile"
  | "memberProfile"
  | "tvProfile"
  | "desktopProfile"
  | "tvPairing"
  | "tvLegacy"
  | "admin";

// ── Gérer depuis une session de profil ─────────────────────────────────────

/** Ce qu'une session de profil gère, et ce qui lui manque pour gérer. */
export interface ProfileManage {
  /** Les droits du rôle, si le profil a un code PIN ; null sinon. */
  manage: FamilyRights | null;
  /** Le profil gérerait avec un code PIN : la TV ou le bureau le lui dit. */
  needsPin: boolean;
}

/**
 * Une session de profil (TV, bureau) gère avec les droits de son RÔLE
 * (`rights` ; null pour un invité ou le compte de démonstration, qui ne
 * gèrent rien), à une condition : son profil a un code PIN — un seul par
 * compte, le même sur toutes les plateformes, qu'il l'ait posé depuis une TV
 * ou depuis son compte. Le code ouvre la porte, jamais plus de droits. Sans
 * code, rien — `needsPin` le dit.
 */
export function profileManage(rights: FamilyRights | null, hasPin: boolean): ProfileManage {
  if (rights === null) return { manage: null, needsPin: false };
  return hasPin ? { manage: rights, needsPin: false } : { manage: null, needsPin: true };
}
