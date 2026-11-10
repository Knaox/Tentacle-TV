/**
 * Les pages dont l'entrée s'est déjà jouée pendant cette session, par leur ADRESSE — la règle,
 * pure ; `PageTransition` la lit.
 *
 * Ouvrir une fiche démonte la coquille (`routeKeys` : `/media` est hors coquille) ; le retour
 * la remonte, et la page revenue rejouait son fondu d'entrée alors que tout son contenu avait
 * déjà été vu — affiches en cache, rangées déjà entrées (`rowEntranceMemory`), images déjà
 * décodées (`lib/seenImages`). C'était ce qui restait du clignotement au retour d'une fiche
 * (banc `bench:route-shell`, `retour_entreeDeLaPageMs`).
 *
 * Désormais une page déjà entrée est là D'EMBLÉE quand on y revient ; une page jamais vue
 * entre comme avant. La page quittée s'efface toujours (`RouteExit`) : le changement reste lu.
 * Borné, mémoire du module seulement — un rechargement repart de zéro.
 */

export const PAGE_ENTRANCE_MEMORY_MAX = 200;

const entered = new Set<string>();

/** L'identité d'une page pour son entrée : son chemin et sa requête (un filtre est une autre page). */
export function pageEntranceId(location: { pathname: string; search: string } | null | undefined): string | undefined {
  return location ? `${location.pathname}${location.search}` : undefined;
}

export function hasPageEntered(id: string | undefined): boolean {
  return id !== undefined && entered.has(id);
}

export function markPageEntered(id: string | undefined): void {
  if (id === undefined) return;
  entered.delete(id);
  entered.add(id);
  if (entered.size > PAGE_ENTRANCE_MEMORY_MAX) {
    const oldest = entered.values().next().value;
    if (oldest !== undefined) entered.delete(oldest);
  }
}

/** Pour les tests. */
export function resetPageEntranceMemoryForTests(): void {
  entered.clear();
}
