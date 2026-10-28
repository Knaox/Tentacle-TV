import { useMemo } from "react";
import type { WideSettingsContext } from "@tentacle-tv/shared";
import { desktopPlatform, isDesktopApp, supportsMpv } from "../../../desktop/bridge";
import { supportsBackgroundTransfers, supportsLinuxSession } from "../../../desktop/capabilities";
import { useDownloadsVisibility } from "../../../downloads/useDownloadState";
import { useOctaveAvailability } from "../../../music/octave/mode/useOctaveAvailability";
import { useLiquidGlass } from "../../../theme/useLiquidGlass";
import { useWebSettingsContext } from "../../../mirror/screens/settings/catalog/useWebSettingsContext";

/**
 * Le contexte du catalogue des réglages du web LARGE : celui du web étroit
 * (droits, Famille, capacités, hors ligne, session de profil — la même
 * source), plus ce que seule la coquille de bureau sait (lecteur natif,
 * verre de macOS, session graphique de Linux, téléchargements) et Octave.
 * `vigieReco` reste inconnu : le savoir coûterait une requête au rail ; la
 * ligne se tait d'elle-même dans sa page si le serveur ne sait pas.
 */
export function useWideSettingsContext(): WideSettingsContext {
  const base = useWebSettingsContext();
  const glass = useLiquidGlass();
  const octave = useOctaveAvailability().available;
  const downloads = useDownloadsVisibility().visible;
  const desktopApp = isDesktopApp();
  const platform = desktopPlatform();
  const mpv = supportsMpv();

  return useMemo(() => ({
    ...base,
    desktopApp,
    glassToggle: glass.toggleVisible,
    octave,
    downloads: desktopApp && downloads,
    backgroundTransfers: supportsBackgroundTransfers(),
    hardwareDecoding: mpv && platform !== null,
    hdrAuto: mpv && platform === "windows",
    linuxSession: platform === "linux" && supportsLinuxSession(),
  }), [base, desktopApp, glass.toggleVisible, octave, downloads, mpv, platform]);
}
