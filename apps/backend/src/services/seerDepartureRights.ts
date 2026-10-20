import type { RegistryClaim } from "./announcedRegistry";
import { notificationsFiltered, visibleNotificationRows } from "../notifications/notificationRights";
import { titleAllowedFor } from "./reco/recoRights";
import { resolveSeerContent } from "./seerAvailabilityGuard";

/**
 * Le départ d'une demande (« … est en route ») face aux droits D'AUJOURD'HUI
 * du demandeur (docs/DROITS-UTILISATEURS.md § 9.5).
 *
 * La demande a été jugée quand elle est partie ; mais une note maximale ou une
 * bibliothèque retirée depuis (au bureau, par le propriétaire d'une famille)
 * cache peut-être le titre aujourd'hui. La cloche filtre à la lecture
 * (`notificationRights.ts`) ; la PUSH, elle, s'affiche sur l'écran verrouillé
 * du téléphone sans passer par là. Un compte que sa politique peut priver de
 * quelque chose ne la reçoit que s'il voit le titre — par la cible de la ligne,
 * puis par la demande elle-même (TMDB). Titre introuvable : fermé à l'échec.
 * Compte libre : rien de plus.
 */
export async function departurePushAllowed(
  n: { jellyfinUserId: string; refId: string | null; title: string; target?: string | null },
  userClaims: RegistryClaim[],
): Promise<boolean> {
  try {
    if (!(await notificationsFiltered(n.jellyfinUserId))) return true;
    if ((await visibleNotificationRows(n.jellyfinUserId, [n])).length === 0) return false;
    const content = await resolveSeerContent(n, userClaims);
    if (!content || (content.mediaType !== "movie" && content.mediaType !== "tv")) return false;
    return await titleAllowedFor(n.jellyfinUserId, { mediaType: content.mediaType, tmdbId: content.tmdbId });
  } catch {
    return false;
  }
}
