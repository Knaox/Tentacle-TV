/**
 * La Famille — le CONTRÔLE PARENTAL d'un invité (serveur 1.30.0, capacité
 * `family.parentalControls`). Partie du contrat : `familyContract.ts` le
 * ré-exporte. Carnet : docs/DROITS-UTILISATEURS.md § 4.
 *
 * Le PROPRIÉTAIRE règle celui de tout invité de la famille ; un MEMBRE, celui
 * de ses propres invités (`setGuestParental`). Jamais celui d'un membre ni du
 * propriétaire : ce sont de vrais comptes, réglés par l'administrateur.
 *
 * Jamais plus large que le créateur : l'invité reçoit l'INTERSECTION des
 * restrictions de son créateur et de ce contrôle, écrite dans SA politique
 * Jellyfin — c'est Jellyfin qui l'applique. Le contrôle VOULU est gardé par
 * Tentacle (un réglage de la Famille) ; la politique EFFECTIVE vit dans Jellyfin.
 *
 * MIROIR : `apps/backend/src/family/familyParental.ts`, octet pour octet
 * (commande de recopie : l'en-tête de `familyContract.ts`).
 */

import type { AccessScheduleDto, UnratedItemType } from "../userRights/userRightsContract";

/** Ce que la famille règle pour UN invité — les mots et les formes de `UserRights`. */
export interface GuestParentalControls {
  /** Le score maximal de la table de Jellyfin ; null : aucune limite (celle du créateur reste). */
  maxParentalRating: number | null;
  maxParentalSubRating: number | null;
  /** Les types de titres SANS classification bloqués. */
  blockUnratedItems: UnratedItemType[];
  blockedTags: string[];
  /** Vide : à toute heure (dans celles du créateur). */
  accessSchedules: AccessScheduleDto[];
}

/** Aucun contrôle : l'invité suit son créateur, rien de plus. */
export const GUEST_PARENTAL_NONE: Readonly<GuestParentalControls> = {
  maxParentalRating: null,
  maxParentalSubRating: null,
  blockUnratedItems: [],
  blockedTags: [],
  accessSchedules: [],
};

/** `FamilyProfileDto.parental` d'un invité (champ additif ; absent : serveur d'avant). */
export interface GuestParentalDto {
  /** Ce que la famille veut pour cet invité. */
  controls: GuestParentalControls;
  /** Ce que son créateur impose déjà (le plancher, lu dans Jellyfin) ; null si Jellyfin
   *  ne répond pas. Les étiquettes PERMISES du créateur s'imposent aussi à l'invité. */
  inherited: (GuestParentalControls & { allowedTags: string[] }) | null;
}

/** `PUT /api/family/guests/:userId/parental` : le contrôle ENTIER (remplacement). */
export type SetGuestParentalBody = GuestParentalControls;
