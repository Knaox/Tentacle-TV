/**
 * Octave — la porte de la musique gardée, calculée UNE fois pour le mode
 * (`useMusicOfflineSurface`) et lue par chaque bouton, marque et rangée
 * (`offlineSurfaceContext.ts`) sans requête ni abonnement de plus.
 */

import type { ReactNode } from "react";
import { OfflineSurfaceContext } from "./offlineSurfaceContext";
import { useMusicOfflineSurface } from "./useMusicOfflineSurface";

export function MusicOfflineScope({ children }: { children: ReactNode }) {
  const surface = useMusicOfflineSurface();
  return <OfflineSurfaceContext.Provider value={surface}>{children}</OfflineSurfaceContext.Provider>;
}
