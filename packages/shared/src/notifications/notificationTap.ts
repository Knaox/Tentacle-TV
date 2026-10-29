import { FAMILY_NOTIFICATION_TYPES } from "../family/familyProtocol";
import { familyPosterRequestOf } from "../family/familyClient";
import type { NotificationTarget } from "./notificationTarget";

/**
 * Le GESTE d'ouverture d'une notification, décidé une fois pour tous les
 * clients et pour toutes ses portes (centre de notifications, push au premier
 * plan, en arrière-plan ou au démarrage à froid). Une règle pure : chaque
 * client l'APPLIQUE (route, affiche, écran local), sans en recopier les cas.
 *
 * - `onDevice` : une notification LOCALE du hors ligne (le mobile seul en pose).
 * - `familyPoster` : « X vous invite… » ouvre l'affiche de CETTE invitation.
 * - `route` : la destination se calcule (`resolveNotificationDestination`) ;
 *   `needsPlugins` dit s'il faut d'abord les métadonnées des extensions.
 */
export type NotificationTapAction =
  | { kind: "onDevice" }
  | { kind: "familyPoster"; invitationId: string }
  | { kind: "route"; needsPlugins: boolean };

/** Les notifications LOCALES du hors ligne (mobile) : jamais écrites par le serveur. */
export const LOCAL_NOTIFICATION_TYPES = ["offline_ready", "offline_disk_full"] as const;

/**
 * Tous les types que le cœur écrit dans `notifications` ou envoie en push —
 * la liste que les tests de destination parcourent. Une extension écrit les
 * siens (`request_status` pour les demandes) et pose sa CIBLE : un type
 * inconnu de cette liste n'est pas une erreur, il se lit par sa cible.
 */
export const KNOWN_NOTIFICATION_TYPES = [
  "ticket_reply",
  "ticket_status",
  "ticket_new",
  "ticket_user_reply",
  "ticket_user_closed",
  "request_status",
  "library_added",
  "watchlist_share",
  // Octave : une playlist partagée avec ce compte (`musicPlaylistMembers.ts`).
  "music_playlist_shared",
  ...FAMILY_NOTIFICATION_TYPES,
] as const;
export type KnownNotificationType = (typeof KNOWN_NOTIFICATION_TYPES)[number];

interface TapInput {
  type: string;
  refId?: string | null;
  target?: NotificationTarget | null;
}

/** Faut-il les métadonnées des extensions pour savoir où mène cette notification ? */
export function notificationNeedsPlugins(n: TapInput): boolean {
  const target = n.target;
  if (target?.kind === "extension") return true;
  if (target?.kind === "title" && target.fallback?.kind === "extension") return true;
  // Sans cible (ou une cible titre sans repli), le type décide : les demandes
  // mènent à la page de l'extension qui les tient.
  return n.type === "request_status";
}

export function decideNotificationTap(n: TapInput): NotificationTapAction {
  if ((LOCAL_NOTIFICATION_TYPES as readonly string[]).includes(n.type)) return { kind: "onDevice" };
  const invitationId = familyPosterRequestOf({ type: n.type, refId: n.refId ?? null });
  if (invitationId) return { kind: "familyPoster", invitationId };
  return { kind: "route", needsPlugins: notificationNeedsPlugins(n) };
}
