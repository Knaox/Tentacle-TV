import {
  FAMILY_MAX_GUESTS,
  FAMILY_MAX_PROFILES,
  type FamilyCandidateDto,
  type FamilyCapability,
  type FamilyDto,
  type FamilyOverviewDto,
  type FamilyProfileDto,
  type FamilyRole,
  type IncomingInvitationDto,
  type OwnedFamilyDto,
  type FamilyProfileColor,
} from "./familyContract";
import { canManageGuest } from "./familyRights";
import { capacityError, sameUserId } from "./familyRules";
import type { FamilyErrorCode } from "./familyProtocol";

/**
 * La Famille côté CLIENTS (web, bureau, mobile) — ce que l'écran MONTRE, tiré
 * de la vue d'ensemble rendue par le serveur. Rien n'y est décidé à la place
 * du serveur : ces règles masquent un bouton voué au refus, le serveur refuse
 * de toute façon (docs/FAMILLE.md). Pas de miroir : le serveur n'en a pas
 * besoin. Module pur : `familyClient.test.ts`.
 */

/** La Famille existe-t-elle ici ? Serveur d'avant (capacité absente) ou hors
 *  ligne : rien ne s'en montre — ni réglage, ni affiche, ni requête. */
export function isFamilyAvailable(capability: FamilyCapability | undefined, offline: boolean): boolean {
  return !offline && capability !== undefined && capability.v >= 1;
}

export interface OwnedCounts {
  profiles: number;
  guests: number;
  members: number;
  pending: number;
}

/** Les places prises dans la famille : le propriétaire, les membres, les
 *  invités, et les invitations en attente (elles réservent leur place — un
 *  membre ne les voit pas : le serveur tranche). */
export function familyCounts(family: FamilyDto | null): OwnedCounts {
  const members = family?.profiles.filter((p) => p.kind === "member").length ?? 0;
  const guests = family?.profiles.filter((p) => p.kind === "guest").length ?? 0;
  const pending = family?.pendingInvitations.length ?? 0;
  return { profiles: 1 + members + guests + pending, guests, members, pending };
}

/** @deprecated v1 — `familyCounts(overview.family)`. */
export function ownedCounts(owned: OwnedFamilyDto | null): OwnedCounts {
  const members = owned?.profiles.filter((p) => p.kind === "member").length ?? 0;
  const guests = owned?.profiles.filter((p) => p.kind === "guest").length ?? 0;
  const pending = owned?.pendingInvitations.length ?? 0;
  return { profiles: 1 + members + guests + pending, guests, members, pending };
}

export interface OwnerActions {
  /** Inviter un compte : null si permis, sinon le refus qu'on dirait. */
  invite: FamilyErrorCode | null;
  /** Créer un profil invité : null si permis, sinon le refus qu'on dirait. */
  addGuest: FamilyErrorCode | null;
}

/**
 * Ce que CE compte peut ajouter maintenant (v2) : le propriétaire invite et
 * crée des invités ; un membre crée des invités si le propriétaire le lui
 * permet, n'invite jamais ; un compte sans famille crée la sienne en invitant
 * ou en ajoutant un invité. Vaut aussi pour la gestion des profils de la TV.
 */
export function familyActions(overview: FamilyOverviewDto): OwnerActions {
  const { account, switches, family } = overview;
  const base: FamilyErrorCode | null = account.reviewAccount
    ? "family.review_account"
    : !family && !account.canOwn
      ? "family.guest_account"
      : !switches.families
        ? "family.disabled"
        : null;
  const counts = familyCounts(family);
  const tally = { members: counts.members, guests: counts.guests, pendingInvitations: counts.pending };
  return {
    invite: base ?? (family?.role === "member" ? "family.not_owner" : capacityError("member", tally)),
    addGuest:
      base ??
      (!switches.guests
        ? "family.guests_disabled"
        : family?.role === "member" && !family.rights.createGuests
          ? "family.guest_right_required"
          : capacityError("guest", tally)),
  };
}

/** @deprecated v1 — `familyActions` : ce que le propriétaire (ou futur
 *  propriétaire) peut ajouter, en session personnelle. */
export function ownerActions(overview: FamilyOverviewDto): OwnerActions {
  const { account, switches } = overview;
  const base: FamilyErrorCode | null = !account.personalSession
    ? "family.personal_session_required"
    : account.reviewAccount
      ? "family.review_account"
      : !account.canOwn
        ? "family.guest_account"
        : !switches.families
          ? "family.disabled"
          : null;
  const counts = ownedCounts(overview.owned);
  const tally = { members: counts.members, guests: counts.guests, pendingInvitations: counts.pending };
  return {
    invite: base ?? capacityError("member", tally),
    addGuest: base ?? (!switches.guests ? "family.guests_disabled" : capacityError("guest", tally)),
  };
}

export const FAMILY_LIMITS = { profiles: FAMILY_MAX_PROFILES, guests: FAMILY_MAX_GUESTS } as const;

// ── v2 : la famille partagée, vue par celui qui la regarde ─────────────────

/** Le rôle de ce compte dans SA famille ; `none` : il n'en a pas (l'écran
 *  « Créez votre famille », et les invitations reçues). */
export type FamilyViewerRole = FamilyRole | "none";

export function familyViewerRole(overview: FamilyOverviewDto): FamilyViewerRole {
  return overview.family?.role ?? "none";
}

/** Le propriétaire de la famille de ce compte (« Famille de X ») ; null sans famille. */
export function familyOwnerName(overview: FamilyOverviewDto): string | null {
  return overview.family?.owner.name ?? null;
}

/** Ce profil est-il celui de ce compte ? (« Vous », et jamais un geste sur soi.) */
export function isOwnProfile(profile: Pick<FamilyProfileDto, "userId">, viewerUserId: string | null | undefined): boolean {
  return !!viewerUserId && sameUserId(profile.userId, viewerUserId);
}

/** Un droit réglable sur un profil : « peut créer des invités » (un membre),
 *  « peut demander des films » (un invité — il demande à son propre nom).
 *  Le propriétaire seul les règle. */
export type FamilyProfileRight = "createGuests" | "requestTitles";

export interface ProfileActions {
  /** Poser, changer ou retirer le code PIN de ce profil (un invité). */
  pin: boolean;
  /** Retirer ce membre, ou supprimer cet invité (et son compte Jellyfin). */
  remove: boolean;
  /** Le droit que ce compte règle sur ce profil, ou null. */
  right: FamilyProfileRight | null;
}

const NO_ACTIONS: ProfileActions = { pin: false, remove: false, right: null };

/**
 * Ce que CE compte peut faire sur UN profil de sa famille, depuis le web, le
 * bureau ou le mobile (session personnelle) : le propriétaire retire un
 * membre et règle ses droits, et règle « peut demander » d'un invité ;
 * supprimer un invité et poser son PIN reviennent au propriétaire, ou au
 * membre qui l'a créé (`canManageGuest`). Jamais un
 * geste sur soi-même ni sur le propriétaire — son propre PIN et « Quitter »
 * ont leur place à part. Le serveur revérifie tout.
 */
export function profileActions(
  overview: FamilyOverviewDto,
  profile: FamilyProfileDto,
  viewerUserId: string | null | undefined,
  capability: ProfileActionsCapability = {},
): ProfileActions {
  const family = overview.family;
  if (!family || !overview.account.personalSession || !viewerUserId) return NO_ACTIONS;
  if (profile.kind === "owner" || isOwnProfile(profile, viewerUserId)) return NO_ACTIONS;
  if (profile.kind === "member") {
    const owner = family.rights.manageMembers;
    return { pin: false, remove: owner, right: owner ? "createGuests" : null };
  }
  const manage = canManageGuest(family.rights, profile.createdBy, viewerUserId);
  return { pin: manage, remove: manage, right: guestRightOf(overview, capability) };
}

/** Ce que `/api/config` › `features.family` annonce et que la vue d'ensemble
 *  ne porte pas. */
export interface ProfileActionsCapability {
  /** Le droit d'invité « peut demander » existe sur ce serveur ; absent : non. */
  guestRequests?: boolean;
}

/** « Peut demander des films » se règle par le propriétaire, la Famille et les
 *  invités allumés, sur un serveur qui annonce le droit (`guestRequests`). */
function guestRightOf(overview: FamilyOverviewDto, capability: ProfileActionsCapability): FamilyProfileRight | null {
  const { switches, family } = overview;
  if (!family?.rights.manageMembers || capability.guestRequests !== true) return null;
  return switches.families && switches.guests ? "requestTitles" : null;
}

/** Le droit « peut demander » d'un invité : un champ absent vaut « coupé ». */
export function guestCanRequest(profile: Pick<FamilyProfileDto, "guestRights">): boolean {
  return profile.guestRights?.requestTitles === true;
}

export interface CandidateView {
  /** Seul un compte `available` s'invite. */
  invitable: boolean;
  /** La clé i18n qui dit pourquoi il est grisé ; null s'il s'invite. */
  noteKey: string | null;
}

/** Un candidat dans la liste : invitable, ou grisé avec sa raison (« déjà dans
 *  une famille », sans jamais dire laquelle ; « invitation en attente »). Un
 *  statut ABSENT vient d'un serveur v1 : il ne rendait que des comptes
 *  invitables — le client, livré à part, les laisse invitables. Un statut
 *  inconnu (serveur plus récent) se grise sans raison. */
export function candidateView(candidate: { status?: FamilyCandidateDto["status"] | null }): CandidateView {
  switch (candidate.status) {
    case undefined:
    case null:
    case "available":
      return { invitable: true, noteKey: null };
    case "in_family":
      return { invitable: false, noteKey: "family:candidates.inFamily" };
    case "invited":
      return { invitable: false, noteKey: "family:candidates.invited" };
    default:
      return { invitable: false, noteKey: null };
  }
}

/** Une invitation que l'affiche peut montrer d'elle-même : pas tue par
 *  « Plus tard », pas écartée pendant cette session, pas échue. */
function isPosterEligible(invitation: IncomingInvitationDto, now: number, dismissed: ReadonlySet<string>): boolean {
  if (dismissed.has(invitation.id)) return false;
  if (Date.parse(invitation.expiresAt) <= now) return false;
  return invitation.snoozedUntil === null || Date.parse(invitation.snoozedUntil) <= now;
}

/**
 * L'invitation que l'affiche montre : celle que la cloche a demandée (même
 * tue par « Plus tard » — on l'a choisie), sinon la plus ancienne éligible.
 * null : rien à montrer.
 */
export function pickPosterInvitation(
  incoming: readonly IncomingInvitationDto[],
  options: { now: number; dismissed: ReadonlySet<string>; requestedId: string | null },
): IncomingInvitationDto | null {
  if (options.requestedId) {
    const requested = incoming.find((invitation) => invitation.id === options.requestedId);
    if (requested && Date.parse(requested.expiresAt) > options.now) return requested;
  }
  const eligible = incoming
    .filter((invitation) => isPosterEligible(invitation, options.now, options.dismissed))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return eligible[0] ?? null;
}

/**
 * Le clic sur une notification de la Famille (cloche ou push) : l'invitation
 * dont l'AFFICHE doit s'ouvrir, ou null — les autres notifications mènent à
 * la page de la Famille. L'identifiant ne fait que CHOISIR parmi les
 * invitations que le serveur rend à la session ; il n'est jamais renvoyé
 * tel quel au serveur.
 */
export function familyPosterRequestOf(notification: { type: string; refId: string | null | undefined }): string | null {
  return notification.type === "family_invite" && notification.refId ? notification.refId : null;
}

/**
 * Les couleurs d'un profil : le contrat n'en donne que les NOMS
 * (`FAMILY_PROFILE_COLORS`), chaque client les peint — avec ces deux teintes
 * profondes, en dégradé, sous une initiale blanche. Chaque paire tient 4,5:1
 * contre le blanc à son point le plus clair.
 */
export const FAMILY_PROFILE_COLOR_STOPS: Record<FamilyProfileColor, readonly [string, string]> = {
  violet: ["#6d28d9", "#7c3aed"],
  pink: ["#be185d", "#db2777"],
  blue: ["#1d4ed8", "#2563eb"],
  teal: ["#0f766e", "#0d9488"],
  green: ["#15803d", "#16a34a"],
  amber: ["#a16207", "#b45309"],
  orange: ["#c2410c", "#ea580c"],
  red: ["#b91c1c", "#dc2626"],
};

/** Les deux teintes d'un profil ; une couleur inconnue (serveur plus récent) prend le violet. */
export function profileColorStops(color: FamilyProfileColor): readonly [string, string] {
  return FAMILY_PROFILE_COLOR_STOPS[color] ?? FAMILY_PROFILE_COLOR_STOPS.violet;
}
