import { isOutOfScope, userIdFromPath, userIdFromQuery } from "./userScope";

/**
 * Ce qu'un jeton d'APPAREIL ne fait jamais par le proxy, qui lui prête en aval
 * la clé d'administration de Jellyfin :
 *
 * - parler pour un AUTRE compte (`userScope.ts`). Sans ce garde, changer
 *   l'identifiant dans l'URL donnait accès aux données d'un autre compte, avec
 *   les pleins pouvoirs derrière : la liste blanche autorise `Users/{id}/Items`,
 *   `/Views`, `/FavoriteItems/…`, `/PlayedItems/…` — la lecture ET la
 *   modification. Il porte sur toutes les méthodes et toutes les routes qui
 *   nomment un utilisateur.
 *
 * Un jeton Jellyfin natif n'est pas concerné (Jellyfin décide lui-même), ni un
 * jeton d'usurpation, dont c'est justement la raison d'être.
 *
 * `null` : la requête passe ; sinon, la raison à journaliser (403).
 */
export function deviceRefusal(
  path: string,
  userId: string,
  query: Record<string, unknown> | undefined,
): string | null {
  if ((userIdFromPath(path) !== null || userIdFromQuery(query) !== null) && isOutOfScope(path, userId, query)) {
    return "acces refuse : appareil hors de son perimetre utilisateur";
  }
  return null;
}
