/**
 * Le retour au premier plan revalide la session (`useAuthRefresh`) : le serveur rend le MÊME jeton tant qu'il vaut
 * (`/api/auth/refresh` est idempotent). Tout le cache de requêtes n'est relu que si le jeton a CHANGÉ — l'invalider
 * à chaque retour relançait toutes les requêtes montées et réécrivait le cache gardé d'Octave : la lecture et
 * l'interface en sortaient à-coups (lot « fl », 30/10). Les requêtes périmées, elles, se relisent déjà seules au
 * retour (`focusManager`). Module PUR.
 */

export function tokenRenewed(previous: string | null, next: unknown): next is string {
  return typeof next === "string" && next !== "" && next !== previous;
}
