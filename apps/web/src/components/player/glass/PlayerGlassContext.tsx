/**
 * Le mode d'habillage du lecteur, décidé UNE fois par `DesktopPlayer` et lu par
 * tout ce qui se pose sur la vidéo : barres, panneaux, pilule de saut, encarts.
 *
 * Sans fournisseur — le lecteur web, les aperçus des réglages, le miroir —, le
 * mode vaut `legacy` : ces surfaces ne changent pas d'un pixel. Le contexte
 * traverse les portails React, donc la fenêtre du PiP reçoit le même mode.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLiquidGlass } from "../../../theme/useLiquidGlass";
import { decidePlayerGlassMode, type PlayerGlassMode } from "./playerGlassMode";
import { useNativeGlassAvailable, videoUnderWindow } from "./nativeGlassPort";

/** Exporté pour les bancs de composants ; le lecteur passe par `PlayerGlassProvider`. */
export const PlayerGlassModeContext = createContext<PlayerGlassMode>("legacy");

/**
 * Clé de l'aperçu de développement (`"preview"`), lue dans les paquets
 * instrumentés seulement. Elle nomme une entrée de stockage : ne pas la renommer.
 */
export const PLAYER_GLASS_PREVIEW_KEY = "tentacle_dev_player_glass";

/** Figé au chargement : un rechargement suffit pour basculer l'aperçu. */
const DEV_PREVIEW = ((): boolean => {
  const instrumented = import.meta.env.DEV || (typeof __PLAYER_DEBUG__ !== "undefined" && __PLAYER_DEBUG__);
  if (!instrumented) return false;
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
  const mode = useMemo(
    () => decidePlayerGlassMode({ enabled, nativeAvailable, videoUnderWindow: videoUnderWindow(), devPreview: DEV_PREVIEW }),
    [enabled, nativeAvailable],
  );
  return <PlayerGlassModeContext.Provider value={mode}>{children}</PlayerGlassModeContext.Provider>;
}

export function usePlayerGlassMode(): PlayerGlassMode {
  return useContext(PlayerGlassModeContext);
}
