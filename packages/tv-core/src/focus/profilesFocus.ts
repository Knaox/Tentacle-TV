import { FAMILY_MAX_PROFILES, FAMILY_PROFILE_COLORS, type FamilyCandidateStatus } from "@tentacle-tv/shared";
import { STATUS_PRIMARY_KEY } from "./homeEntry";

/**
 * Le focus des PROFILS d'une Apple TV (Famille) — « Qui regarde ? », le pavé
 * du code PIN, « Gérer les profils » et ses deux pages (créer un invité,
 * inviter un membre). Module pur : la plateforme pose les sections, réclame,
 * verrouille ; ces règles disent seulement OÙ.
 *
 * Comme sur les autres pages, chaque rangée d'éléments est une SECTION de
 * voisinage (`focus/sections` : HAUT / BAS mènent au plus proche de la
 * section voisine) — la rangée des profils, ses actions, le pavé, les gestes
 * et les lignes de la gestion, la recherche et ses résultats. L'entrée de
 * chaque page, et le RETOUR : on revient sur ce qui a ouvert la page quittée.
 */

/** « Qui regarde ? » : la rangée des profils, puis ses actions — deux sections. */
export const PROFILES_TILES_GROUP = "profiles:tiles";
export const PROFILES_ACTIONS_GROUP = "profiles:actions";
export const PROFILES_STAY_KEY = "profiles:stay";
export const PROFILES_MANAGE_KEY = "profiles:manage";
export const profileTileKey = (index: number): string => `profiles:tile:${index}`;

/** La croix Retour du pavé, et sa bande pleine largeur (HAUT y mène). */
export const PROFILES_BACK_KEY = "profiles:back";
export const PROFILES_BACK_BAR_KEY = "profiles:top";

/** Le pavé du code : une rangée de chiffres, puis ⌫ — une section. */
export const PIN_PAD_GROUP = "pin:pad";
export const pinDigitKey = (digit: string): string => `pin:digit:${digit}`;
export const PIN_ERASE_KEY = "pin:erase";
/** Le premier chiffre de la rangée : l'entrée du pavé. */
export const PIN_ENTRY_DIGIT = "1";

export interface ProfilesEntryInput {
  phase: "loading" | "error" | "picker" | "pin";
  /** Le profil où entrer (`pickerEntryIndex`, session). */
  tileIndex?: number;
  /** Le pavé est bloqué : il n'y a rien à taper, seule la sortie. */
  pinLocked?: boolean;
  /** On revient de « Gérer les profils » : le focus y retourne, s'il existe encore. */
  returnTo?: "manage" | null;
  canManage?: boolean;
}

/**
 * L'entrée de l'écran, réclamée à chaque changement de phase : le profil
 * qu'on vient de quitter (sinon le premier) — ou « Gérer les profils » quand
 * on en revient ; sur le pavé, son premier chiffre — ou la croix quand il est
 * bloqué ; sur une erreur, « Réessayer » ; pendant un chargement, rien (rien
 * n'est focalisable).
 */
export function profilesEntryKey(input: ProfilesEntryInput): string | null {
  switch (input.phase) {
    case "loading":
      return null;
    case "error":
      return STATUS_PRIMARY_KEY;
    case "picker":
      if (input.returnTo === "manage" && input.canManage) return PROFILES_MANAGE_KEY;
      return profileTileKey(Math.max(0, input.tileIndex ?? 0));
    case "pin":
      return input.pinLocked ? PROFILES_BACK_KEY : pinDigitKey(PIN_ENTRY_DIGIT);
  }
}

// ── « Gérer les profils » ───────────────────────────────────────────────────

export const MANAGE_ACTIONS_GROUP = "manage:actions";
export const MANAGE_CREATE_KEY = "manage:createGuest";
export const MANAGE_INVITE_KEY = "manage:invite";
export const MANAGE_ROWS_GROUP = "manage:rows";
export const manageRowKey = (index: number): string => `manage:row:${index}`;
/** L'interrupteur des droits d'un membre (« Peut créer des invités »), à côté de son geste. */
export const manageRightKey = (index: number): string => `manage:right:${index}`;
export const MANAGE_BACK_KEY = "manage:back";
export const MANAGE_BACK_BAR_KEY = "manage:top";

export const GUEST_NAME_KEY = "guest:name";
export const GUEST_COLORS_GROUP = "guest:colors";
export const guestColorKey = (color: string): string => `guest:color:${color}`;
export const GUEST_CREATE_KEY = "guest:create";
/** La rangée de « Créer le profil », pleine largeur : BAS depuis n'importe quelle couleur y mène. */
export const GUEST_ACTIONS_GROUP = "guest:actions";

/**
 * L'entrée DÉCLARÉE de la rangée des couleurs : un sélecteur entre par sa
 * sélection (politique « toujours », comme l'onglet de la saison affichée
 * de la fiche) — BAS depuis le nom tombe sur la couleur choisie, pas sur la
 * plus proche du milieu du champ.
 */
export function guestColorsEntryKey(selected: string): string {
  return guestColorKey(selected);
}

export const INVITE_SEARCH_KEY = "invite:search";
/** La section de la recherche : HAUT depuis n'importe quel résultat y remonte (au plus proche — la seule cible). */
export const INVITE_SEARCH_BAR = "invite:searchBar";
/** La section du nom de l'invité, au-dessus de ses couleurs. */
export const GUEST_NAME_BAR = "guest:nameBar";
export const INVITE_RESULTS_GROUP = "invite:results";
export const inviteCandidateKey = (index: number): string => `invite:candidate:${index}`;
const INVITE_CANDIDATE_PREFIX = "invite:candidate:";

/** Une clé de résultat de la recherche d'invitation. */
export function isInviteCandidateKey(key: string | null | undefined): boolean {
  return !!key?.startsWith(INVITE_CANDIDATE_PREFIX);
}

const CANDIDATE_RANK: Record<FamilyCandidateStatus, number> = { available: 0, invited: 1, in_family: 2 };

/**
 * L'ORDRE des résultats d'une recherche d'invitation : les comptes
 * invitables d'abord, puis ceux qu'une invitation attend, puis ceux déjà dans
 * une famille ; l'ordre du serveur dans chaque groupe. Un statut absent
 * (serveur v1) vaut invitable. BAS depuis la recherche mène ainsi au premier
 * invitable.
 */
export function inviteCandidateOrder<T extends { status?: FamilyCandidateStatus }>(candidates: readonly T[]): T[] {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => CANDIDATE_RANK[a.candidate.status ?? "available"] - CANDIDATE_RANK[b.candidate.status ?? "available"] || a.index - b.index)
    .map(({ candidate }) => candidate);
}

/**
 * Un résultat prend-il le focus ? Seulement s'il s'invite — ou s'il vient
 * d'être invité d'ici (`sent` : il a le focus, il le garde). Les autres
 * (« Déjà dans une famille », « Invitation en attente ») se lisent sans
 * jamais le prendre.
 */
export function inviteCandidateFocusable(candidate: { status?: FamilyCandidateStatus; sent: boolean }): boolean {
  return candidate.sent || (candidate.status ?? "available") === "available";
}

export type ManageView = "list" | "guest" | "invite";

export interface ManageEntryInput {
  view: ManageView;
  /** Ce que la famille permet encore (le serveur reste seul juge). */
  canCreateGuest: boolean;
  canInvite: boolean;
  /** Les lignes qui portent une action (retirer, supprimer, annuler), par leur rang. */
  actionRows: readonly number[];
  /** Le nom de l'invité à créer est saisi : « Créer le profil » d'abord. */
  guestNamed?: boolean;
  /** Des comptes à inviter s'affichent. */
  candidates?: number;
  /** La page d'où l'on revient sur la liste : le focus retourne au bouton qui l'a ouverte. */
  returnFrom?: ManageView | null;
}

/**
 * L'entrée de chaque page : la liste entre par sa première action possible
 * (créer un invité, sinon inviter, sinon la première ligne qui en porte une,
 * sinon la croix) — et, au retour d'une page, par le bouton qui l'avait
 * ouverte s'il est encore là ; l'invité, par son nom — ou par « Créer » une
 * fois nommé ; l'invitation, par la recherche.
 */
export function manageEntryKey(input: ManageEntryInput): string {
  switch (input.view) {
    case "list":
      if (input.returnFrom === "invite" && input.canInvite) return MANAGE_INVITE_KEY;
      if (input.returnFrom === "guest" && input.canCreateGuest) return MANAGE_CREATE_KEY;
      if (input.canCreateGuest) return MANAGE_CREATE_KEY;
      if (input.canInvite) return MANAGE_INVITE_KEY;
      return input.actionRows.length > 0 ? manageRowKey(input.actionRows[0]) : MANAGE_BACK_KEY;
    case "guest":
      return input.guestNamed ? GUEST_CREATE_KEY : GUEST_NAME_KEY;
    case "invite":
      return INVITE_SEARCH_KEY;
  }
}

/**
 * Après un retrait (la ligne disparaît) : la ligne qui prend sa place, sinon
 * la précédente, sinon l'entrée de la liste — le focus ne tombe jamais dans
 * le vide. `actionRows` : les rangs AVANT le retrait.
 */
export function manageFocusAfterRemoval(input: ManageEntryInput, removedRow: number): string {
  const remaining = input.actionRows.filter((row) => row !== removedRow).map((row) => (row > removedRow ? row - 1 : row));
  const next = remaining.find((row) => row >= removedRow) ?? remaining[remaining.length - 1];
  return next !== undefined ? manageRowKey(next) : manageEntryKey({ ...input, view: "list", actionRows: [] });
}

// ── Le clic fantôme ─────────────────────────────────────────────────────────

/** Les comptes qu'une recherche d'invitation montre au plus (la page tient sans défiler). */
export const INVITE_SHOWN_CANDIDATES = 5;

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const range = (count: number): number[] => Array.from({ length: count }, (_, index) => index);

/**
 * Les cibles GARDÉES du clic fantôme : sur ces écrans, chaque geste change la
 * page sous un OK encore enfoncé — un profil ouvre le pavé, la croix rend la
 * rangée, « Créer le profil » rend la liste —, et l'OK relâché validerait la
 * cible qui vient de prendre le focus (vécu au simulateur : le pavé rouvert
 * avec un chiffre tapé). L'OK qui n'a pas COMMENCÉ sur une cible n'y vaut
 * rien. La croix n'en est pas : son verrou passe par la même liaison
 * (`backCross`), et elle ne s'ouvre jamais sous un OK.
 */
export function profilesGuardedKeys(): string[] {
  return [
    ...range(FAMILY_MAX_PROFILES).map(profileTileKey),
    PROFILES_STAY_KEY,
    PROFILES_MANAGE_KEY,
    ...DIGITS.map(pinDigitKey),
    PIN_ERASE_KEY,
  ];
}

export function manageGuardedKeys(): string[] {
  return [
    MANAGE_CREATE_KEY,
    MANAGE_INVITE_KEY,
    ...range(FAMILY_MAX_PROFILES).map(manageRowKey),
    ...range(FAMILY_MAX_PROFILES).map(manageRightKey),
    GUEST_NAME_KEY,
    ...FAMILY_PROFILE_COLORS.map(guestColorKey),
    GUEST_CREATE_KEY,
    INVITE_SEARCH_KEY,
    ...range(INVITE_SHOWN_CANDIDATES).map(inviteCandidateKey),
    ...DIGITS.map(pinDigitKey),
    PIN_ERASE_KEY,
  ];
}

