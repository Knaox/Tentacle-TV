/**
 * Octave — le cache gardé, lu AU DÉMARRAGE : sur un lancement en Octave, la
 * lecture du disque (IndexedDB) part avec le chargement du module ; `main.tsx`
 * attend (bornée) qu'elle et le module d'Octave soient là pour peindre la
 * première image. La mécanique est commune au mobile (`@tentacle-tv/api-client`,
 * `octaveCacheRuntime.ts`) ; ici, le stockage du navigateur.
 */

import { configureOctaveCacheBackend } from "@tentacle-tv/api-client";
import { indexedDbBackend } from "../data/persist/octaveCacheStore";

configureOctaveCacheBackend(() => indexedDbBackend());

export {
  OCTAVE_BOOT_BUDGET_MS, octaveCacheBackend, setOctaveCacheBackend, preloadOctaveCache, takePreloadedOctaveCache, takePendingOctavePreload, withinBudget,
} from "@tentacle-tv/api-client";
