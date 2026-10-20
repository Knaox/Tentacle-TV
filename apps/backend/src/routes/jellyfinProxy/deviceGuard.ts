import { isDeviceWriteAllowed } from "./deviceWrites";
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
 *   nomment un utilisateur ;
 * - écrire hors de SES données (`deviceWrites.ts`) : jamais un titre, ses
 *   images ou ses métadonnées supprimés ou modifiés.
 *
 * Un jeton Jellyfin natif n'est pas concerné (Jellyfin décide lui-même), ni un
 * jeton d'usurpation, dont c'est justement la raison d'être.
 *
 * Seule exception au périmètre : LIRE la photo d'un compte. Jellyfin la sert
 * sans jeton (« Qui regarde ? » des TV la lit ainsi) ; une session de profil
 * montre celle de chaque membre de sa séance de Watch Together — refusée, l'hôte
 * paraissait en initiale (constat du 21/10). L'écrire reste borné à SON compte.
 *
 * `null` : la requête passe ; sinon, la raison à journaliser (403).
 */
export function deviceRefusal(
  method: string,
  path: string,
  userId: string,
  query: Record<string, unknown> | undefined,
): string | null {
  const scoped = !readsAccountPhoto(method, path) && (userIdFromPath(path) !== null || userIdFromQuery(query) !== null);
  if (scoped && isOutOfScope(path, userId, query)) {
    return "acces refuse : appareil hors de son perimetre utilisateur";
  }
  if (!isDeviceWriteAllowed(method, path)) return "ecriture refusee : hors de ce qu'un appareil ecrit";
  return null;
}

/** La lecture de la photo d'un compte (le seul chemin d'image de compte du proxy). */
function readsAccountPhoto(method: string, path: string): boolean {
  const verb = method.toUpperCase();
  return (verb === "GET" || verb === "HEAD") && /^Users\/[^/]+\/Images\/Primary$/i.test(path);
}
