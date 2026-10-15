/**
 * Les notifications d'un compte face à ses droits D'AUJOURD'HUI
 * (docs/DROITS-UTILISATEURS.md § 9.5).
 *
 * Un émetteur juge le destinataire au moment d'écrire (Vigie : `notification-gate` ;
 * le cœur : « nouveau titre », « demande disponible »). Mais un avis écrit AVANT
 * qu'une note maximale ou une bibliothèque refusée ne cache son titre restait dans
 * la liste — nom et identifiant compris. À la lecture, pour un compte que sa
 * politique peut priver de quelque chose : un avis qui MÈNE à un titre (cible
 * `item`, ou `title` par TMDB) n'est rendu que si le compte voit ce titre. Un avis
 * sans titre (ticket sans cible, Famille, extension) reste. Compte libre : rien de plus.
 */

import { getContentPolicy, limitsLibraries } from "../services/contentPolicy";
import { isItemVisibleTo } from "../services/itemAccess/itemVisibility";
import { titleAllowedFor } from "../services/reco/recoRights";
import { parseNotificationTarget, type NotificationTarget } from "./notificationTarget";

async function targetVisible(userId: string, target: NotificationTarget | null): Promise<boolean> {
  if (!target || target.kind === "extension") return true;
  if (target.kind === "item") return isItemVisibleTo(userId, target.itemId);
  if (!(await titleAllowedFor(userId, { mediaType: target.mediaType, tmdbId: target.tmdbId }))) return false;
  return target.fallback?.kind !== "item" || isItemVisibleTo(userId, target.fallback.itemId);
}

/** La politique du compte peut-elle lui cacher un avis ? (Illisible : oui.) */
export async function notificationsFiltered(userId: string): Promise<boolean> {
  const policy = await getContentPolicy(userId);
  return policy.restricted || limitsLibraries(policy);
}

/** Les lignes que le compte peut voir, dans leur ordre (cible lue sur la colonne brute). */
export async function visibleNotificationRows<T extends { target?: string | null }>(userId: string, rows: readonly T[]): Promise<T[]> {
  if (rows.length === 0 || !(await notificationsFiltered(userId))) return [...rows];
  const verdicts = await Promise.all(rows.map((row) => targetVisible(userId, parseNotificationTarget(row.target ?? null)).catch(() => false)));
  return rows.filter((_row, index) => verdicts[index]);
}
