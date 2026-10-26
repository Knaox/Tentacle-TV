/**
 * Octave en Liquid Glass — « suis-je dans la scène de verre ? » : vrai seulement
 * sous `OctaveGlassStage` (bureau, mode natif). Les composants partagés avec la
 * coquille étroite (tête, tableau, rangées, pastilles) n'y prennent leur forme de
 * verre que là : ailleurs, leur DOM d'avant, à l'identique.
 */

import { createContext, useContext } from "react";

export const OctaveGlassStageContext = createContext(false);

/** Vrai dans la scène de verre d'Octave. */
export function useOctaveGlassStage(): boolean {
  return useContext(OctaveGlassStageContext);
}
