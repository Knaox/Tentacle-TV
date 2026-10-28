/**
 * Octave (mobile) — la portée de la musique gardée, montée UNE fois autour de la
 * coquille d'Octave (registre de m1, `providers`) : la porte calculée une fois
 * (`useMusicOfflineSurface`), la tenue à jour des playlists et des titres likés
 * gardés (réglage d'appareil, allumé par défaut), les identités changées. Chaque
 * bouton, marque et rangée la lit (`useOfflineSurface`) sans requête de plus.
 */

import { useMemo, type ReactNode } from "react";
import { MusicOfflineContext } from "./musicOfflineContext";
import { useKeptAutoSync } from "./useKeptAutoSync";
import { useKeptRenames } from "./useKeptRenames";
import { useMusicOfflineProvider } from "./useMusicOfflineProvider";
import { useMusicOfflineSurface } from "./useMusicOfflineSurface";
import { useAutoSyncOn } from "./autoSyncSetting";

export function MusicOfflineScope({ children }: { children: ReactNode }) {
  const provider = useMusicOfflineProvider();
  const surface = useMusicOfflineSurface(provider);
  useKeptAutoSync(surface, provider, useAutoSyncOn());
  useKeptRenames(surface, provider);
  const value = useMemo(() => ({ surface, provider }), [surface, provider]);
  return <MusicOfflineContext.Provider value={value}>{children}</MusicOfflineContext.Provider>;
}
