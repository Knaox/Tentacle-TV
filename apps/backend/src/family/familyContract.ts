/**
 * La Famille — le CONTRAT (v1) entre le serveur et les clients : limites,
 * réponses et corps. Codes d'erreur, temps réel et notifications :
 * `familyProtocol.ts` ; routes et appelants : `familyRoutes.ts` ; règles
 * pures : `familyRules.ts`. Carnet complet : docs/FAMILLE.md.
 *
 * MIROIR : `apps/backend/src/family/familyContract.ts` en est la copie octet
 * pour octet (le backend ne dépend pas de `@tentacle-tv/shared`). On modifie
 * ICI, on recopie là-bas :
 *
 *   cp packages/shared/src/family/family{Contract,Protocol,Routes,Rules}.ts apps/backend/src/family/
 *
 * Trois rôles : le PROPRIÉTAIRE (tout compte du serveur sauf un invité, une
 * famille au plus), le MEMBRE (compte existant qui a accepté une invitation,
 * membre de plusieurs familles s'il le veut), l'INVITÉ (vrai compte Jellyfin
 * créé par le serveur, caché, au mot de passe jeté : seules les TV du
 * propriétaire l'ouvrent). Tout se décide côté serveur, à l'identique en HTTP
 * et en HTTPS : aucun jeton ni PIN dans une URL.
 */

/** Version du contrat, rendue par `/api/config` et chaque réponse de la Famille. */
export const FAMILY_CONTRACT_VERSION = 1;

/** Profils d'une famille, propriétaire compris (invitations en attente comptées). */
export const FAMILY_MAX_PROFILES = 6;
/** Invités d'une famille, au plus. */
export const FAMILY_MAX_GUESTS = 3;
/** Une invitation vaut sept jours. */
export const FAMILY_INVITATION_TTL_MS = 7 * 24 * 3_600_000;
/** Après un refus, le même propriétaire ne réinvite pas ce compte avant sept jours. */
export const FAMILY_DECLINE_COOLDOWN_MS = 7 * 24 * 3_600_000;
/** Invitations envoyées par un propriétaire sur 24 heures glissantes. */
export const FAMILY_INVITES_PER_DAY = 10;
/** Invitations en attente pour un même destinataire, toutes familles confondues. */
export const FAMILY_MAX_PENDING_PER_INVITEE = 10;
/** Invités créés par un propriétaire sur 24 heures glissantes (chacun est un
 *  compte Jellyfin : pas de création en rafale). */
export const FAMILY_GUESTS_PER_DAY = 6;
/** « Plus tard » : l'affiche ne revient pas avant ce délai (la cloche la garde). */
export const FAMILY_SNOOZE_MS = 24 * 3_600_000;
/** Le code PIN : exactement quatre chiffres. */
export const FAMILY_PIN_LENGTH = 4;
/** Essais ratés avant blocage, par profil — toutes TV confondues. */
export const FAMILY_PIN_MAX_FAILURES = 5;
/** Durées des blocages successifs (le dernier se répète) ; une réussite remet à zéro. */
export const FAMILY_PIN_LOCK_STEPS_MS = [15 * 60_000, 3_600_000, 4 * 3_600_000, 24 * 3_600_000] as const;
/** « Gérer les profils » sur la TV : ouvert par le PIN du propriétaire, pour dix minutes. */
export const FAMILY_MANAGE_UNLOCK_MS = 10 * 60_000;
/** Le nom d'un invité, une fois nettoyé. */
export const FAMILY_GUEST_NAME_MAX = 20;
/** Le sélecteur « Qui regarde ? » de la TV s'affiche dès deux profils. */
export const FAMILY_PICKER_MIN_PROFILES = 2;

/** Les couleurs d'un profil — des NOMS de jetons, chaque client les peint. */
export const FAMILY_PROFILE_COLORS = ["violet", "pink", "blue", "teal", "green", "amber", "orange", "red"] as const;
export type FamilyProfileColor = (typeof FAMILY_PROFILE_COLORS)[number];

export type FamilyProfileKind = "owner" | "member" | "guest";

/** Les deux interrupteurs de l'administration, ACTIVÉS par défaut. Couper
 *  « families » coupe membres ET invités ; « guests » les seuls invités. */
export interface FamilySwitches {
  families: boolean;
  guests: boolean;
}

/** `GET /api/config` → `features.family`. ABSENT : serveur d'avant la Famille
 *  (aucun minServer imposé — le client ne montre alors rien de la Famille). */
export interface FamilyCapability {
  v: number;
  enabled: boolean;
  guests: boolean;
}

/** Un profil de la famille, tel que le web, le bureau et le mobile le montrent. */
export interface FamilyProfileDto {
  /** L'identifiant du profil : son compte Jellyfin. */
  userId: string;
  kind: FamilyProfileKind;
  name: string;
  color: FamilyProfileColor;
  hasPin: boolean;
  /** L'avatar Jellyfin (`PrimaryImageTag`) ; null pour un invité. */
  imageTag: string | null;
  /** Arrivée dans la famille (ISO) ; null pour le propriétaire. */
  since: string | null;
}

export interface OutgoingInvitationDto {
  id: string;
  inviteeUserId: string;
  inviteeName: string;
  createdAt: string;
  expiresAt: string;
}

/** La famille que possède ce compte : le propriétaire en tête, puis les membres, puis les invités. */
export interface OwnedFamilyDto {
  id: string;
  profiles: FamilyProfileDto[];
  pendingInvitations: OutgoingInvitationDto[];
  createdAt: string;
}

/** Une famille dont ce compte est membre. */
export interface FamilyMembershipDto {
  familyId: string;
  ownerUserId: string;
  ownerName: string;
  since: string;
}

/** Une invitation reçue, en attente. */
export interface IncomingInvitationDto {
  id: string;
  familyId: string;
  ownerUserId: string;
  ownerName: string;
  createdAt: string;
  expiresAt: string;
  /** « Plus tard » : l'affiche ne revient pas avant (ISO) ; null sinon. */
  snoozedUntil: string | null;
}

export interface FamilyAccountDto {
  /** Ce compte peut posséder une famille (jamais un invité). */
  canOwn: boolean;
  /** Ce compte peut être invité et accepter (ni un invité, ni le compte de démonstration). */
  canJoin: boolean;
  /** Compte de démonstration de la revue Apple : il ne crée RIEN — ni
   *  famille, ni invité, ni invitation (`family.review_account`). */
  reviewAccount: boolean;
  /** Ce compte a posé un PIN pour lui-même. */
  hasPin: boolean;
  /** La session de la requête peut faire les gestes PERSONNELS (accepter,
   *  refuser, quitter, son PIN, dissoudre) : web, bureau, mobile seulement. */
  personalSession: boolean;
}

/** `GET /api/family` — l'état de la Famille pour ce compte. */
export interface FamilyOverviewDto {
  v: number;
  switches: FamilySwitches;
  account: FamilyAccountDto;
  owned: OwnedFamilyDto | null;
  memberships: FamilyMembershipDto[];
  /** Vide hors session personnelle : une TV ne montre jamais d'invitation. */
  incoming: IncomingInvitationDto[];
  limits: { maxProfiles: number; maxGuests: number };
}

export interface FamilyCandidateDto {
  userId: string;
  name: string;
  imageTag: string | null;
}

// ── Corps des requêtes ──────────────────────────────────────────────────────

export interface CreateGuestBody {
  name: string;
  color: FamilyProfileColor;
}

/** `null` retire le PIN. Poser, changer ou retirer un PIN coupe le profil sur les TV. */
export interface SetPinBody {
  pin: string | null;
}

export interface InviteBody {
  userId: string;
}

/** La dissolution exige ce mot, en toutes lettres. */
export interface DissolveBody {
  confirm: "dissolve";
}

/** Un geste sur une invitation : son identifiant voyage dans le CORPS, jamais
 *  dans l'URL (le serveur journalise ses URL). */
export interface InvitationActionBody {
  id: string;
}

// ── La TV (Apple TV seulement) ──────────────────────────────────────────────

/** `POST /api/family/tv/enroll` : le jeton de jumelage « profils seuls » qui
 *  REMPLACE celui de la TV. L'ancien ne vaut plus rien ailleurs. */
export interface TvEnrollResponse {
  pairingToken: string;
}

export interface TvProfileDto {
  userId: string;
  kind: FamilyProfileKind;
  name: string;
  color: FamilyProfileColor;
  hasPin: boolean;
  imageTag: string | null;
  /** Trop d'essais ratés (toutes TV confondues) : bloqué jusqu'à (ISO). */
  lockedUntil: string | null;
}

/** `GET /api/family/tv/profiles` — « Qui regarde ? ». */
export interface TvProfilesDto {
  v: number;
  switches: FamilySwitches;
  /** Le propriétaire de la TV (le compte qui l'a jumelée), en tête de `profiles`. */
  owner: { userId: string; name: string };
  profiles: TvProfileDto[];
  /** « Rester sur ce profil » : la TV l'ouvre au lancement, sans PIN. */
  stickyProfileId: string | null;
  /** Vrai dès deux profils : sinon la TV ouvre directement le seul. */
  pickerRequired: boolean;
  /** « Gérer les profils » existe sur cette TV (faux pour le compte de
   *  démonstration, qui ne crée rien : la TV n'en montre pas l'entrée). */
  canManage: boolean;
}

export interface OpenTvSessionBody {
  profileId: string;
  /** Quatre chiffres, si le profil en a un (sauf profil « Rester » de cette TV). */
  pin?: string;
  /** « Rester sur ce profil » : vrai le pose, faux l'ôte (absent : faux). */
  remember?: boolean;
}

/** Une session de profil : un jeton d'appareil comme ceux du jumelage, au nom
 *  du profil, qui ne vaut que sur cette TV et cesse à tout retrait. */
export interface TvSessionDto {
  token: string;
  user: { id: string; name: string };
  profile: TvProfileDto;
  remembered: boolean;
}

export interface ManageUnlockBody {
  pin?: string;
}

export interface ManageUnlockResponse {
  unlockedUntil: string;
}
