import {
  ACCESS_SCHEDULE_DAYS,
  SYNC_PLAY_ACCESS,
  UNRATED_ITEM_TYPES,
  USER_RIGHTS_FIELDS,
  type AccessScheduleDto,
  type SyncPlayAccess,
  type UnratedItemType,
  type UserRights,
  type UserRightsKey,
  type UserRightsPatch,
} from "../../userRights/userRightsContract";
import { normalizeJellyfinId } from "../../userRights/userRightsPatch";

/**
 * Le passage `UserPolicy` Jellyfin ↔ `UserRights` (règles pures).
 *
 * L'écriture part TOUJOURS de la politique complète que Jellyfin vient de
 * rendre et n'y change que les champs du correctif : `POST /Users/{id}/Policy`
 * REMPLACE tout (un champ absent retombe au défaut — jusqu'au 500 sans
 * `AuthenticationProviderId`). Le reste repart à l'octet près.
 */

export type JellyfinPolicy = Record<string, unknown>;

function bool(value: unknown): boolean {
  return value === true;
}

function int(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

function intOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function ids(value: unknown): string[] {
  return strings(value).map(normalizeJellyfinId);
}

function unrated(value: unknown): UnratedItemType[] {
  const known = UNRATED_ITEM_TYPES as readonly string[];
  return strings(value).filter((item): item is UnratedItemType => known.includes(item));
}

function schedulesOf(value: unknown): AccessScheduleDto[] {
  if (!Array.isArray(value)) return [];
  const days = ACCESS_SCHEDULE_DAYS as readonly string[];
  return value.flatMap((entry) => {
    const { DayOfWeek, StartHour, EndHour } = (entry ?? {}) as Record<string, unknown>;
    if (typeof DayOfWeek !== "string" || !days.includes(DayOfWeek)) return [];
    if (typeof StartHour !== "number" || typeof EndHour !== "number") return [];
    return [{ dayOfWeek: DayOfWeek as AccessScheduleDto["dayOfWeek"], startHour: StartHour, endHour: EndHour }];
  });
}

function syncPlay(value: unknown): SyncPlayAccess {
  return typeof value === "string" && (SYNC_PLAY_ACCESS as readonly string[]).includes(value) ? (value as SyncPlayAccess) : "None";
}

/** Les droits lus dans une politique. Une valeur absente ou illisible vaut la plus FERMÉE. */
export function rightsFromPolicy(policy: JellyfinPolicy): UserRights {
  const p = policy;
  return {
    isAdministrator: bool(p.IsAdministrator),
    isDisabled: p.IsDisabled !== false,
    enableRemoteAccess: bool(p.EnableRemoteAccess),
    maxActiveSessions: int(p.MaxActiveSessions, 0),
    loginAttemptsBeforeLockout: int(p.LoginAttemptsBeforeLockout, 0),
    enableAllFolders: bool(p.EnableAllFolders),
    enabledFolders: ids(p.EnabledFolders),
    maxParentalRating: intOrNull(p.MaxParentalRating),
    maxParentalSubRating: intOrNull(p.MaxParentalSubRating),
    blockUnratedItems: unrated(p.BlockUnratedItems),
    blockedTags: strings(p.BlockedTags),
    allowedTags: strings(p.AllowedTags),
    accessSchedules: schedulesOf(p.AccessSchedules),
    enableMediaPlayback: bool(p.EnableMediaPlayback),
    enableAudioPlaybackTranscoding: bool(p.EnableAudioPlaybackTranscoding),
    enableVideoPlaybackTranscoding: bool(p.EnableVideoPlaybackTranscoding),
    enablePlaybackRemuxing: bool(p.EnablePlaybackRemuxing),
    forceRemoteSourceTranscoding: bool(p.ForceRemoteSourceTranscoding),
    remoteClientBitrateLimit: int(p.RemoteClientBitrateLimit, 0),
    syncPlayAccess: syncPlay(p.SyncPlayAccess),
    enableContentDownloading: bool(p.EnableContentDownloading),
    enableMediaConversion: bool(p.EnableMediaConversion),
    enableContentDeletion: bool(p.EnableContentDeletion),
    enableContentDeletionFromFolders: ids(p.EnableContentDeletionFromFolders),
    enablePublicSharing: bool(p.EnablePublicSharing),
  };
}

/** Les plages horaires dans la forme de Jellyfin (`AccessSchedule`), rattachées au compte, sans `Id`. */
export function schedulesToJellyfin(userId: string, schedules: readonly AccessScheduleDto[]): JellyfinPolicy[] {
  return schedules.map((entry) => ({
    DayOfWeek: entry.dayOfWeek,
    StartHour: entry.startHour,
    EndHour: entry.endHour,
    UserId: userId,
  }));
}

/** La valeur d'un droit dans la forme de Jellyfin. */
export function jellyfinValue(userId: string, key: UserRightsKey, value: unknown): unknown {
  if (key === "accessSchedules") return schedulesToJellyfin(userId, value as AccessScheduleDto[]);
  return value;
}

/**
 * La politique à réécrire : celle de Jellyfin, ENTIÈRE, où seuls les champs du
 * correctif changent. Les autres clés (fournisseurs d'authentification, champs
 * inconnus d'une version future) repartent telles quelles.
 */
export function applyRightsPatch(userId: string, policy: JellyfinPolicy, patch: UserRightsPatch): JellyfinPolicy {
  const next: JellyfinPolicy = { ...policy };
  for (const key of Object.keys(patch) as UserRightsKey[]) {
    next[USER_RIGHTS_FIELDS[key].jellyfin] = jellyfinValue(userId, key, patch[key]);
  }
  return next;
}

/** Les clés du correctif que Jellyfin n'a PAS retenues telles quelles (relecture). */
export function unappliedKeys(patch: UserRightsPatch, reread: UserRights): UserRightsKey[] {
  return (Object.keys(patch) as UserRightsKey[]).filter((key) => {
    const wanted = patch[key];
    const actual = reread[key];
    if (Array.isArray(wanted) && Array.isArray(actual)) {
      const order = (list: unknown[]) => list.map((entry) => JSON.stringify(entry)).sort();
      return JSON.stringify(order(wanted)) !== JSON.stringify(order(actual));
    }
    return JSON.stringify(wanted) !== JSON.stringify(actual);
  });
}
