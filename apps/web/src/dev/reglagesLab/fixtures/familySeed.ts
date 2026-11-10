/**
 * Les données DE DÉPART de la Famille du labo (`settingsFamily.ts` en tient l'état vivant) :
 * Camille, propriétaire ; Noé, membre et parent ; deux invités — Salon (créé par Camille) et
 * Mamie (créée par Noé, sous contrôle parental) ; une invitation en attente pour Léa.
 */

import {
  FAMILY_CONTRACT_VERSION, GUEST_PARENTAL_NONE,
  type FamilyCapability, type FamilyParentalOptionsDto, type FamilyProfileDto, type FamilySwitches,
  type GuestParentalCeiling, type GuestParentalControls, type OutgoingInvitationDto,
} from "@tentacle-tv/shared";
import { LAB_USER } from "./base";

const DAY = 24 * 3_600_000;
const NOW = Date.now();
export const ago = (days: number): string => new Date(NOW - days * DAY).toISOString();
export const ahead = (days: number): string => new Date(NOW + days * DAY).toISOString();

export const SWITCHES: FamilySwitches = { families: true, guests: true, guestRequests: true };

/** `/api/config` › `features.family` : la Famille et les invités allumés, « peut demander » proposable. */
export const LAB_FAMILY_CAPABILITY: FamilyCapability = { v: FAMILY_CONTRACT_VERSION, enabled: true, guests: true, guestRequests: true };

/** Le plafond d'un invité : son créateur n'a aucune restriction. */
export const OPEN_CEILING: GuestParentalCeiling = { ...GUEST_PARENTAL_NONE, allowedTags: [] };

/** Mamie : rien au-delà de « 12 », pas de titre sans classification, jusqu'à 22 h. */
const MAMIE_PARENTAL: GuestParentalControls = {
  maxParentalRating: 12,
  maxParentalSubRating: null,
  blockUnratedItems: ["Movie", "Series"],
  blockedTags: ["horreur"],
  accessSchedules: [{ dayOfWeek: "Everyday", startHour: 8, endHour: 22 }],
};

/** Le propriétaire en tête, puis le membre, puis les invités — l'ordre du contrat. */
export const SEED_PROFILES: readonly FamilyProfileDto[] = [
  {
    userId: LAB_USER.Id, kind: "owner", name: LAB_USER.Name, color: "violet", hasPin: true, imageTag: null, since: null,
    createdBy: null, createdByName: null, rights: null, guestRights: null, promptsResetAt: null,
  },
  {
    userId: "u-noe", kind: "member", name: "Noé", color: "blue", hasPin: true, imageTag: null, since: ago(212),
    createdBy: null, createdByName: null, rights: { createGuests: true }, guestRights: null, parent: true, promptsResetAt: null,
  },
  {
    userId: "g-salon", kind: "guest", name: "Salon", color: "teal", hasPin: false, imageTag: null, since: ago(140),
    createdBy: LAB_USER.Id, createdByName: LAB_USER.Name, rights: null, guestRights: { requestTitles: true },
    parental: { ...GUEST_PARENTAL_NONE }, parentalCeiling: OPEN_CEILING, promptsResetAt: null,
  },
  {
    userId: "g-mamie", kind: "guest", name: "Mamie", color: "amber", hasPin: true, imageTag: null, since: ago(31),
    createdBy: "u-noe", createdByName: "Noé", rights: null, guestRights: { requestTitles: false },
    parental: MAMIE_PARENTAL, parentalCeiling: OPEN_CEILING, promptsResetAt: ago(3),
  },
];

export const SEED_INVITATIONS: readonly OutgoingInvitationDto[] = [
  { id: "inv-lea", inviteeUserId: "u-lea", inviteeName: "Léa", createdAt: ago(2), expiresAt: ahead(5) },
];

/** Les autres comptes du serveur, tels que « Inviter » les propose. */
export const ACCOUNTS: ReadonlyArray<{ userId: string; name: string }> = [
  { userId: "u-lea", name: "Léa" },
  { userId: "u-malik", name: "Malik" },
  { userId: "u-ines", name: "Inès" },
  { userId: "u-hugo", name: "Hugo" },
  { userId: "u-oceane", name: "Océane" },
];

export const PARENTAL_OPTIONS: FamilyParentalOptionsDto = {
  parentalRatings: [
    { name: "Tous publics", score: 0, subScore: null },
    { name: "10", score: 10, subScore: null },
    { name: "12", score: 12, subScore: null },
    { name: "16", score: 16, subScore: null },
    { name: "18", score: 18, subScore: null },
  ],
  unratedItemTypes: ["Movie", "Series", "Trailer"],
  knownTags: ["horreur", "documentaire", "noël", "court métrage"],
};
