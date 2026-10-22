/**
 * Le verre de la FENÊTRE : bandeau des feux, barre de navigation, barres
 * latérales des réglages et de l'administration, menus de la barre.
 *
 * Il suit le MODE Liquid Glass (`theme/liquidGlassMode.ts`) : `native` —
 * bureau Electron sur macOS 26, pont du verre natif présent, réglage allumé —
 * et rien d'autre. Partout ailleurs (web, Windows, Linux, macOS < 26, réglage
 * coupé, `TENTACLE_LIQUID_GLASS=off`), aucune règle de `windowGlass*.css` ne
 * s'applique : elles sont toutes portées par `[data-liquid-glass="native"]`,
 * et le rendu d'avant est tenu par construction, au pixel près (test du lot,
 * `theme/liquidGlassTokens.test.ts`, et `windowGlass.test.ts`).
 *
 * Ce module ne sert qu'au JavaScript qui en dépend : monter l'effet de bord de
 * défilement (`HostTitleBar`), plafonner l'assise de la capsule et dire à
 * l'effet qu'une barre est là (`TopNav`).
 */

import { useSyncExternalStore } from "react";

import { getLiquidGlassMode, subscribeLiquidGlassMode } from "../theme/liquidGlassMode";
import { hostTitleBar } from "./hostChrome";
import "./windowGlass.css";
import "./windowGlassNav.css";
import "./windowGlassSidebar.css";

/** Le verre de fenêtre est-il rendu maintenant ? */
export function windowGlassActive(): boolean {
  // `native` implique la coquille macOS ; le bandeau est redit par prudence :
  // sans lui, pas de barre d'outils à habiller.
  return hostTitleBar() && getLiquidGlassMode() === "native";
}

/** Version React : suit le réglage en direct, sans rechargement. */
export function useWindowGlass(): boolean {
  return useSyncExternalStore(subscribeLiquidGlassMode, windowGlassActive, windowGlassActive);
}
