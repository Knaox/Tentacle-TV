import {
  FAMILY_MAX_PROFILES,
  canManageGuest,
  capacityError,
  familyRightsOf,
  sameUserId,
  type FamilyGuestRights,
  type FamilyMemberRights,
  type FamilyOverviewDto,
  type FamilyProfileColor,
  type FamilyProfileDto,
  type FamilyProfileKind,
  type FamilyRights,
  type FamilyRole,
  type OutgoingInvitationDto,
} from "@tentacle-tv/shared";

/**
 * « GÉRER LES PROFILS » sur l'Apple TV — ce que la page montre, tiré de la vue
 * d'ensemble de la Famille (`GET /api/family`, session de qui gère, gestion
 * ouverte par SON PIN). Module pur. La famille est PARTAGÉE (v2) : le
 * propriétaire y gère tout ; un membre, ce que ses droits permettent — créer
 * des invités si le propriétaire le lui permet, supprimer ceux qu'il a créés.
 * Les droits et les capacités ne servent qu'à NE PAS proposer un geste voué au
 * refus : le serveur reste le seul juge, et tout refus se dit quand même
 * (`profileRefusalOf`). Un serveur v1 (sans `family`) : le propriétaire seul,
 * tous les droits, comme avant.
 */

/** La famille que la session gère : la sienne, et ce qu'elle peut y faire. */
export interface ManagedFamily {
  role: FamilyRole;
  /** Le propriétaire de la famille ; null pour un serveur v1 (c'est la session). */
  ownerId: string | null;
  ownerName: string | null;
  profiles: FamilyProfileDto[];
  pendingInvitations: OutgoingInvitationDto[];
  rights: FamilyRights;
}

/** `family` (v2), sinon `owned` (v1 : le propriétaire). Sans famille encore : null. */
export function managedFamilyOf(overview: FamilyOverviewDto): ManagedFamily | null {
  const family = overview.family;
  if (family) {
    return {
      role: family.role, ownerId: family.owner.userId, ownerName: family.owner.name,
      profiles: family.profiles, pendingInvitations: family.pendingInvitations, rights: family.rights,
    };
  }
  const owned = overview.owned;
  if (!owned) return null;
  return {
    role: "owner", ownerId: null, ownerName: null,
    profiles: owned.profiles, pendingInvitations: owned.pendingInvitations, rights: familyRightsOf("owner", null, overview.switches),
  };
}

/** Ce que la session peut faire. Sans famille encore, un propriétaire en devenir : elle naît à son premier ajout. */
export function manageRightsOf(overview: FamilyOverviewDto): FamilyRights {
  return managedFamilyOf(overview)?.rights ?? familyRightsOf("owner", null, overview.switches);
}

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
  /** Un invité créé par un MEMBRE : « ajouté par … » (v2) ; null pour ceux du propriétaire (rien à en dire). */
  createdByName: string | null;
  /** Un membre, vu par le propriétaire : ses droits, réglables (« Peut créer des invités ») ; null sinon. */
  memberRights: FamilyMemberRights | null;
  /** Un invité, vu par le propriétaire, sur un serveur qui annonce le droit :
   *  « Peut demander des films » (ses demandes partent au nom du propriétaire) ; null sinon. */
  guestRights: FamilyGuestRights | null;
}

/** Ce que `/api/config` › `features.family` annonce et que la vue d'ensemble ne porte pas. */
export interface ManageCapability {
  /** Le droit d'invité « peut demander » existe sur ce serveur ; absent : non. */
  guestRequests?: boolean;
}

/** Le geste qui RETIRE une ligne, s'il est permis à la session (`actorId`). */
function actionOf(profile: FamilyProfileDto, rights: FamilyRights, actorId: string): ManageRowAction {
  if (profile.kind === "member") return rights.manageMembers ? "remove" : null;
  if (profile.kind === "guest") return canManageGuest(rights, profile.createdBy ?? null, actorId) ? "delete" : null;
  return null;
}

/** « Ajouté par » : un invité créé par un membre — pas par le propriétaire, ni une ligne d'avant la v2. */
function addedByOf(profile: FamilyProfileDto, ownerId: string | null): string | null {
  if (profile.kind !== "guest" || !profile.createdBy || !profile.createdByName) return null;
  return ownerId && sameUserId(profile.createdBy, ownerId) ? null : profile.createdByName;
}

/**
 * Les lignes : le propriétaire en tête, les membres, les invités (l'ordre du
 * serveur), puis les invitations en attente (le propriétaire seul les voit).
 * Chaque ligne porte le geste que la session y a, ou aucun. Sans famille
 * encore (elle naît à son premier invité ou à sa première invitation) : la
 * session seule.
 */
export function manageRows(
  overview: FamilyOverviewDto,
  actor: { userId: string; name: string; color: FamilyProfileColor },
  capability: ManageCapability = {},
): ManageRowModel[] {
  const family = managedFamilyOf(overview);
  if (!family) {
    return [{
      id: actor.userId, kind: "owner", name: actor.name, userId: actor.userId, color: actor.color, imageTag: null,
      hasPin: overview.account.hasPin, action: null, expiresAt: null, createdByName: null, memberRights: null, guestRights: null,
    }];
  }
  const { rights } = family;
  // « Peut demander » : le propriétaire seul, la Famille et les invités allumés, le droit annoncé.
  const guestRightsOpen = rights.manageMembers && capability.guestRequests === true && overview.switches.families && overview.switches.guests;
  const profiles: ManageRowModel[] = family.profiles.map((profile) => ({
    id: profile.userId,
    kind: profile.kind,
    name: profile.name,
    userId: profile.userId,
    color: profile.color,
    imageTag: profile.imageTag,
    hasPin: profile.hasPin,
    action: actionOf(profile, rights, actor.userId),
    expiresAt: null,
    createdByName: addedByOf(profile, family.ownerId),
    memberRights: profile.kind === "member" && rights.manageMembers ? (profile.rights ?? { createGuests: false }) : null,
    guestRights: profile.kind === "guest" && guestRightsOpen ? (profile.guestRights ?? { requestTitles: false }) : null,
  }));
  const pending = rights.manageMembers ? family.pendingInvitations : [];
  const invitations: ManageRowModel[] = pending.map((invitation) => ({
    id: invitation.id,
    kind: "invitation",
    name: invitation.inviteeName,
    userId: invitation.inviteeUserId,
    color: null,
    imageTag: null,
    hasPin: false,
    action: "cancel",
    expiresAt: invitation.expiresAt,
    createdByName: null,
    memberRights: null,
    guestRights: null,
  }));
  return [...profiles, ...invitations];
}

/** Les rangs des lignes qui portent une action (le focus de la page s'y pose). */
export function manageActionRows(rows: readonly ManageRowModel[]): number[] {
  return rows.flatMap((row, index) => (row.action ? [index] : []));
}

/** Pourquoi un geste n'est pas proposé — la page le dit à sa place. `noGuestRight` :
 *  un membre à qui le propriétaire n'a pas permis de créer des invités. */
export type ManageBlock = "full" | "guestsFull" | "guestsOff" | "familiesOff" | "noGuestRight" | null;

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
  const family = managedFamilyOf(overview);
  const rights = manageRightsOf(overview);
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
      : !rights.createGuests
        ? "noGuestRight"
        : guestError === "family.full" ? "full" : guestError === "family.guests_full" ? "guestsFull" : null;
  // Inviter : le propriétaire seul. Un membre n'en a pas l'idée — rien à dire à sa place.
  const inviteBlock: ManageBlock = !rights.manageMembers ? null : familiesOff ? "familiesOff" : memberError ? "full" : null;
  return {
    profiles: 1 + members + guests + pendingInvitations,
    max: overview.limits.maxProfiles ?? FAMILY_MAX_PROFILES,
    canCreateGuest: !review && guestBlock === null,
    canInvite: !review && rights.manageMembers && inviteBlock === null,
    guestBlock,
    inviteBlock,
  };
}
