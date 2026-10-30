/**
 * Au retour en ligne, relancer ce que la panne a fait ÉCHOUER et que l'écran
 * attend encore (requêtes ACTIVES restées en erreur). Sans cela, la
 * configuration du serveur (`["app-config", serveur]`, la source des
 * CAPACITÉS) gardait l'erreur d'un démarrage à froid hors ligne : de retour en
 * ligne, capacités vides — tout ce qu'elles gardent restait caché, et le mode
 * d'Octave ne savait plus distinguer une panne d'une absence (vu au banc du
 * bureau, lot « fl », 30/10). Rien d'inactif, rien de réussi : aucune requête
 * de plus au repos.
 */

import type { Query, QueryClient } from "@tanstack/react-query";

export function isFailedAndWatched(query: Query): boolean {
  return query.state.status === "error" && query.getObserversCount() > 0;
}

export function retryFailedQueries(client: QueryClient): Promise<void> {
  return client.refetchQueries({ type: "active", predicate: isFailedAndWatched });
}
