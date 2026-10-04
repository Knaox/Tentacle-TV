import {
  FAMILY_DECLINE_COOLDOWN_MS,
  FAMILY_GUEST_NAME_MAX,
  FAMILY_GUESTS_PER_DAY,
  FAMILY_INVITES_PER_DAY,
  FAMILY_MAX_GUESTS,
  FAMILY_MAX_PENDING_PER_INVITEE,
  FAMILY_MAX_PROFILES,
  FAMILY_PICKER_MIN_PROFILES,
  FAMILY_PIN_LOCK_STEPS_MS,
  FAMILY_PIN_MAX_FAILURES,
  FAMILY_PROFILE_COLORS,
  type FamilyCandidateDto,
  type FamilyProfileColor,
  type FamilyProfileKind,
  type FamilySwitches,
} from "./familyContract";
import type { FamilyErrorCode, FamilyInvitationStatus } from "./familyProtocol";
import { normalizeSearch } from "../utils/textSearch";

/**
 * La Famille — les règles PURES, appliquées par le serveur et lisibles par
 * les clients (aucune n'y est jamais décidée à la place du serveur).
 *
 * MIROIR : `apps/backend/src/family/familyRules.ts`, octet pour octet (voir
 * l'en-tête de `familyContract.ts`). Ni horloge ni base : `now` entre en
 * argument.
 */

/** Deux identifiants Jellyfin, avec ou sans tirets, en toute casse. */
export function sameUserId(a: string, b: string): boolean {
  const fold = (id: string) => id.replace(/-/g, "").toLowerCase();
  return fold(a) === fold(b);
}

// ── Code PIN ────────────────────────────────────────────────────────────────

/** Exactement quatre chiffres ASCII. */
export function isValidPin(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{4}$/.test(value);
}

/** Les essais ratés d'un profil sur une TV. `lockedUntil` en ms. */
export interface PinAttemptState {
  failures: number;
  lockCount: number;
  lockedUntil: number | null;
}

export type PinGate = { locked: true; until: number } | { locked: false; attemptsLeft: number };

/** Peut-on essayer un PIN maintenant ? */
export function pinGate(state: PinAttemptState | null, now: number): PinGate {
  if (state?.lockedUntil != null && state.lockedUntil > now) return { locked: true, until: state.lockedUntil };
  const failures = state?.lockedUntil != null ? 0 : state?.failures ?? 0;
  return { locked: false, attemptsLeft: Math.max(0, FAMILY_PIN_MAX_FAILURES - failures) };
}

/** La durée du blocage n° `lockCount` (le premier vaut 0) : croissante, le dernier pas se répète. */
export function pinLockDuration(lockCount: number): number {
  const steps = FAMILY_PIN_LOCK_STEPS_MS;
  return steps[Math.min(Math.max(0, lockCount), steps.length - 1)];
}

/** Un essai raté : l'état suivant, et le blocage qu'il déclenche. Un blocage
 *  échu repart de zéro essai, mais garde son rang (le suivant dure plus). */
export function afterPinFailure(
  state: PinAttemptState | null,
  now: number,
): { state: PinAttemptState; lockedUntil: number | null; attemptsLeft: number } {
  const expiredLock = state?.lockedUntil != null && state.lockedUntil <= now;
  const failures = (expiredLock ? 0 : state?.failures ?? 0) + 1;
  const lockCount = state?.lockCount ?? 0;
  if (failures >= FAMILY_PIN_MAX_FAILURES) {
    const lockedUntil = now + pinLockDuration(lockCount);
    return { state: { failures: 0, lockCount: lockCount + 1, lockedUntil }, lockedUntil, attemptsLeft: 0 };
  }
  return {
    state: { failures, lockCount, lockedUntil: null },
    lockedUntil: null,
    attemptsLeft: FAMILY_PIN_MAX_FAILURES - failures,
  };
}

// ── Capacité ────────────────────────────────────────────────────────────────

export interface FamilyCounts {
  members: number;
  guests: number;
  /** Invitations en attente : elles réservent leur place. */
  pendingInvitations: number;
}

/** Ajouter un profil de cette sorte (invitation ou invité) : refusé pourquoi ? */
export function capacityError(kind: "member" | "guest", counts: FamilyCounts): FamilyErrorCode | null {
  const taken = 1 + counts.members + counts.guests + counts.pendingInvitations;
  if (taken + 1 > FAMILY_MAX_PROFILES) return "family.full";
  if (kind === "guest" && counts.guests + 1 > FAMILY_MAX_GUESTS) return "family.guests_full";
  return null;
}

/** Accepter une invitation : sa place est déjà réservée — seuls comptent les
 *  profils présents (une course entre deux acceptations reste bornée). */
export function canAcceptInvitation(counts: Pick<FamilyCounts, "members" | "guests">): boolean {
  return 1 + counts.members + counts.guests + 1 <= FAMILY_MAX_PROFILES;
}

// ── Invitations ─────────────────────────────────────────────────────────────

/** L'état réel d'une invitation : en attente au-delà de sa date, elle a expiré. */
export function effectiveInvitationStatus(
  invitation: { status: FamilyInvitationStatus; expiresAt: number },
  now: number,
): FamilyInvitationStatus {
  return invitation.status === "pending" && invitation.expiresAt <= now ? "expired" : invitation.status;
}

export interface InviteHistory {
  /** Une invitation de cette famille attend déjà ce compte. */
  pendingForInvitee: boolean;
  /** Dernier refus de ce compte à ce propriétaire (ms), ou null. */
  lastDeclinedAt: number | null;
  /** Dates (ms) des invitations envoyées par ce propriétaire sur les dernières 24 h. */
  sentInLastDay: number[];
  /** Invitations en attente pour ce compte, toutes familles confondues. */
  inviteePendingTotal: number;
}

export type InviteBlock = { code: FamilyErrorCode; retryAt?: number } | null;

/** Les gardes anti-abus d'une invitation, dans l'ordre où elles se disent. */
export function inviteBlock(history: InviteHistory, now: number): InviteBlock {
  if (history.pendingForInvitee) return { code: "family.invite_pending" };
  if (history.lastDeclinedAt !== null && now - history.lastDeclinedAt < FAMILY_DECLINE_COOLDOWN_MS) {
    return { code: "family.invite_cooldown", retryAt: history.lastDeclinedAt + FAMILY_DECLINE_COOLDOWN_MS };
  }
  const recent = history.sentInLastDay.filter((at) => now - at < 24 * 3_600_000).sort((a, b) => a - b);
  if (recent.length >= FAMILY_INVITES_PER_DAY) return { code: "family.invite_quota", retryAt: recent[0] + 24 * 3_600_000 };
  if (history.inviteePendingTotal >= FAMILY_MAX_PENDING_PER_INVITEE) return { code: "family.invite_quota" };
  return null;
}

/** Créer un invité, c'est créer un compte Jellyfin : pas plus de
 *  `FAMILY_GUESTS_PER_DAY` par propriétaire sur 24 heures glissantes. */
export function guestQuotaBlock(createdInLastDay: number[], now: number): InviteBlock {
  const recent = createdInLastDay.filter((at) => now - at < 24 * 3_600_000).sort((a, b) => a - b);
  if (recent.length < FAMILY_GUESTS_PER_DAY) return null;
  return { code: "family.guest_quota", retryAt: recent[0] + 24 * 3_600_000 };
}

// ── Noms et couleurs ────────────────────────────────────────────────────────
// ⚠️ Aucune classe Unicode (`\p{L}`) : ce module tourne aussi sous Hermes.

/** Caractères de contrôle (C0, DEL, C1) et marques invisibles ou de sens d'écriture. */
function isInvisible(code: number): boolean {
  return (
    code < 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x2028 && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x206f) ||
    code === 0xfeff
  );
}

/** Le nom d'un invité tel que la Famille le montre : sans caractère de
 *  contrôle, espaces resserrés, vingt caractères au plus ; null s'il n'en reste rien. */
export function normalizeGuestName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const visible = Array.from(raw.normalize("NFC")).filter((char) => !isInvisible(char.codePointAt(0) ?? 0));
  const cleaned = visible.join("").replace(/\s+/g, " ").trim();
  const name = Array.from(cleaned).slice(0, FAMILY_GUEST_NAME_MAX).join("").trim();
  return name.length > 0 ? name : null;
}

/** Un nom de compte que TOUT Jellyfin accepte (`ThrowIfInvalidUsername`) :
 *  accents pliés, puis ASCII seulement — lettres, chiffres, espace, `-'._@+`. */
function jellyfinAsciiName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 \-'._@+]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const GUEST_LABEL = { fr: "invite de", en: "guest of" } as const;

/** Le nom du compte Jellyfin d'un invité : unique et reconnaissable par un
 *  administrateur (« Lea - invite de Damien »). `attempt` > 1 : un homonyme
 *  existe déjà, un rang le départage. Le nom affiché par Tentacle reste
 *  celui de la Famille (`normalizeGuestName`). */
export function guestAccountName(guestName: string, ownerName: string, lang: "fr" | "en", attempt = 1): string {
  const guest = jellyfinAsciiName(guestName).slice(0, 20).trim() || (lang === "fr" ? "Invite" : "Guest");
  const owner = jellyfinAsciiName(ownerName).slice(0, 30).trim() || "Tentacle";
  const base = `${guest} - ${GUEST_LABEL[lang]} ${owner}`;
  return attempt > 1 ? `${base} ${attempt}` : base;
}

export function isProfileColor(value: unknown): value is FamilyProfileColor {
  return typeof value === "string" && (FAMILY_PROFILE_COLORS as readonly string[]).includes(value);
}

/** La couleur d'un profil qui n'en a pas choisi : stable, tirée de son identifiant. */
export function defaultProfileColor(userId: string): FamilyProfileColor {
  let hash = 0;
  for (const char of userId.replace(/-/g, "").toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FAMILY_PROFILE_COLORS[hash % FAMILY_PROFILE_COLORS.length];
}

// ── Candidats ───────────────────────────────────────────────────────────────

export interface CandidateSource {
  id: string;
  name: string;
  isHidden: boolean;
  isDisabled: boolean;
  imageTag: string | null;
}

/**
 * Les comptes qu'un propriétaire peut inviter : ceux de l'écran de connexion
 * de Jellyfin (filtrés par `query`), un compte CACHÉ seulement si `query` est
 * son nom exact (casse indifférente). Jamais un compte désactivé, ni un
 * identifiant de `exclude` (soi-même, membres, invités, invitations en
 * attente, compte de démonstration). Rien ne distingue un compte caché
 * inconnu d'un nom qui n'existe pas.
 */
export function selectCandidates(
  users: CandidateSource[],
  options: { query: string; exclude: string[]; limit: number },
): FamilyCandidateDto[] {
  const excluded = new Set(options.exclude.map((id) => id.replace(/-/g, "").toLowerCase()));
  const query = normalizeSearch(options.query);
  const exact = options.query.trim().toLowerCase();
  return users
    .filter((user) => !user.isDisabled && !excluded.has(user.id.replace(/-/g, "").toLowerCase()))
    .filter((user) =>
      user.isHidden
        ? exact.length > 0 && user.name.trim().toLowerCase() === exact
        : query.length === 0 || normalizeSearch(user.name).includes(query),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, options.limit)
    .map((user) => ({ userId: user.id, name: user.name, imageTag: user.imageTag }));
}

// ── La TV ───────────────────────────────────────────────────────────────────

/** Ce que les interrupteurs laissent paraître sur une TV : le propriétaire
 *  toujours, les membres si la Famille est active, les invités si les deux le sont. */
export function isProfileKindAllowed(kind: FamilyProfileKind, switches: FamilySwitches): boolean {
  if (kind === "owner") return true;
  if (!switches.families) return false;
  return kind === "member" || switches.guests;
}

/** « Qui regarde ? » dès deux profils. */
export function isPickerRequired(profileCount: number): boolean {
  return profileCount >= FAMILY_PICKER_MIN_PROFILES;
}
