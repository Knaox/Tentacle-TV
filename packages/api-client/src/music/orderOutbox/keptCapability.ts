/**
 * Octave — une capacité d'ORDRE (tri des listes, ordre des rubriques) quand le serveur ne répond pas (lot « ol »).
 * Hors ligne, `/api/config` échoue : aucune capacité n'est déclarée, et une playlist gardée perdait le tri et
 * l'ordre du compte (puis son glisser). Or la page gardée de cet ordre (préférence d'une liste, rubriques) n'existe
 * que si CE serveur l'a servie (cache par identité) : elle prouve la capacité tant que la configuration est
 * inconnue. Une configuration qui a RÉPONDU fait foi (un serveur d'avant : rien).
 */

export function keptCapability(declared: boolean, configKnown: boolean, keptPage: boolean): boolean {
  return declared || (!configKnown && keptPage);
}
