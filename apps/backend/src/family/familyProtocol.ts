/**
 * La Famille — le PROTOCOLE : les refus du serveur (un code par cas), le
 * temps réel et les notifications. Données et corps : `familyContract.ts`.
 *
 * MIROIR : `apps/backend/src/family/familyProtocol.ts`, octet pour octet (voir
 * l'en-tête de `familyContract.ts`).
 */

// ── Erreurs ─────────────────────────────────────────────────────────────────

/** Chaque refus porte un code (et un message français, pour les journaux) :
 *  le client traduit le CODE (`family:errors.<code sans préfixe>`). */
export const FAMILY_ERROR_STATUS = {
  "family.invalid_input": 400,
  "family.pin_format": 400,
  "family.candidate_invalid": 400,
  "family.pairing_required": 401,
  "family.disabled": 403,
  "family.guests_disabled": 403,
  "family.personal_session_required": 403,
  "family.not_owner": 403,
  "family.manage_locked": 403,
  "family.guest_account": 403,
  "family.review_account": 403,
  "family.pin_required": 403,
  "family.pin_invalid": 403,
  "family.not_found": 404,
  "family.full": 409,
  "family.guests_full": 409,
  "family.already_member": 409,
  "family.invite_pending": 409,
  "family.invite_closed": 409,
  "family.enroll_required": 409,
  "family.profile_unavailable": 409,
  "family.pin_locked": 423,
  "family.invite_cooldown": 429,
  "family.invite_quota": 429,
  "family.jellyfin_refused": 502,
  "family.jellyfin_unavailable": 503,
} as const;

export type FamilyErrorCode = keyof typeof FAMILY_ERROR_STATUS;

export interface FamilyErrorBody {
  code: FamilyErrorCode;
  message: string;
  /** `family.pin_invalid` : essais restants avant blocage. */
  attemptsLeft?: number;
  /** `family.pin_locked` : fin du blocage (ISO). */
  lockedUntil?: string;
  /** `family.invite_cooldown`, `family.invite_quota` : nouvel essai possible (ISO). */
  retryAt?: string;
  /** `family.invite_closed` : l'état de l'invitation. */
  status?: FamilyInvitationStatus;
  /** `family.pairing_required` : le jumelage n'existe plus — la TV se déjumelle. */
  revoked?: true;
}

export type FamilyInvitationStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

// ── Temps réel ──────────────────────────────────────────────────────────────

/** `owned` : la famille possédée ; `memberships` : celles dont on est membre ;
 *  `invitations` : les invitations reçues (l'affiche se montre en direct). */
export type FamilyUpdateScope = "owned" | "memberships" | "invitations";

/** Pourquoi une session de profil a cessé (poussé sur ses sockets, puis fermeture 4010). */
export type FamilyProfileEndReason =
  | "closed"
  | "replaced"
  | "removed"
  | "left"
  | "guest_deleted"
  | "pin_changed"
  | "dissolved"
  | "families_disabled"
  | "guests_disabled"
  | "unpaired"
  | "account_deleted";

export type FamilyWsMessage =
  | { type: "family:update"; scope: FamilyUpdateScope }
  | { type: "family:profile-ended"; reason: FamilyProfileEndReason };

/** Code de fermeture du socket d'une session de profil terminée. */
export const FAMILY_PROFILE_ENDED_CLOSE_CODE = 4010;

/** Ce que répond une porte (REST, proxy, rafraîchissement, socket) au jeton
 *  d'une session de profil TERMINÉE : la TV revient à « Qui regarde ? » — elle
 *  ne se déjumelle PAS (seul son jeton de jumelage révoqué l'y autorise :
 *  `family.pairing_required` + `revoked`). */
export interface FamilyProfileEndedReply {
  message: string;
  revoked: true;
  profileEnded: true;
}

// ── Notifications ───────────────────────────────────────────────────────────

/** Types de la cloche. La ligne garde des DONNÉES, jamais une phrase :
 *  `title` = le nom de l'autre (le propriétaire pour `family_invite`,
 *  `family_member_removed` et `family_dissolved` ; l'invité ou le membre
 *  sinon) ; `refId` = l'invitation (`family_invite*`) ou la famille. Seule
 *  `family_invite` part aussi en push (préférence `family`). */
export const FAMILY_NOTIFICATION_TYPES = [
  "family_invite",
  "family_invite_accepted",
  "family_invite_declined",
  "family_member_left",
  "family_member_removed",
  "family_dissolved",
] as const;
export type FamilyNotificationType = (typeof FAMILY_NOTIFICATION_TYPES)[number];

/** La préférence push de la Famille (`/api/push/preferences`), ACTIVÉE par défaut. */
export const FAMILY_PUSH_PREF_KEY = "family";
