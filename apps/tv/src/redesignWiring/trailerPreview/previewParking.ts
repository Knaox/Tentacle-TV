import { useEffect, useState } from "react";
import { createPreviewParking, type PreviewParking } from "@tentacle-tv/tv-core";
import { PLAYER_TIMERS } from "../../hooks/playerTimers";
import { remoteInput } from "../../platform/input";

/**
 * Le garage des vidéos d'aperçu de l'appareil (tv-core `trailerPreviewPark`) :
 * une vidéo finie de sortir reste montée, en pause et invisible, et ne se
 * démonte qu'au CALME de la télécommande — jamais au milieu d'une rafale de
 * flèches, où le démontage du lecteur (fil principal) faisait accrocher le
 * focus. Un autre aperçu qui prend la place unique la libère aussitôt.
 */
export const previewParking: PreviewParking = createPreviewParking((listener) => remoteInput.observe(listener), PLAYER_TIMERS);

/**
 * La vidéo GARÉE d'une session : `mounted`, ce que la machine monte (la
 * vidéo du cycle en cours, ou `null`) ; quand elle la lâche, la vidéo reste
 * rendue — même clé, même lecteur natif — jusqu'à sa libération. Une autre
 * vidéo montée la remplace. Rend ce qu'il faut rendre.
 */
export function useParkedVideo<T extends object>(mounted: T | null): T | null {
  const [previous, setPrevious] = useState(mounted);
  const [parked, setParked] = useState<T | null>(null);
  // Garée DANS le rendu même où la machine la lâche : jamais une image sans elle (démontée puis remontée).
  if (mounted !== previous) {
    setPrevious(mounted);
    setParked(mounted ? null : previous);
  }
  useEffect(() => (parked ? previewParking.park(() => setParked(null)) : undefined), [parked]);
  return mounted ?? parked;
}
