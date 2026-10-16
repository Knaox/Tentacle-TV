import { canManageGuest, sameUserId, type FamilyProfileDto, type FamilyRights, type FamilySwitches } from "@tentacle-tv/shared";

/**
 * La FICHE d'un profil dans « Gérer les profils » (TV, décisions du 16/10) :
 * les gestes que le RÔLE de la session y a — module pur. Le serveur reste le
 * seul juge ; ces règles ne servent qu'à ne pas proposer un geste voué au
 * refus (tout refus se dit quand même).
 *
 * - Un INVITÉ, pour qui le gère (`canManageGuest` : le propriétaire et un
 *   parent, tous ; un membre, ceux qu'il a créés) : sa photo, son code PIN,
 *   « Peut demander des films » (le propriétaire et un parent seulement), son
 *   contrôle parental, le supprimer.
 * - Un MEMBRE, pour le propriétaire : le nommer parent, « Peut créer des
 *   invités » (un parent en crée d'office), son contrôle parental s'il est
 *   mineur, le retirer. Pour un parent : le contrôle parental d'un membre
 *   mineur, rien d'autre.
 * - Le propriétaire, et la session elle-même : rien ici (son propre code se
 *   règle dans Réglages › Compte).
 *
 * Restent à la session PERSONNELLE (web, bureau, mobile) : accepter, refuser,
 * « plus tard », quitter, dissoudre.
 */

export type ManageGesture =
  | { kind: "photo" }
  /** Son code : le poser, ou le changer et le retirer. */
  | { kind: "pin"; hasPin: boolean }
  | { kind: "requestTitles"; on: boolean }
  | { kind: "parentRole"; on: boolean }
  | { kind: "createGuests"; on: boolean }
  /** L'entrée vers l'écran du contrôle parental (bibliothèques, âge). */
  | { kind: "parental" }
  | { kind: "delete" }
  | { kind: "remove" };

export type ManageGestureKind = ManageGesture["kind"];

/**
 * Ce que le serveur sait faire, et ce que cette TV sait montrer — un geste
 * absent n'est pas proposé. Absent : non.
 */
export interface ManageSheetCapability {
  /** `features.family.guestRequests` : une extension sait demander un titre. */
  guestRequests?: boolean;
  /** `family.guestPhotos`, et la galerie des personnages sur cette TV. */
  guestPhotos?: boolean;
  /** `family.roles` : nommer un parent. */
  roles?: boolean;
  /** `family.parentalControls`, et l'écran du contrôle parental sur cette TV. */
  guestParental?: boolean;
  /** `family.memberParental`, et l'écran du contrôle parental sur cette TV. */
  memberParental?: boolean;
}

export interface ManageSheetContext {
  rights: FamilyRights;
  /** La session : le compte du profil qui gère. */
  actorId: string;
  switches: FamilySwitches;
  capability: ManageSheetCapability;
}

function guestGestures(profile: FamilyProfileDto, context: ManageSheetContext): ManageGesture[] {
  const { rights, capability, switches } = context;
  if (!canManageGuest(rights, profile.createdBy ?? null, context.actorId)) return [];
  const gestures: ManageGesture[] = [];
  if (capability.guestPhotos) gestures.push({ kind: "photo" });
  gestures.push({ kind: "pin", hasPin: profile.hasPin });
  // « Peut demander » : le propriétaire et un parent, la Famille et les invités allumés, le droit annoncé.
  if (rights.manageGuests === "all" && capability.guestRequests && switches.families && switches.guests) {
    gestures.push({ kind: "requestTitles", on: profile.guestRights?.requestTitles === true });
  }
  if (capability.guestParental) gestures.push({ kind: "parental" });
  gestures.push({ kind: "delete" });
  return gestures;
}

function memberGestures(profile: FamilyProfileDto, context: ManageSheetContext): ManageGesture[] {
  const { rights, capability } = context;
  const parent = profile.parent === true;
  // Un mineur : un membre qui n'est pas parent (un administrateur de Jellyfin, le serveur le refuse et le dit).
  const parental = capability.memberParental === true && rights.manageMinors === true && !parent;
  const gestures: ManageGesture[] = [];
  if (rights.manageMembers) {
    if (capability.roles && rights.manageRoles) gestures.push({ kind: "parentRole", on: parent });
    if (!parent) gestures.push({ kind: "createGuests", on: profile.rights?.createGuests === true });
    if (parental) gestures.push({ kind: "parental" });
    gestures.push({ kind: "remove" });
    return gestures;
  }
  return parental ? [{ kind: "parental" }] : [];
}

/** Les gestes de la fiche de ce profil, dans l'ordre où la fiche les montre. Aucun : la ligne ne s'ouvre pas. */
export function manageGesturesOf(profile: FamilyProfileDto, context: ManageSheetContext): ManageGesture[] {
  if (sameUserId(profile.userId, context.actorId)) return [];
  if (profile.kind === "guest") return guestGestures(profile, context);
  if (profile.kind === "member") return memberGestures(profile, context);
  return [];
}

/** Le geste qui RETIRE le profil (supprimer un invité, retirer un membre), s'il en a un. */
export function sheetRemoval(gestures: readonly ManageGesture[]): "delete" | "remove" | null {
  const found = gestures.find((gesture) => gesture.kind === "delete" || gesture.kind === "remove");
  return found ? (found.kind as "delete" | "remove") : null;
}
