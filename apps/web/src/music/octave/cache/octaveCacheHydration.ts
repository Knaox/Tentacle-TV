/**
 * Octave — l'hydratation du cache gardé, une fois par identité et par
 * chargement de la page (mécanique commune au mobile : `@tentacle-tv/api-client`,
 * `octaveCacheRuntime.ts`). Sans React : ce module est dans le lot principal.
 */

import { bootOctaveCacheFor, type OctaveQueryClientLike } from "@tentacle-tv/api-client";
import "./octaveCacheBoot";
import { octaveOwner } from "./octaveOwner";

export { resetOctaveCacheHydration, isOctaveCacheHydrated, octaveCacheHydration } from "@tentacle-tv/api-client";

/**
 * Le démarrage en Octave, côté cache (`main.tsx`) : attendre au plus
 * `OCTAVE_BOOT_BUDGET_MS` la lecture du disque ET le module d'Octave, puis
 * rendre les pages de l'identité dans le cache — avant le premier rendu.
 */
export function bootOctaveCache(qc: OctaveQueryClientLike, alongside: Promise<unknown>): Promise<void> {
  return bootOctaveCacheFor(qc, octaveOwner(), alongside);
}
