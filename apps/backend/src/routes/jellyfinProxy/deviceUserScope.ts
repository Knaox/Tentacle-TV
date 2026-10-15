/**
 * Une requête SANS utilisateur, bornée à celui de l'appareil.
 *
 * # Le problème
 *
 * Pour un jeton d'appareil, le proxy prête la clé d'administration de
 * Jellyfin (`sessionRouting.ts`). Le garde de périmètre (`userScope.ts`)
 * refuse un `userId` d'un AUTRE compte — mais une requête qui n'en porte
 * AUCUN part telle quelle, et Jellyfin répond alors pour la clé : toute la
 * médiathèque, sans les bibliothèques, le contrôle parental ni les étiquettes
 * du compte, et sans ses données (vu, favoris, reprise).
 *
 * # La règle — tout porteur de la clé prêtée
 *
 * Sur les routes qui rendent du catalogue et savent le restreindre à un
 * compte, un `userId` absent devient celui de la session : Jellyfin applique
 * alors les droits du compte — note maximale, étiquettes, bibliothèques
 * (docs/DROITS-UTILISATEURS.md § 5) ; un invité ne voit que ce que voit son
 * créateur, jamais ce que voit la clé. Un `userId` présent a déjà été jugé
 * par `userScope.ts` (c'est le sien) : rien ne change.
 *
 * Né pour les sessions de profil du BUREAU (docs/FAMILLE.md « Le bureau »),
 * étendu le 2026-10-15 à TOUT jeton d'appareil (TV jumelée, profil de TV) et
 * à « voir en tant que » : un appel oublieux de son compte ne doit plus
 * jamais lire pour l'administrateur — ni la vue d'un compte restreint montrer
 * plus que ce compte.
 *
 * Ce fichier n'importe rien et se teste seul.
 */

/** Évaluées sur le chemin ENVOYÉ à Jellyfin (après `modernRoutes.ts`), en toute casse. */
const USER_SCOPED_ROUTES: readonly RegExp[] = [
  /^Items(\/[^/]+)?$/i,
  /^Items\/[^/]+\/(Similar|Ancestors|Collections|PlaybackInfo|LocalTrailers|SpecialFeatures|Intros)$/i,
  /^UserItems\/Resume$/i,
  /^Shows\/NextUp$/i,
  /^Shows\/[^/]+\/(Seasons|Episodes|NextUp)$/i,
  /^Search\/Hints$/i,
  /^(Genres|Studios|Persons|Artists)(\/[^/]+)?$/i,
];

/** La query (`?…` ou vide) à envoyer : `userId` posé s'il manque sur une route de catalogue. */
export function scopedToDeviceUser(path: string, query: string, userId: string): string {
  if (!USER_SCOPED_ROUTES.some((pattern) => pattern.test(path))) return query;
  const raw = query.startsWith("?") ? query.slice(1) : query;
  const params = new URLSearchParams(raw);
  if ([...params.keys()].some((key) => key.toLowerCase() === "userid")) return query;
  const user = `userId=${encodeURIComponent(userId)}`;
  return raw ? `?${raw}&${user}` : `?${user}`;
}
