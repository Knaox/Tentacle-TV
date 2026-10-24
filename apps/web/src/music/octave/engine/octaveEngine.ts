/**
 * Octave — POINT DE BRANCHEMENT du moteur audio.
 *
 * Le moteur réel (libmpv sur le bureau, `<audio>` sur le web) est celui de
 * l'agent 2, exposé dans `apps/web/src/music/engine/` sous le contrat
 * `AudioEnginePort`. L'interface n'en connaît QUE le port : à l'intégration,
 * cette fonction rend le moteur de l'agent 2, et rien d'autre ne change.
 *
 * D'ici là : le moteur FACTICE à temps simulé (aucun son), pour construire et
 * mesurer l'interface.
 */

import type { AudioEnginePort } from "@tentacle-tv/shared/music";
import { createFakeEngine } from "@tentacle-tv/shared/octave/testing";

export function createOctaveEngine(): AudioEnginePort {
  const engine = createFakeEngine();
  engine.simulate(true);
  return engine;
}
