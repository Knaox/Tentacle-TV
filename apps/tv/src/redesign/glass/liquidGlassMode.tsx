import { createContext, useContext, useMemo, type ReactNode } from "react";
import { NATIVE_GLASS_SUPPORTED } from "./nativeGlass";

/**
 * Le réglage « Liquid Glass » vu par les vues de la refonte.
 *
 * Même sens que sur le bureau et le mobile (clé `tentacle_liquid_glass`,
 * activé par défaut) : activé, les surfaces de verre prennent le verre natif
 * quand la plateforme l'offre (tvOS 26), sa simulation sinon ; coupé, elles
 * passent au verre ENRICHI (liseré, reflet, saturation) — jamais à une surface
 * opaque nue.
 *
 * Les vues ne lisent pas le stockage : elles reçoivent la valeur de ce
 * fournisseur. L'app le branchera sur la clé persistée (tâche à part) ; le banc
 * le branche sur son interrupteur.
 */

export const LIQUID_GLASS_STORAGE_KEY = "tentacle_liquid_glass";

/** Comment une surface de verre se rend : `native` (UIGlassEffect, tvOS 26),
 *  `simulated` (Liquid Glass demandé, système trop ancien), `enriched`
 *  (réglage coupé). */
export type GlassRendering = "native" | "simulated" | "enriched";

interface LiquidGlassMode {
  enabled: boolean;
  allowNative: boolean;
}

const LiquidGlassContext = createContext<LiquidGlassMode>({ enabled: true, allowNative: true });

export function LiquidGlassProvider({ enabled, allowNative, children }: {
  enabled: boolean;
  /** Faux : la simulation même là où le verre natif existe — le banc s'en sert
   *  pour montrer le repli des tvOS < 26. Absent : hérité (vrai à la racine). */
  allowNative?: boolean;
  children: ReactNode;
}) {
  const parent = useContext(LiquidGlassContext);
  const native = allowNative ?? parent.allowNative;
  const value = useMemo(() => ({ enabled, allowNative: native }), [enabled, native]);
  return <LiquidGlassContext.Provider value={value}>{children}</LiquidGlassContext.Provider>;
}

/** Vrai quand le Liquid Glass est demandé (défaut). */
export function useLiquidGlassEnabled(): boolean {
  return useContext(LiquidGlassContext).enabled;
}

/** Le rendu effectif du verre : le réglage, croisé avec ce que sait le système. */
export function useGlassRendering(): GlassRendering {
  const { enabled, allowNative } = useContext(LiquidGlassContext);
  if (!enabled) return "enriched";
  return allowNative && NATIVE_GLASS_SUPPORTED ? "native" : "simulated";
}
