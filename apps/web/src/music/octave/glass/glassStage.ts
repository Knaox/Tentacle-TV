/**
 * Octave en Liquid Glass — « suis-je dans la coquille de bureau en verre ? » :
 * vrai seulement sous `OctaveShell` de bureau en mode natif. Les composants
 * partagés avec la coquille étroite (rangées, pastilles) n'y prennent leur PEAU
 * de verre que là — jamais d'autres tailles : ailleurs, leur DOM d'avant.
 */

import { createContext, useContext } from "react";

export const OctaveGlassStageContext = createContext(false);

/** Vrai dans la scène de verre d'Octave. */
export function useOctaveGlassStage(): boolean {
  return useContext(OctaveGlassStageContext);
}
