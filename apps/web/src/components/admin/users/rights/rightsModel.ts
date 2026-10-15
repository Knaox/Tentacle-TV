import { USER_RIGHTS_GROUPS, type UserRights, type UserRightsGroup, type UserRightsKey, type UserRightsRefusal } from "@tentacle-tv/shared";
import { isNeverSchedule } from "../../../parental/parentalModel";

/**
 * Les règles PURES de la fiche des droits : l'ordre des rubriques, le résumé
 * en une ligne de chacune (ce qu'on lit fiche repliée), et ce que la fiche
 * refuse d'offrir d'avance — le serveur revérifie tout.
 */

/** L'ordre du contrat (`USER_RIGHTS_GROUPS`) : compte, bibliothèques, contrôle parental, lecture, hors ligne, gestion. */
export const RIGHTS_GROUPS: readonly UserRightsGroup[] = USER_RIGHTS_GROUPS;

/** Un fragment du résumé : une clé de l'espace `adminUserRights` et ses valeurs. */
export interface SummaryPart {
  key: string;
  values?: Record<string, string | number>;
}

export interface SummaryContext {
  libraryCount: number;
  /** Le nom de la note maximale posée ; null : aucune. */
  ratingName: string | null;
}

/** Les droits de « Gestion », dans l'ordre de la rubrique. */
export const MANAGEMENT_FLAGS = ["enableContentDeletion", "enablePublicSharing"] as const satisfies readonly UserRightsKey[];

/** Vrai dès qu'une restriction de contenu est posée (même règle que le serveur, § 5). */
export function hasParentalRestriction(rights: UserRights): boolean {
  return rights.maxParentalRating !== null
    || rights.blockedTags.length > 0
    || rights.allowedTags.length > 0
    || rights.blockUnratedItems.length > 0;
}

export function groupSummary(group: UserRightsGroup, rights: UserRights, context: SummaryContext): SummaryPart[] {
  switch (group) {
    case "account": {
      const parts: SummaryPart[] = [];
      if (rights.isDisabled) parts.push({ key: "summary.disabled" });
      parts.push({ key: rights.isAdministrator ? "summary.admin" : "summary.standard" });
      if (!rights.enableRemoteAccess) parts.push({ key: "summary.localOnly" });
      return parts;
    }
    case "libraries":
      return [rights.enableAllFolders
        ? { key: "summary.allLibraries" }
        : { key: "summary.someLibraries", values: { count: rights.enabledFolders.length, total: context.libraryCount } }];
    case "parental": {
      const parts: SummaryPart[] = [];
      if (rights.maxParentalRating !== null) {
        parts.push(context.ratingName
          ? { key: "summary.ratingMax", values: { rating: context.ratingName } }
          : { key: "summary.ratingMaxScore", values: { score: rights.maxParentalRating } });
      }
      if (rights.blockUnratedItems.length) parts.push({ key: "summary.unrated", values: { count: rights.blockUnratedItems.length } });
      if (rights.allowedTags.length) parts.push({ key: "summary.allowedTags", values: { count: rights.allowedTags.length } });
      if (rights.blockedTags.length) parts.push({ key: "summary.blockedTags", values: { count: rights.blockedTags.length } });
      if (isNeverSchedule(rights.accessSchedules)) parts.push({ key: "summary.scheduleNever" });
      else if (rights.accessSchedules.length) parts.push({ key: "summary.schedules", values: { count: rights.accessSchedules.length } });
      return parts.length ? parts : [{ key: "summary.noParental" }];
    }
    case "playback": {
      if (!rights.enableMediaPlayback) return [{ key: "summary.noPlayback" }];
      const parts: SummaryPart[] = [];
      if (!rights.enableVideoPlaybackTranscoding) parts.push({ key: "summary.noVideoTranscode" });
      if (rights.forceRemoteSourceTranscoding) parts.push({ key: "summary.forceTranscode" });
      if (rights.remoteClientBitrateLimit > 0) {
        parts.push({ key: "summary.bitrate", values: { mbps: Math.round(rights.remoteClientBitrateLimit / 100_000) / 10 } });
      }
      if (rights.syncPlayAccess === "None") parts.push({ key: "summary.noSyncPlay" });
      else if (rights.syncPlayAccess === "JoinGroups") parts.push({ key: "summary.syncPlayJoinOnly" });
      return parts.length ? parts : [{ key: "summary.playbackFull" }];
    }
    case "offline":
      if (!rights.enableContentDownloading) return [{ key: "summary.noDownload" }];
      return [{ key: rights.enableMediaConversion ? "summary.downloadAndLight" : "summary.download" }];
    case "management": {
      const count = MANAGEMENT_FLAGS.filter((flag) => rights[flag]).length;
      return [count ? { key: "summary.managementCount", values: { count } } : { key: "summary.managementNone" }];
    }
  }
}

/**
 * Ce qu'un administrateur ne se fait pas à lui-même (`self_lockout` côté
 * serveur) : se retirer l'administration, se désactiver. La fiche ne l'offre
 * pas d'avance plutôt que d'attendre le refus.
 */
export function lockedForSelf(field: UserRightsKey, isSelf: boolean, rights: UserRights): boolean {
  if (!isSelf) return false;
  if (field === "isAdministrator") return rights.isAdministrator;
  if (field === "isDisabled") return !rights.isDisabled;
  return false;
}

/** Les gestes qui demandent une confirmation : ils changent qui entre et ce qu'il peut tout faire. */
export function needsConfirmation(field: UserRightsKey, next: unknown): boolean {
  return (field === "isAdministrator" || field === "isDisabled") && next === true;
}

/** La clé du refus, dans l'espace `adminUserRights` ; un refus inconnu dit seulement l'échec. */
export function refusalKey(code: UserRightsRefusal | null): string {
  return code ? `refusal.${code}` : "refusal.unknown";
}
