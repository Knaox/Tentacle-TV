import {
  FAMILY_MAX_GUESTS,
  FAMILY_MAX_PROFILES,
  type FamilyCapability,
  type FamilyOverviewDto,
  type IncomingInvitationDto,
  type OwnedFamilyDto,
  type FamilyProfileColor,
} from "./familyContract";
import { capacityError } from "./familyRules";
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

/** Les places prises : le propriétaire, ses membres, ses invités, et les
 *  invitations en attente (elles réservent leur place). */
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

/** Ce que le propriétaire (ou futur propriétaire) peut ajouter maintenant. */
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
