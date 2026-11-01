/**
 * Octave — la porte de la musique gardée, calculée UNE fois pour le mode
 * (`useMusicOfflineSurface`) et lue par chaque bouton, marque et rangée
 * (`offlineSurfaceContext.ts`) sans requête ni abonnement de plus.
 */

import type { ReactNode } from "react";
import { OfflineSurfaceContext } from "./offlineSurfaceContext";
import { useMusicOfflineSurface } from "./useMusicOfflineSurface";
import { useKeptAutoSync } from "./autosync/useKeptAutoSync";
import { useKeptRenames } from "./useKeptRenames";
import { useKeptCoverKeeper } from "./keptCovers/useKeptCoverKeeper";
import { useOctaveOrderSync } from "./orderSync/useOctaveOrderSync";

export function MusicOfflineScope({ children }: { children: ReactNode }) {
  const surface = useMusicOfflineSurface();
  // La tenue à jour des playlists gardées (réglage d'appareil, allumé par défaut).
  useKeptAutoSync(surface);
  // Un titre importé gardé sous sa fiche d'hier, reconnu sous sa clé d'aujourd'hui.
  useKeptRenames(surface);
  // La jaquette en ligne de chaque playlist gardée, gardée elle aussi (« Sur cet appareil » la montre à l'identique).
  useKeptCoverKeeper(surface);
  // Les ordres changés sans réseau partent au retour ; la copie gardée des ordres suit ce qui change ailleurs.
  useOctaveOrderSync();
  return <OfflineSurfaceContext.Provider value={surface}>{children}</OfflineSurfaceContext.Provider>;
}
