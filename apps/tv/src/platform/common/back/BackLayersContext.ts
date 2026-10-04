import { createContext } from "react";
import type { BackLayers } from "@tentacle-tv/tv-core";

/**
 * La pile des couches du Retour de l'écran (`nav/backLayers`, tv-core), que
 * pose la portée de la plateforme autour de chaque écran — `TvosBackScope`
 * (Apple TV) ou `AndroidBackScope` (Android TV). `null` hors d'une portée :
 * l'ancienne UI, où rien ne s'inscrit.
 *
 * Commune aux deux adaptateurs : elle ne touche à aucune API native, et les
 * écrans s'y inscrivent de la même façon (`useBackLayer`, `useBackLayers`).
 */
export const BackLayersContext = createContext<BackLayers | null>(null);
