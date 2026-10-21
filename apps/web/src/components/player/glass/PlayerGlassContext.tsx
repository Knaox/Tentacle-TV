/**
 * Le mode d'habillage du lecteur, décidé UNE fois par `DesktopPlayer` et lu par
 * tout ce qui se pose sur la vidéo : barres, panneaux, pilule de saut, encarts.
 *
 * Sans fournisseur — le lecteur web, les aperçus des réglages, le miroir —, le
 * mode vaut `legacy` : ces surfaces ne changent pas d'un pixel. Le contexte
 * traverse les portails React, donc la fenêtre du PiP reçoit le même mode.
 */

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLiquidGlass } from "../../../theme/useLiquidGlass";
import { setLiquidGlass } from "../../../theme/liquidGlass";
import { decidePlayerGlassMode, type PlayerGlassMode } from "./playerGlassMode";
import { useNativeGlassAvailable, videoUnderWindow } from "./nativeGlassPort";
import { usePictureInPicture } from "../../../pictureInPicture/pictureInPictureContext";

/** Exporté pour les bancs de composants ; le lecteur passe par `PlayerGlassProvider`. */
export const PlayerGlassModeContext = createContext<PlayerGlassMode>("legacy");

/**
 * Clé de l'aperçu de développement (`"preview"`), lue dans les paquets
 * instrumentés seulement. Elle nomme une entrée de stockage : ne pas la renommer.
 */
export const PLAYER_GLASS_PREVIEW_KEY = "tentacle_dev_player_glass";

const INSTRUMENTED = import.meta.env.DEV || (typeof __PLAYER_DEBUG__ !== "undefined" && __PLAYER_DEBUG__);

/**
 * Paquets instrumentés seulement : le banc coupe et rallume le réglage EN PLEINE
 * LECTURE (le lecteur couvre la fenêtre, Réglages n'y est pas atteignable).
 * Le geste est celui de l'interrupteur de Réglages › Apparence, rien de plus.
 */
if (INSTRUMENTED && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__tentaclePlayerGlass = { setLiquidGlass };
}

/** Figé au chargement : un rechargement suffit pour basculer l'aperçu. */
const DEV_PREVIEW = ((): boolean => {
  if (!INSTRUMENTED) return false;
  try {
    return localStorage.getItem(PLAYER_GLASS_PREVIEW_KEY) === "preview";
  } catch {
    return false;
  }
})();

export function PlayerGlassProvider({ children }: { children: ReactNode }) {
  // Le réglage se suit EN DIRECT : le couper pendant la lecture rend aussitôt
  // l'habillage d'avant (et retire les régions natives).
  const { enabled } = useLiquidGlass();
  const nativeAvailable = useNativeGlassAvailable();
  // Le PiP : le lecteur est caché dans la fenêtre principale et ses contrôles
  // vivent dans la fenêtre du PiP, que les régions de la page ne savent pas
  // viser (elles se poseraient dans la fenêtre PRINCIPALE). D'ici là, rien de
  // natif pendant le PiP : l'habillage d'avant, démonté de toute région.
  const { active: inPip } = usePictureInPicture();
  const mode = useMemo(
    () => inPip ? "legacy" : decidePlayerGlassMode({ enabled, nativeAvailable, videoUnderWindow: videoUnderWindow(), devPreview: DEV_PREVIEW }),
    [enabled, nativeAvailable, inPip],
  );
  // Les feuilles du lecteur ne s'allument que sous `data-liquid-glass="native"` (règle du lot,
  // `liquidGlassTokens.test.ts`) ; l'aperçu de développement pose son propre drapeau.
  useEffect(() => {
    if (mode !== "preview") return undefined;
    const root = document.documentElement;
    root.setAttribute("data-lgp-preview", "on");
    return () => root.removeAttribute("data-lgp-preview");
  }, [mode]);
  return <PlayerGlassModeContext.Provider value={mode}>{children}</PlayerGlassModeContext.Provider>;
}

export function usePlayerGlassMode(): PlayerGlassMode {
  return useContext(PlayerGlassModeContext);
}
