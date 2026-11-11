import { createContext } from "react";

/**
 * La page rendue ici l'est-elle sous une ENVELOPPE DE ROUTE (`AnimatedRoutes`, `AnimatedOutlet`) ?
 * Posé par elles, lu par `PageTransition` : sous une route, l'entrée d'une page est celle de la
 * route — la page quittée s'efface par-dessus elle (`RouteExit`) —, et la page n'en joue aucune.
 *
 * Un contexte à nous, et pas le routeur lu dans `PageTransition` : vingt-neuf tests remplacent
 * `react-router-dom` par un module partiel, et une page rendue hors de ces deux enveloppes
 * (test, banc, vue d'Octave) n'est simplement sous aucune route — elle entre en fondu.
 */
export const PageEntranceContext = createContext(false);
