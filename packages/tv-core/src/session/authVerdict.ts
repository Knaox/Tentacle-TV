/**
 * Un VERDICT du serveur sur un jeton (rafraîchi, refusé, « révoqué ») ne vaut
 * que pour ce jeton. Module pur.
 *
 * Pendant l'appel, la session a pu changer sous lui — l'échange d'une TV qui
 * passe aux profils remplace l'ancien jeton par le jeton de jumelage, une
 * session de profil s'ouvre ou se ferme. Le verdict parle alors d'un jeton
 * qui n'est plus celui de la session : il ne s'applique pas. Vécu au
 * simulateur (2026-10-04) : un rafraîchissement parti avec l'ancien jeton,
 * revenu « révoqué » juste après l'échange, déjumelait la TV.
 */
export function authVerdictApplies(tokenSent: string, tokenNow: string | null): boolean {
  return tokenNow === tokenSent;
}
