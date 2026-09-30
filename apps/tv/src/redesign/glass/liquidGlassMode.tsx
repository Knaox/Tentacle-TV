import { createContext, useContext, type ReactNode } from "react";

/**
 * Le réglage « Liquid Glass » vu par les vues de la refonte.
 *
 * Même sens que sur le bureau et le mobile (clé `tentacle_liquid_glass`,
 * activé par défaut) : activé, les surfaces de verre prennent le verre natif
 * quand la plateforme l'offre ; coupé, elles passent au verre ENRICHI (liseré,
 * reflet, saturation) — jamais à une surface opaque nue.
 *
 * Les vues ne lisent pas le stockage : elles reçoivent la valeur de ce
 * fournisseur. L'app le branchera sur la clé persistée (tâche à part) ; le banc
 * le branche sur son interrupteur.
 */

export const LIQUID_GLASS_STORAGE_KEY = "tentacle_liquid_glass";

const LiquidGlassContext = createContext<boolean>(true);

export function LiquidGlassProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <LiquidGlassContext.Provider value={enabled}>{children}</LiquidGlassContext.Provider>;
}

/** Vrai quand le Liquid Glass est demandé (défaut). */
export function useLiquidGlassEnabled(): boolean {
  return useContext(LiquidGlassContext);
}
