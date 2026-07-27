/**
 * Un appareil jumelé ne parle que pour SON compte.
 *
 * # Le problème
 *
 * Pour un appareil jumelé, le proxy remplace le jeton du client par la clé
 * ADMIN avant de transmettre à Jellyfin (`resolveSessionRouting`). C'est un
 * choix assumé : l'appareil n'a pas toujours de jeton Jellyfin propre, et les
 * routes ciblent explicitement `/Users/{userId}/…`.
 *
 * Mais rien ne vérifiait que ce `{userId}` soit celui du porteur du jeton. Or
 * la liste blanche autorise `Users/{id}/Items`, `Users/{id}/Views`,
 * `Users/{id}/FavoriteItems/{itemId}` et `Users/{id}/PlayedItems/{itemId}`.
 * Il suffisait donc de changer l'identifiant dans l'URL pour lire — et pour
 * modifier — les données d'un autre compte, avec les pleins pouvoirs de la clé
 * admin derrière.
 *
 * Constaté sur le serveur réel : `GET /Users/{autre}/Items` avec la clé admin
 * rend 200 et la bibliothèque complète du compte visé.
 *
 * # Ce qui n'est PAS concerné, et pourquoi
 *
 *  - **Les jetons d'usurpation** (« voir en tant que », réservé à
 *    l'administrateur) : accéder au compte d'autrui est précisément leur
 *    raison d'être. Le garde ne s'applique qu'aux jetons d'APPAREIL.
 *  - **`Users/Me`** et **`Users/AuthenticateByName`** : ce ne sont pas des
 *    identifiants. Le motif exige un segment suivant, ils n'en ont pas.
 *  - **`UserItems/{itemId}/UserData`** : la route moderne ne porte pas
 *    d'identifiant d'utilisateur — c'est le jeton qui décide, comme il se doit.
 *
 * Ce fichier n'importe rien et se teste seul.
 */

/**
 * Identifiant d'utilisateur porté par le chemin, ou `null`.
 *
 * Insensible à la casse : `isAllowedProxyPath` l'est aussi, et un contrôle plus
 * strict que la liste blanche qu'il double laisserait un trou par où passer.
 */
export function userIdDuChemin(chemin: string): string | null {
  const m = /^Users\/([^/]+)\//i.exec(chemin);
  const id = m?.[1];
  if (id === undefined) return null;
  // `Me` est résolu par Jellyfin d'après le jeton : ce n'est pas un identifiant,
  // et le comparer à celui du porteur n'aurait aucun sens.
  return id.toLowerCase() === "me" ? null : id;
}

/**
 * Ce chemin sort-il du périmètre de cet utilisateur ?
 *
 * Comparaison insensible à la casse : Jellyfin rend ses identifiants tantôt
 * avec tirets, tantôt sans, et la casse varie selon l'appelant. Une comparaison
 * stricte refuserait des requêtes légitimes — un garde qui bloque le cas normal
 * finit toujours par être retiré.
 */
export function horsDuPerimetre(chemin: string, userId: string): boolean {
  const cible = userIdDuChemin(chemin);
  if (cible === null) return false;
  return normaliser(cible) !== normaliser(userId);
}

/** Sans tirets, en minuscules : les deux formes que Jellyfin emploie. */
function normaliser(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}
