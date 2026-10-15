import type { ServerCapability } from "@tentacle-tv/shared";

/**
 * Le contrat des droits d'un compte, tel que l'interface le lit — PROVISOIRE :
 * recopie du § 3 de `docs/DROITS-UTILISATEURS.md`, en attendant que le socle
 * pose `@tentacle-tv/shared` › `userRights/`. Ce fichier deviendra alors une
 * simple réexportation ; rien d'autre ne déclare ces types.
 *
 * Les clés traversent le réseau : elles ne se renomment jamais.
 */

/** Les capacités du lot, absentes de la liste fermée jusqu'à l'arrivée du socle. */
export const USER_RIGHTS_CAPABILITY = "admin.userRights" as ServerCapability;
export const FAMILY_PARENTAL_CAPABILITY = "family.parentalControls" as ServerCapability;

export type UserRightsGroup = "account" | "libraries" | "parental" | "playback" | "offline" | "management";

/** Le jour d'une plage horaire, dans les mots de Jellyfin (`DynamicDayOfWeek`). */
export type ScheduleDay =
  | "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday"
  | "Everyday" | "Weekday" | "Weekend";

/** Une plage horaire PERMISE : en dehors, Jellyfin refuse la connexion. Heures décimales (0 à 24). */
export interface AccessSchedule {
  dayOfWeek: ScheduleDay;
  startHour: number;
  endHour: number;
}

export type SyncPlayAccess = "CreateAndJoinGroups" | "JoinGroups" | "None";

export interface UserRights {
  // Compte
  isAdministrator: boolean;
  isDisabled: boolean;
  isHidden: boolean;
  enableRemoteAccess: boolean;
  /** 0 : sans limite. */
  maxActiveSessions: number;
  /** 0 : la valeur par défaut de Jellyfin ; -1 : jamais bloqué. */
  loginAttemptsBeforeLockout: number;
  // Bibliothèques
  enableAllFolders: boolean;
  enabledFolders: string[];
  enableAllChannels: boolean;
  enabledChannels: string[];
  // Contrôle parental
  /** Le score Jellyfin de la note maximale ; null : aucune limite. */
  maxParentalRating: number | null;
  maxParentalSubRating: number | null;
  /** Les types (`UnratedItem`) bloqués quand ils n'ont pas de note. */
  blockUnratedItems: string[];
  blockedTags: string[];
  allowedTags: string[];
  accessSchedules: AccessSchedule[];
  // Lecture
  enableMediaPlayback: boolean;
  enableAudioPlaybackTranscoding: boolean;
  enableVideoPlaybackTranscoding: boolean;
  enablePlaybackRemuxing: boolean;
  forceRemoteSourceTranscoding: boolean;
  /** En bits par seconde ; 0 : sans limite. */
  remoteClientBitrateLimit: number;
  syncPlayAccess: SyncPlayAccess;
  // Hors ligne
  enableContentDownloading: boolean;
  enableMediaConversion: boolean;
  // Gestion
  enableContentDeletion: boolean;
  enableContentDeletionFromFolders: string[];
  enableCollectionManagement: boolean;
  enableSubtitleManagement: boolean;
  enableLyricManagement: boolean;
  enableLiveTvAccess: boolean;
  enableLiveTvManagement: boolean;
  enableRemoteControlOfOtherUsers: boolean;
  enableSharedDeviceControl: boolean;
  enablePublicSharing: boolean;
}

export type UserRightKey = keyof UserRights;

export interface UserRightsDto {
  userId: string;
  name: string;
  rights: UserRights;
  readAt: string;
}

/** Un sous-ensemble des droits — au moins un champ. */
export type UserRightsPatch = Partial<UserRights>;

export interface ParentalRatingOption {
  name: string;
  score: number;
  subScore: number | null;
}

export interface UserRightsOptions {
  libraries: { id: string; name: string; collectionType: string | null }[];
  channels: { id: string; name: string }[];
  parentalRatings: ParentalRatingOption[];
  unratedItemTypes: string[];
  knownTags: string[];
}

export type UserRightsRefusal =
  | "unknown_user"
  | "family_guest"
  | "last_admin"
  | "self_lockout"
  | "invalid_value"
  | "jellyfin_unreachable"
  | "jellyfin_refused";

export const USER_RIGHTS_REFUSALS: readonly UserRightsRefusal[] = [
  "unknown_user", "family_guest", "last_admin", "self_lockout", "invalid_value", "jellyfin_unreachable", "jellyfin_refused",
];

export const USER_RIGHTS_PATHS = {
  options: "/api/admin/users/rights/options",
  user: (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}/rights`,
} as const;

/** Le contrôle parental d'un invité de la Famille (§ 4) : la valeur VOULUE par son créateur. */
export interface GuestParentalControls {
  maxParentalRating: number | null;
  maxParentalSubRating: number | null;
  blockUnratedItems: string[];
  blockedTags: string[];
  accessSchedules: AccessSchedule[];
}

/** Ce que la Famille sait de l'échelle et des types, sans droits d'administration. */
export type FamilyParentalOptions = Pick<UserRightsOptions, "parentalRatings" | "unratedItemTypes" | "knownTags">;

export const FAMILY_PARENTAL_PATHS = {
  options: "/api/family/parental/options",
  guest: (userId: string) => `/api/family/guests/${encodeURIComponent(userId)}/parental`,
} as const;

/** Les restrictions du CRÉATEUR d'un invité : son contrôle parental ne va jamais au-delà. */
export interface ParentalCeiling extends GuestParentalControls {
  allowedTags: string[];
}

/** Les champs additifs d'un invité dans le DTO de la Famille (provisoires, § 4). */
export interface FamilyGuestParentalFields {
  parental?: GuestParentalControls | null;
  parentalCeiling?: ParentalCeiling | null;
}
