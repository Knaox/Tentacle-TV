/**
 * Octave — une liste qui se RÉVISE sans bouger sous la main (contrat v2 de la
 * recherche d'extension : classement provisoire, puis révisé). Règle pure :
 * tant que la liste est TENUE (pointeur ou focus dedans), les rangées déjà
 * affichées gardent leur ordre et restent là ; les nouvelles s'ajoutent en
 * bas. Relâchée, la liste prend l'ordre du serveur.
 */

export function settleOrder<T extends { key: string }>(shown: readonly T[], next: readonly T[], held: boolean): T[] {
  if (!held) return [...next];
  const fresh = new Map(next.map((item) => [item.key, item]));
  // La version la plus récente de chaque rangée tenue (pochette, crédits complétés), à sa place.
  const kept = shown.map((item) => fresh.get(item.key) ?? item);
  const known = new Set(shown.map((item) => item.key));
  return [...kept, ...next.filter((item) => !known.has(item.key))];
}
