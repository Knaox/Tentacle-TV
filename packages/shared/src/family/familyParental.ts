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

import type { AccessScheduleDto, UnratedItemType, UserRightsOptions } from "../userRights/userRightsContract";

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

/**
 * Le PLAFOND : les restrictions du créateur, lues dans sa politique Jellyfin.
 * L'invité ne va jamais au-delà ; ses étiquettes PERMISES s'imposent aussi à lui.
 */
export interface GuestParentalCeiling extends GuestParentalControls {
  allowedTags: string[];
}

/**
 * `FamilyProfileDto.parental` / `parentalCeiling` (champs additifs, 1.30.0) : rendus
 * SEULEMENT à qui peut régler cet invité (le propriétaire, ou le membre qui l'a
 * créé) ; ABSENTS pour tout autre appelant, et sur un serveur d'avant.
 * `PUT /api/family/guests/:userId/parental` rend la même paire.
 */
export interface GuestParentalDto {
  /** Ce que la famille veut pour cet invité. */
  parental: GuestParentalControls;
  /** Le plafond de son créateur ; null si Jellyfin ne répond pas. */
  parentalCeiling: GuestParentalCeiling | null;
}

/** `PUT /api/family/guests/:userId/parental` : le contrôle ENTIER (remplacement). */
export type SetGuestParentalBody = GuestParentalControls;

/** `GET /api/family/parental/options` : le sous-ensemble de `UserRightsOptions` qui
 *  sert au contrôle parental, mêmes formes, même lecture côté serveur. */
export type FamilyParentalOptionsDto = Pick<UserRightsOptions, "parentalRatings" | "unratedItemTypes" | "knownTags">;
