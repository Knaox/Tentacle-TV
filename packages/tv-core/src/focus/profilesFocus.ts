import { STATUS_PRIMARY_KEY } from "./homeEntry";

/**
 * Le focus des PROFILS d'une Apple TV (Famille) — « Qui regarde ? », le pavé
 * du code PIN, « Gérer les profils » et ses deux pages (créer un invité,
 * inviter un membre). Module pur : la plateforme pose les guides, réclame,
 * verrouille ; ces règles disent seulement OÙ.
 */

/** « Qui regarde ? » : la rangée des profils (un groupe qui mémorise), puis ses actions. */
export const PROFILES_TILES_GROUP = "profiles:tiles";
export const PROFILES_ACTIONS_GROUP = "profiles:actions";
export const PROFILES_STAY_KEY = "profiles:stay";
export const PROFILES_MANAGE_KEY = "profiles:manage";
export const profileTileKey = (index: number): string => `profiles:tile:${index}`;

/** La croix Retour du pavé, et sa bande pleine largeur (HAUT y mène). */
export const PROFILES_BACK_KEY = "profiles:back";
export const PROFILES_BACK_BAR_KEY = "profiles:top";

/** Le pavé du code : une rangée de chiffres, puis ⌫. */
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
}

/**
 * L'entrée de l'écran, réclamée à chaque changement de phase : le profil
 * qu'on vient de quitter (sinon le premier) ; sur le pavé, son premier
 * chiffre — ou la croix quand il est bloqué ; sur une erreur, « Réessayer » ;
 * pendant un chargement, rien (rien n'est focalisable).
 */
export function profilesEntryKey(input: ProfilesEntryInput): string | null {
  switch (input.phase) {
    case "loading":
      return null;
    case "error":
      return STATUS_PRIMARY_KEY;
    case "picker":
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
export const MANAGE_BACK_KEY = "manage:back";
export const MANAGE_BACK_BAR_KEY = "manage:top";

export const GUEST_NAME_KEY = "guest:name";
export const GUEST_COLORS_GROUP = "guest:colors";
export const guestColorKey = (color: string): string => `guest:color:${color}`;
export const GUEST_CREATE_KEY = "guest:create";

export const INVITE_SEARCH_KEY = "invite:search";
export const INVITE_RESULTS_GROUP = "invite:results";
export const inviteCandidateKey = (index: number): string => `invite:candidate:${index}`;

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
}

/**
 * L'entrée de chaque page : la liste entre par sa première action possible
 * (créer un invité, sinon inviter, sinon la première ligne qui en porte une,
 * sinon la croix) ; l'invité, par son nom — ou par « Créer » une fois nommé ;
 * l'invitation, par la recherche.
 */
export function manageEntryKey(input: ManageEntryInput): string {
  switch (input.view) {
    case "list":
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
