/**
 * Les DROITS d'un compte — le contrat entre le serveur et l'administration
 * (web, bureau). Carnet : docs/DROITS-UTILISATEURS.md.
 *
 * Jellyfin est la SOURCE UNIQUE : chaque droit est un champ de la `UserPolicy`
 * Jellyfin du compte. Tentacle n'en garde aucune copie ; il relit la politique,
 * n'y change que les champs demandés, la réécrit, la relit.
 *
 * MIROIR : `apps/backend/src/userRights/` en porte la copie octet pour octet (le
 * backend ne dépend pas de `@tentacle-tv/shared`). On modifie ICI, on recopie :
 *
 *   cp packages/shared/src/userRights/userRights{Contract,Routes,Patch}.ts apps/backend/src/userRights/
 *
 * ⚠️ Les clés traversent le réseau : elles ne se renomment jamais une fois livrées.
 * Champs vérifiés contre l'OpenAPI de Jellyfin 10.11.0 et 10.11.11 (`UserPolicy`,
 * identique en 12.2) : aucun champ de cette liste n'y manque.
 */

/** Les jours d'une plage horaire (`DynamicDayOfWeek` de Jellyfin). */
export const ACCESS_SCHEDULE_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Everyday",
  "Weekday",
  "Weekend",
] as const;
export type AccessScheduleDay = (typeof ACCESS_SCHEDULE_DAYS)[number];

/** Une plage horaire PERMISE (`AccessSchedule`) : heures décimales, 0 à 24. */
export interface AccessScheduleDto {
  dayOfWeek: AccessScheduleDay;
  startHour: number;
  endHour: number;
}

/** Les types de titres SANS classification que Jellyfin sait bloquer (`UnratedItem`). */
export const UNRATED_ITEM_TYPES = [
  "Movie",
  "Trailer",
  "Series",
  "Music",
  "Book",
  "LiveTvChannel",
  "LiveTvProgram",
  "ChannelContent",
  "Other",
] as const;
export type UnratedItemType = (typeof UNRATED_ITEM_TYPES)[number];

/** `SyncPlayUserAccessType`. */
export const SYNC_PLAY_ACCESS = ["CreateAndJoinGroups", "JoinGroups", "None"] as const;
export type SyncPlayAccess = (typeof SYNC_PLAY_ACCESS)[number];

export type UserRightsGroup = "account" | "libraries" | "parental" | "playback" | "offline" | "management";

export const USER_RIGHTS_GROUPS: readonly UserRightsGroup[] = ["account", "libraries", "parental", "playback", "offline", "management"];

export type UserRightsKind = "boolean" | "integer" | "stringList" | "folderList" | "unratedList" | "schedules" | "enum";

/** La description d'UN droit : son champ Jellyfin, son groupe, sa forme. */
export interface UserRightsFieldSpec {
  jellyfin: string;
  group: UserRightsGroup;
  kind: UserRightsKind;
  /** `integer` : bornes ; `nullable` : `null` = « sans limite » (Jellyfin rend `null`). */
  min?: number;
  max?: number;
  nullable?: boolean;
  /** `folderList` : la liste dans laquelle chaque identifiant doit exister. */
  among?: "libraries" | "channels";
  /** `enum` : les valeurs permises. */
  values?: readonly string[];
}

/** Tous les droits, d'un bloc. `rights` d'un `UserRightsDto` les porte TOUS. */
export interface UserRights {
  // account
  isAdministrator: boolean;
  isDisabled: boolean;
  isHidden: boolean;
  enableRemoteAccess: boolean;
  /** 0 : sans limite. */
  maxActiveSessions: number;
  /** 0 : la valeur de Jellyfin (3, 5 pour un administrateur) ; -1 : jamais bloqué. */
  loginAttemptsBeforeLockout: number;
  // libraries
  enableAllFolders: boolean;
  enabledFolders: string[];
  enableAllChannels: boolean;
  enabledChannels: string[];
  // parental
  /** Le score maximal de la table de Jellyfin (`ParentalRatingScore.score`) ; null : aucun. */
  maxParentalRating: number | null;
  maxParentalSubRating: number | null;
  blockUnratedItems: UnratedItemType[];
  blockedTags: string[];
  allowedTags: string[];
  /** Vide : à toute heure. Sinon, l'accès n'est permis QUE dans ces plages. */
  accessSchedules: AccessScheduleDto[];
  // playback
  enableMediaPlayback: boolean;
  enableAudioPlaybackTranscoding: boolean;
  enableVideoPlaybackTranscoding: boolean;
  enablePlaybackRemuxing: boolean;
  forceRemoteSourceTranscoding: boolean;
  /** Bits par seconde ; 0 : sans limite. */
  remoteClientBitrateLimit: number;
  syncPlayAccess: SyncPlayAccess;
  // offline
  enableContentDownloading: boolean;
  enableMediaConversion: boolean;
  // management
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

export type UserRightsKey = keyof UserRights;

const INT32_MAX = 2_147_483_647;

/** Liste FERMÉE clé Tentacle → champ de la `UserPolicy` Jellyfin. */
export const USER_RIGHTS_FIELDS = {
  isAdministrator: { jellyfin: "IsAdministrator", group: "account", kind: "boolean" },
  isDisabled: { jellyfin: "IsDisabled", group: "account", kind: "boolean" },
  isHidden: { jellyfin: "IsHidden", group: "account", kind: "boolean" },
  enableRemoteAccess: { jellyfin: "EnableRemoteAccess", group: "account", kind: "boolean" },
  maxActiveSessions: { jellyfin: "MaxActiveSessions", group: "account", kind: "integer", min: 0, max: 1000 },
  loginAttemptsBeforeLockout: { jellyfin: "LoginAttemptsBeforeLockout", group: "account", kind: "integer", min: -1, max: 1000 },
  enableAllFolders: { jellyfin: "EnableAllFolders", group: "libraries", kind: "boolean" },
  enabledFolders: { jellyfin: "EnabledFolders", group: "libraries", kind: "folderList", among: "libraries" },
  enableAllChannels: { jellyfin: "EnableAllChannels", group: "libraries", kind: "boolean" },
  enabledChannels: { jellyfin: "EnabledChannels", group: "libraries", kind: "folderList", among: "channels" },
  maxParentalRating: { jellyfin: "MaxParentalRating", group: "parental", kind: "integer", min: 0, max: INT32_MAX, nullable: true },
  maxParentalSubRating: { jellyfin: "MaxParentalSubRating", group: "parental", kind: "integer", min: 0, max: INT32_MAX, nullable: true },
  blockUnratedItems: { jellyfin: "BlockUnratedItems", group: "parental", kind: "unratedList" },
  blockedTags: { jellyfin: "BlockedTags", group: "parental", kind: "stringList" },
  allowedTags: { jellyfin: "AllowedTags", group: "parental", kind: "stringList" },
  accessSchedules: { jellyfin: "AccessSchedules", group: "parental", kind: "schedules" },
  enableMediaPlayback: { jellyfin: "EnableMediaPlayback", group: "playback", kind: "boolean" },
  enableAudioPlaybackTranscoding: { jellyfin: "EnableAudioPlaybackTranscoding", group: "playback", kind: "boolean" },
  enableVideoPlaybackTranscoding: { jellyfin: "EnableVideoPlaybackTranscoding", group: "playback", kind: "boolean" },
  enablePlaybackRemuxing: { jellyfin: "EnablePlaybackRemuxing", group: "playback", kind: "boolean" },
  forceRemoteSourceTranscoding: { jellyfin: "ForceRemoteSourceTranscoding", group: "playback", kind: "boolean" },
  remoteClientBitrateLimit: { jellyfin: "RemoteClientBitrateLimit", group: "playback", kind: "integer", min: 0, max: INT32_MAX },
  syncPlayAccess: { jellyfin: "SyncPlayAccess", group: "playback", kind: "enum", values: SYNC_PLAY_ACCESS },
  enableContentDownloading: { jellyfin: "EnableContentDownloading", group: "offline", kind: "boolean" },
  enableMediaConversion: { jellyfin: "EnableMediaConversion", group: "offline", kind: "boolean" },
  enableContentDeletion: { jellyfin: "EnableContentDeletion", group: "management", kind: "boolean" },
  enableContentDeletionFromFolders: {
    jellyfin: "EnableContentDeletionFromFolders",
    group: "management",
    kind: "folderList",
    among: "libraries",
  },
  enableCollectionManagement: { jellyfin: "EnableCollectionManagement", group: "management", kind: "boolean" },
  enableSubtitleManagement: { jellyfin: "EnableSubtitleManagement", group: "management", kind: "boolean" },
  enableLyricManagement: { jellyfin: "EnableLyricManagement", group: "management", kind: "boolean" },
  enableLiveTvAccess: { jellyfin: "EnableLiveTvAccess", group: "management", kind: "boolean" },
  enableLiveTvManagement: { jellyfin: "EnableLiveTvManagement", group: "management", kind: "boolean" },
  enableRemoteControlOfOtherUsers: { jellyfin: "EnableRemoteControlOfOtherUsers", group: "management", kind: "boolean" },
  enableSharedDeviceControl: { jellyfin: "EnableSharedDeviceControl", group: "management", kind: "boolean" },
  enablePublicSharing: { jellyfin: "EnablePublicSharing", group: "management", kind: "boolean" },
} as const satisfies Record<UserRightsKey, UserRightsFieldSpec>;

export const USER_RIGHTS_KEYS = Object.keys(USER_RIGHTS_FIELDS) as UserRightsKey[];

export function isUserRightsKey(value: unknown): value is UserRightsKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(USER_RIGHTS_FIELDS, value);
}

/** `GET`/`PATCH /api/admin/users/:userId/rights` → l'état RÉEL, relu dans Jellyfin. */
export interface UserRightsDto {
  userId: string;
  name: string;
  rights: UserRights;
  /** Lecture dans Jellyfin (ISO). */
  readAt: string;
}

/** Le correctif : les SEULS champs présents changent (au moins un). */
export type UserRightsPatch = Partial<UserRights>;

/** `GET /api/admin/users/rights/options` — ce que Jellyfin propose, pour régler. */
export interface UserRightsOptions {
  libraries: { id: string; name: string; collectionType: string | null }[];
  channels: { id: string; name: string }[];
  /** La table de Jellyfin (`/Localization/ParentalRatings`), dans SA langue de métadonnées. */
  parentalRatings: { name: string; score: number; subScore: number | null }[];
  unratedItemTypes: UnratedItemType[];
  /** Les étiquettes déjà posées sur des titres de la bibliothèque. */
  knownTags: string[];
}

/** Les refus (`{ error }`), liste FERMÉE. */
export const USER_RIGHTS_REFUSALS = [
  "unknown_user",
  "family_guest",
  "last_admin",
  "self_lockout",
  "invalid_value",
  "jellyfin_unreachable",
  "jellyfin_refused",
] as const;
export type UserRightsRefusal = (typeof USER_RIGHTS_REFUSALS)[number];

export const USER_RIGHTS_REFUSAL_STATUS: Record<UserRightsRefusal, number> = {
  unknown_user: 404,
  family_guest: 409,
  last_admin: 409,
  self_lockout: 409,
  invalid_value: 400,
  jellyfin_unreachable: 503,
  jellyfin_refused: 502,
};

export interface UserRightsRefusalBody {
  error: UserRightsRefusal;
  /** `invalid_value` : les CLÉS refusées (jamais une valeur). */
  fields?: UserRightsKey[];
}
