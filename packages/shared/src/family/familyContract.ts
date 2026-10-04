/**
 * La Famille — le CONTRAT (v2) entre le serveur et les clients : limites,
 * réponses et corps. La TV : `familyTvContract.ts` ; codes d'erreur, temps
 * réel et notifications : `familyProtocol.ts` ; routes et appelants :
 * `familyRoutes.ts` ; règles pures : `familyRules.ts` et `familyRights.ts`.
 * Carnet complet : docs/FAMILLE.md.
 *
 * MIROIR : `apps/backend/src/family/` en porte la copie octet pour octet (le
 * backend ne dépend pas de `@tentacle-tv/shared`). On modifie ICI, on recopie
 * là-bas :
 *
 *   cp packages/shared/src/family/family{Contract,TvContract,Protocol,Routes,Rules,Rights}.ts apps/backend/src/family/
 *
 * UNE famille par compte, PARTAGÉE par tous ses membres (v2). Trois rôles :
 * - le PROPRIÉTAIRE l'a créée : il invite, annule une invitation, retire un
 *   membre, règle les droits des membres et dissout — il ne la quitte pas ;
 * - le MEMBRE, un compte existant qui a accepté une invitation : il voit toute
 *   la famille, ses TV la montrent, il crée des invités si le propriétaire le
 *   lui permet, et ne gère que ceux-là ;
 * - l'INVITÉ, un vrai compte Jellyfin créé par le serveur, caché, au mot de
 *   passe jeté : seules les TV de la famille l'ouvrent.
 * Un compte n'appartient qu'à UNE famille, propriétaire OU membre : la base
 * l'impose. Tout se décide côté serveur, à l'identique en HTTP et en HTTPS :
 * aucun jeton ni PIN dans une URL.
 */

/** Version du contrat, rendue par `/api/config` et chaque réponse de la Famille.
 *  2 : famille partagée, une famille par compte, droits des membres. */
export const FAMILY_CONTRACT_VERSION = 2;

/** Profils d'une famille, propriétaire compris (invitations en attente comptées). */
export const FAMILY_MAX_PROFILES = 6;
/** Invités d'une famille, au plus — tous créateurs confondus. */
export const FAMILY_MAX_GUESTS = 3;
/** Une invitation vaut sept jours. */
export const FAMILY_INVITATION_TTL_MS = 7 * 24 * 3_600_000;
/** Après un refus, le même propriétaire ne réinvite pas ce compte avant sept jours. */
export const FAMILY_DECLINE_COOLDOWN_MS = 7 * 24 * 3_600_000;
/** Invitations envoyées par un propriétaire sur 24 heures glissantes. */
export const FAMILY_INVITES_PER_DAY = 10;
/** Invitations en attente pour un même destinataire, toutes familles confondues
 *  (en accepter une clôt les autres : une famille par compte). */
export const FAMILY_MAX_PENDING_PER_INVITEE = 10;
/** Invités créés dans une famille sur 24 heures glissantes, tous créateurs
 *  confondus (chacun est un compte Jellyfin : pas de création en rafale). */
export const FAMILY_GUESTS_PER_DAY = 6;
/** « Plus tard » : l'affiche ne revient pas avant ce délai (la cloche la garde). */
export const FAMILY_SNOOZE_MS = 24 * 3_600_000;
/** Le code PIN : exactement quatre chiffres. */
export const FAMILY_PIN_LENGTH = 4;
/** Essais ratés avant blocage, par profil — toutes TV confondues. */
export const FAMILY_PIN_MAX_FAILURES = 5;
/** Durées des blocages successifs (le dernier se répète) ; une réussite remet à zéro. */
export const FAMILY_PIN_LOCK_STEPS_MS = [15 * 60_000, 3_600_000, 4 * 3_600_000, 24 * 3_600_000] as const;
/** « Gérer les profils » sur la TV : ouvert par le PIN de qui gère (le
 *  propriétaire ou un membre, chacun avec SES droits), pour dix minutes. */
export const FAMILY_MANAGE_UNLOCK_MS = 10 * 60_000;
/** Le nom d'un invité, une fois nettoyé. */
export const FAMILY_GUEST_NAME_MAX = 20;
/** Le sélecteur « Qui regarde ? » de la TV s'affiche dès deux profils. */
export const FAMILY_PICKER_MIN_PROFILES = 2;

/** Les couleurs d'un profil — des NOMS de jetons, chaque client les peint. */
export const FAMILY_PROFILE_COLORS = ["violet", "pink", "blue", "teal", "green", "amber", "orange", "red"] as const;
export type FamilyProfileColor = (typeof FAMILY_PROFILE_COLORS)[number];

export type FamilyProfileKind = "owner" | "member" | "guest";

/** Le rôle d'un compte dans SA famille (il n'en a qu'une). */
export type FamilyRole = "owner" | "member";

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

/** Les droits que le propriétaire donne à UN membre — tous COUPÉS par défaut,
 *  réglables depuis le web, le bureau, le mobile et la TV. Retirer un droit
 *  ne supprime rien : le membre ne peut plus, c'est tout. */
export interface FamilyMemberRights {
  /** Créer des invités, dans la limite de la famille (trois, tous créateurs
   *  confondus) — et gérer ceux qu'il a créés. */
  createGuests: boolean;
}

export const FAMILY_DEFAULT_MEMBER_RIGHTS: Readonly<FamilyMemberRights> = { createGuests: false };

/**
 * Ce que PEUT un compte dans sa famille, d'après son rôle (`familyRightsOf`).
 * Le serveur le revérifie à chaque geste ; un client s'en sert pour ne pas
 * offrir un geste voué au refus.
 */
export interface FamilyRights {
  /** Le propriétaire : inviter, annuler une invitation, retirer un membre,
   *  régler les droits des membres, dissoudre. */
  manageMembers: boolean;
  /** Créer un invité : le propriétaire, ou un membre à qui il l'a permis — si
   *  l'administration laisse la Famille et les invités allumés. La place
   *  (`limits`) se juge à part. */
  createGuests: boolean;
  /** Supprimer un invité et poser son PIN : `all` (le propriétaire), `own` (un
   *  membre : les invités qu'il a créés, même si on lui a retiré le droit d'en
   *  créer), `none`. Règle : `canManageGuest`. */
  manageGuests: "all" | "own" | "none";
}

/** Un profil de la famille, tel que le web, le bureau, le mobile et la
 *  gestion des profils de la TV le montrent. */
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
  /** Un invité : le compte qui l'a créé (le propriétaire, ou un membre) ; null sinon. */
  createdBy: string | null;
  /** Le nom de ce créateur (« ajouté par … »), même s'il a quitté la famille ; null sinon. */
  createdByName: string | null;
  /** Un membre : ce que le propriétaire lui permet ; null pour le propriétaire et les invités. */
  rights: FamilyMemberRights | null;
}

export interface OutgoingInvitationDto {
  id: string;
  inviteeUserId: string;
  inviteeName: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * LA famille d'un compte — la MÊME pour son propriétaire et pour chacun de ses
 * membres : le propriétaire en tête, puis les membres, puis les invités.
 */
export interface FamilyDto {
  id: string;
  /** Le rôle de CE compte. */
  role: FamilyRole;
  owner: { userId: string; name: string };
  profiles: FamilyProfileDto[];
  /** Les invitations en attente : rendues au propriétaire seulement (vide pour un membre). */
  pendingInvitations: OutgoingInvitationDto[];
  /** Ce que CE compte peut y faire. */
  rights: FamilyRights;
  createdAt: string;
  /** L'arrivée de CE compte (ISO) ; null pour le propriétaire. */
  since: string | null;
}

/** @deprecated v1 — lire `FamilyOverviewDto.family` (rôle `owner`). Retiré
 *  quand les clients l'auront quitté. */
export interface OwnedFamilyDto {
  id: string;
  profiles: FamilyProfileDto[];
  pendingInvitations: OutgoingInvitationDto[];
  createdAt: string;
}

/** La famille qu'un compte vient de rejoindre (`acceptInvite`). */
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
  /** Ce compte peut posséder une famille : ni invité, ni compte de
   *  démonstration, ni MEMBRE d'une famille (un membre n'en crée pas). Vrai
   *  pour le propriétaire de la sienne. */
  canOwn: boolean;
  /** Ce compte peut être invité et accepter : ni invité, ni compte de
   *  démonstration, ni déjà dans une famille. */
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
  /** LA famille de ce compte, qu'il en soit propriétaire ou membre ; null s'il n'en a pas. */
  family: FamilyDto | null;
  /** @deprecated v1 — `family` quand `family.role === "owner"`. */
  owned: OwnedFamilyDto | null;
  /** @deprecated v1 — `family` quand `family.role === "member"` (une entrée au plus). */
  memberships: FamilyMembershipDto[];
  /** Vide hors session personnelle, et pour un compte déjà dans une famille :
   *  une TV ne montre jamais d'invitation. */
  incoming: IncomingInvitationDto[];
  limits: { maxProfiles: number; maxGuests: number };
}

/** `available` : invitable ; `in_family` : déjà dans une famille (n'importe
 *  laquelle) ; `invited` : une invitation de VOTRE famille l'attend déjà.
 *  Seul `available` s'invite. */
export type FamilyCandidateStatus = "available" | "in_family" | "invited";

export interface FamilyCandidateDto {
  userId: string;
  name: string;
  imageTag: string | null;
  status: FamilyCandidateStatus;
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

/** Le propriétaire règle les droits d'un membre : seuls les champs présents changent. */
export type SetMemberRightsBody = Partial<FamilyMemberRights>;

/** La dissolution exige ce mot, en toutes lettres. */
export interface DissolveBody {
  confirm: "dissolve";
}

/** Un geste sur une invitation : son identifiant voyage dans le CORPS, jamais
 *  dans l'URL (le serveur journalise ses URL). */
export interface InvitationActionBody {
  id: string;
}
