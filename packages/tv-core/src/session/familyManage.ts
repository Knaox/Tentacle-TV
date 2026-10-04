import {
  FAMILY_MAX_PROFILES,
  capacityError,
  type FamilyOverviewDto,
  type FamilyProfileColor,
  type FamilyProfileKind,
} from "@tentacle-tv/shared";

/**
 * « GÉRER LES PROFILS » sur l'Apple TV — ce que la page montre, tiré de la vue
 * d'ensemble de la Famille (`GET /api/family`, session du propriétaire,
 * gestion ouverte). Module pur. Les capacités ne servent qu'à NE PAS proposer
 * un geste voué au refus (« La famille est complète ») : le serveur reste le
 * seul juge, et tout refus se dit quand même (`profileRefusalOf`).
 */

/** Ce qu'on peut faire d'une ligne : retirer un membre, supprimer un invité, annuler une invitation. */
export type ManageRowAction = "remove" | "delete" | "cancel" | null;

export interface ManageRowModel {
  /** Le compte (profil) ou l'invitation. */
  id: string;
  kind: FamilyProfileKind | "invitation";
  name: string;
  /** Le compte Jellyfin de la ligne (l'invité pour une invitation). */
  userId: string;
  color: FamilyProfileColor | null;
  imageTag: string | null;
  hasPin: boolean;
  action: ManageRowAction;
  /** Une invitation : expire le (ISO). */
  expiresAt: string | null;
}

const ACTION_OF: Record<FamilyProfileKind, ManageRowAction> = { owner: null, member: "remove", guest: "delete" };

/**
 * Les lignes : le propriétaire en tête, ses membres, ses invités (l'ordre du
 * serveur), puis les invitations en attente. Sans famille encore (elle naît à
 * son premier invité ou à sa première invitation) : le propriétaire seul.
 */
export function manageRows(overview: FamilyOverviewDto, owner: { userId: string; name: string; color: FamilyProfileColor }): ManageRowModel[] {
  const family = overview.owned;
  if (!family) {
    return [{ id: owner.userId, kind: "owner", name: owner.name, userId: owner.userId, color: owner.color, imageTag: null, hasPin: overview.account.hasPin, action: null, expiresAt: null }];
  }
  const profiles: ManageRowModel[] = family.profiles.map((profile) => ({
    id: profile.userId,
    kind: profile.kind,
    name: profile.name,
    userId: profile.userId,
    color: profile.color,
    imageTag: profile.imageTag,
    hasPin: profile.hasPin,
    action: ACTION_OF[profile.kind],
    expiresAt: null,
  }));
  const invitations: ManageRowModel[] = family.pendingInvitations.map((invitation) => ({
    id: invitation.id,
    kind: "invitation",
    name: invitation.inviteeName,
    userId: invitation.inviteeUserId,
    color: null,
    imageTag: null,
    hasPin: false,
    action: "cancel",
    expiresAt: invitation.expiresAt,
  }));
  return [...profiles, ...invitations];
}

/** Les rangs des lignes qui portent une action (le focus de la page s'y pose). */
export function manageActionRows(rows: readonly ManageRowModel[]): number[] {
  return rows.flatMap((row, index) => (row.action ? [index] : []));
}

/** Pourquoi un geste n'est pas proposé — la page le dit à sa place. */
export type ManageBlock = "full" | "guestsFull" | "guestsOff" | "familiesOff" | null;

export interface ManageCapacity {
  /** Profils comptés (propriétaire et invitations en attente compris). */
  profiles: number;
  max: number;
  canCreateGuest: boolean;
  canInvite: boolean;
  guestBlock: ManageBlock;
  inviteBlock: ManageBlock;
}

export function manageCapacity(overview: FamilyOverviewDto): ManageCapacity {
  const family = overview.owned;
  const members = family?.profiles.filter((profile) => profile.kind === "member").length ?? 0;
  const guests = family?.profiles.filter((profile) => profile.kind === "guest").length ?? 0;
  const pendingInvitations = family?.pendingInvitations.length ?? 0;
  const counts = { members, guests, pendingInvitations };
  const review = overview.account.reviewAccount;
  const familiesOff = !overview.switches.families;
  const guestError = capacityError("guest", counts);
  const memberError = capacityError("member", counts);
  const guestBlock: ManageBlock = familiesOff
    ? "familiesOff"
    : !overview.switches.guests
      ? "guestsOff"
      : guestError === "family.full" ? "full" : guestError === "family.guests_full" ? "guestsFull" : null;
  const inviteBlock: ManageBlock = familiesOff ? "familiesOff" : memberError ? "full" : null;
  return {
    profiles: 1 + members + guests + pendingInvitations,
    max: overview.limits.maxProfiles ?? FAMILY_MAX_PROFILES,
    canCreateGuest: !review && guestBlock === null,
    canInvite: !review && inviteBlock === null,
    guestBlock,
    inviteBlock,
  };
}
