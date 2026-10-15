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

// ── La règle : jamais plus large que le créateur ────────────────────────────

/**
 * Plages horaires qui ne s'ouvrent JAMAIS : Jellyfin permet l'accès quand l'heure
 * locale h vérifie `début ≤ h ≤ fin`, et h < 24 toujours. Sert quand les plages du
 * créateur et celles voulues ne se recoupent pas — une liste VIDE voudrait dire
 * « à toute heure » chez Jellyfin.
 */
export const GUEST_SCHEDULE_NEVER: readonly AccessScheduleDto[] = [{ dayOfWeek: "Sunday", startHour: 24, endHour: 24 }];

const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function daysOf(day: AccessScheduleDto["dayOfWeek"]): readonly string[] {
  if (day === "Everyday") return WEEK;
  if (day === "Weekday") return WEEK.slice(1, 6);
  if (day === "Weekend") return [WEEK[0], WEEK[6]];
  return [day];
}

/** L'intersection de deux jeux de plages (vide = à toute heure). Jour par jour, triée. */
export function intersectSchedules(a: readonly AccessScheduleDto[], b: readonly AccessScheduleDto[]): AccessScheduleDto[] {
  if (a.length === 0) return [...b];
  if (b.length === 0) return [...a];
  const out: AccessScheduleDto[] = [];
  for (const day of WEEK) {
    for (const left of a.filter((entry) => daysOf(entry.dayOfWeek).includes(day))) {
      for (const right of b.filter((entry) => daysOf(entry.dayOfWeek).includes(day))) {
        const startHour = Math.max(left.startHour, right.startHour);
        const endHour = Math.min(left.endHour, right.endHour);
        if (startHour < endHour && !out.some((x) => x.dayOfWeek === day && x.startHour === startHour && x.endHour === endHour)) {
          out.push({ dayOfWeek: day, startHour, endHour });
        }
      }
    }
  }
  return out.length > 0 ? out : [...GUEST_SCHEDULE_NEVER];
}

type Limit = { rating: number | null; sub: number | null };

/** La note la plus basse ; à score égal, la sous-note la plus basse (absente = sans limite). */
function stricterLimit(a: Limit, b: Limit): Limit {
  if (a.rating === null) return b;
  if (b.rating === null) return a;
  if (a.rating !== b.rating) return a.rating < b.rating ? a : b;
  if (a.sub === null) return b;
  if (b.sub === null) return a;
  return a.sub <= b.sub ? a : b;
}

function union<T extends string>(a: readonly T[], b: readonly T[]): T[] {
  const seen = new Set<string>();
  return [...a, ...b].filter((value) => {
    const key = value.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Ce que l'invité reçoit : le plafond de son créateur ET le contrôle voulu — la note
 * la plus basse, les types non classés et étiquettes bloquées réunis, les étiquettes
 * PERMISES du créateur imposées, les plages recoupées (jamais plus larges).
 */
export function effectiveGuestParental(ceiling: GuestParentalCeiling, wanted: GuestParentalControls): GuestParentalCeiling {
  const limit = stricterLimit(
    { rating: ceiling.maxParentalRating, sub: ceiling.maxParentalSubRating },
    { rating: wanted.maxParentalRating, sub: wanted.maxParentalSubRating },
  );
  return {
    maxParentalRating: limit.rating,
    maxParentalSubRating: limit.rating === null ? null : limit.sub,
    blockUnratedItems: union(ceiling.blockUnratedItems, wanted.blockUnratedItems),
    blockedTags: union(ceiling.blockedTags, wanted.blockedTags),
    allowedTags: [...ceiling.allowedTags],
    accessSchedules: intersectSchedules(ceiling.accessSchedules, wanted.accessSchedules),
  };
}
