/**
 * La Famille — les BIBLIOTHÈQUES qu'elle permet à un invité ou à un membre
 * mineur (serveur 1.30.0, capacité `family.libraryLimits`). Partie du
 * contrat : `familyContract.ts` le ré-exporte. Carnet :
 * docs/DROITS-UTILISATEURS.md § 9.8.
 *
 * Les mêmes qui règlent son contrôle parental (`setGuestParental`,
 * `setMemberParental`) : le propriétaire et un parent, sur tout invité et tout
 * membre mineur ; un membre, sur les invités qu'il a créés. Jamais le
 * propriétaire, un parent ni un administrateur Jellyfin.
 *
 * C'est JELLYFIN qui applique : la politique du profil porte l'intersection du
 * PLAFOND (les bibliothèques de son créateur pour un invité ; pour un membre,
 * celles que lui donne l'administrateur) et de la liste voulue — jamais plus
 * large. Une règle FAMILIALE : un membre qui quitte la famille, ou une famille
 * dissoute, rend ses bibliothèques d'avant ; ce que l'administrateur a changé
 * entre-temps est ce qui est rendu.
 *
 * MIROIR : `apps/backend/src/family/familyLibraries.ts`, octet pour octet
 * (commande de recopie : l'en-tête de `familyContract.ts`).
 */

/** Une bibliothèque du serveur, telle que la famille la propose. */
export interface FamilyLibraryDto {
  id: string;
  name: string;
  /** Le type Jellyfin (`movies`, `tvshows`…) ; null s'il n'en a pas. */
  collectionType: string | null;
}

/**
 * `GET` (et réponse du `PUT`) `/api/family/profiles/:userId/libraries` : lu à la
 * demande, à qui peut régler ce profil seulement.
 */
export interface FamilyLibrariesDto {
  /** Ce que le profil verrait SANS la famille (son plafond), dans l'ordre du serveur. */
  available: FamilyLibraryDto[];
  /** La liste voulue par la famille ; null : toutes celles du plafond. */
  allowed: string[] | null;
}

/**
 * `PUT /api/family/profiles/:userId/libraries` : la liste ENTIÈRE (remplacement).
 * null : plus de restriction familiale ; sinon au moins une bibliothèque, toutes
 * dans `available` (`family.invalid_input` sinon). Une liste qui les couvre
 * toutes reste une liste : une bibliothèque créée plus tard n'y entre pas.
 */
export interface SetFamilyLibrariesBody {
  allowed: string[] | null;
}
