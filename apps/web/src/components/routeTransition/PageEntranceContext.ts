import { createContext } from "react";

/**
 * L'identité d'entrée de la page rendue ici (`pageEntranceId` de son adresse), posée par ce qui
 * connaît cette adresse — `AnimatedRoutes` et `AnimatedOutlet` — et lue par `PageTransition`.
 *
 * Un contexte à nous, et pas le routeur lu dans `PageTransition` : vingt-neuf tests remplacent
 * `react-router-dom` par un module partiel, et une page rendue hors de ces deux enveloppes
 * (test, banc) n'a simplement pas d'identité — elle entre comme avant.
 */
export const PageEntranceContext = createContext<string | undefined>(undefined);
