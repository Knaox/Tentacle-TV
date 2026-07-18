/**
 * Accès React à la préférence Liquid Glass, et niveau de verre effectivement
 * rendu par le moteur courant.
 */

import { useCallback, useSyncExternalStore } from "react";
import { resolveGlassLevel, supportsBackdropSvgFilter, type GlassLevel } from "@tentacle-tv/ui";

import {
  getLiquidGlass,
  setLiquidGlass,
  subscribeLiquidGlass,
} from "./liquidGlass";

export interface LiquidGlassValue {
  /** Choix de l'utilisateur, persisté. */
  enabled: boolean;
  /**
   * true si le moteur exécute réellement la réfraction. False sur WKWebView
   * (macOS), WebKitGTK (Linux), Safari et Firefox — le toggle y reste utile,
   * il pilote alors le flou enrichi.
   */
  supported: boolean;
  /** Ce qui sera effectivement rendu. */
  level: GlassLevel;
  setEnabled: (next: boolean) => void;
}

export function useLiquidGlass(): LiquidGlassValue {
  const enabled = useSyncExternalStore(
    subscribeLiquidGlass,
    getLiquidGlass,
    getLiquidGlass,
  );

  const setEnabled = useCallback((next: boolean) => {
    setLiquidGlass(next);
  }, []);

  return {
    enabled,
    supported: supportsBackdropSvgFilter(),
    level: resolveGlassLevel(enabled),
    setEnabled,
  };
}
