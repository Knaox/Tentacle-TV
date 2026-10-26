/**
 * Accès React à la préférence Liquid Glass, au mode rendu (`liquidGlassMode.ts`)
 * et au niveau de verre du moteur courant.
 */

import { useCallback, useSyncExternalStore } from "react";
import { resolveGlassLevel, supportsBackdropSvgFilter, type GlassLevel } from "@tentacle-tv/ui";

import {
  getLiquidGlass,
  setLiquidGlass,
  subscribeLiquidGlass,
} from "./liquidGlass";
import {
  getLiquidGlassMode,
  liquidGlassToggleVisible,
  nativeGlassBridge,
  nativeGlassRefractsVideo,
  subscribeLiquidGlassMode,
  type LiquidGlassMode,
} from "./liquidGlassMode";

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
  /** Le mode posé sur `<html data-liquid-glass>`. */
  mode: LiquidGlassMode;
  /** La coquille offre le verre natif de macOS 26. */
  nativeSupported: boolean;
  /** Le verre natif voit la vidéo (montage `fenetre`) : le lecteur peut s'en vêtir. */
  refractsVideo: boolean;
  /** L'interrupteur de Réglages › Apparence se montre-t-il ? */
  toggleVisible: boolean;
  setEnabled: (next: boolean) => void;
}

/** Le mode seul, pour une surface : pas d'abonnement à la préférence brute. */
export function useLiquidGlassMode(): LiquidGlassMode {
  return useSyncExternalStore(
    subscribeLiquidGlassMode,
    getLiquidGlassMode,
    getLiquidGlassMode,
  );
}

export function useLiquidGlass(): LiquidGlassValue {
  const enabled = useSyncExternalStore(
    subscribeLiquidGlass,
    getLiquidGlass,
    getLiquidGlass,
  );
  const mode = useLiquidGlassMode();

  const setEnabled = useCallback((next: boolean) => {
    setLiquidGlass(next);
  }, []);

  const nativeSupported = nativeGlassBridge() !== null;

  return {
    enabled,
    supported: supportsBackdropSvgFilter(),
    level: resolveGlassLevel(enabled),
    mode,
    nativeSupported,
    refractsVideo: nativeGlassRefractsVideo(),
    toggleVisible: liquidGlassToggleVisible({ nativeSupported }),
    setEnabled,
  };
}
