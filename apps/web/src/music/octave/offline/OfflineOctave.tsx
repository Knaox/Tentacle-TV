/**
 * Octave SANS RÉSEAU (bureau) : ce qui est gardé sur l'appareil s'écoute,
 * rien d'autre ne s'affiche. Trois montages d'une ligne :
 *   - `App.tsx` : `octaveOfflineAware` — hors ligne, la route d'Octave n'est
 *     ouverte que si le compte de l'appareil a de la musique gardée (sinon `/`,
 *     comme avant) ;
 *   - `OctaveApp.tsx` : `useKeptAwareAvailability` (le serveur ne peut pas dire
 *     « il y a une bibliothèque musique » hors ligne : ce qui est gardé le dit)
 *     et `OfflineOctaveRoutes` (une seule vue, « Sur cet appareil ») ;
 *   - la barre latérale : `DeviceNavItem.tsx`.
 */

import { Fragment, type ReactElement, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useOfflineMode } from "../../../offline/useOfflineMode";
import type { OctaveAvailability } from "../mode/useOctaveAvailability";
import { octavePaths } from "../octavePaths";
import { DeviceView } from "./DeviceView";
import { useKeptMusic } from "./useKeptMusic";

/** Le compte de l'appareil a-t-il de la musique gardée EN ENTIER (lisible sans réseau) ? `null` : on ne sait pas encore. */
function useHasPlayableKept(): boolean | null {
  const kept = useKeptMusic();
  if (!kept.loaded) return null;
  return kept.tracks.some((k) => k.status === "complete");
}

/**
 * TOUJOURS rendue, active ou non : la place de la route dans l'arbre ne change
 * jamais au passage hors ligne. Ajoutée seulement hors ligne, elle faisait
 * REMONTER tout Octave à la coupure du serveur — lecteur compris : la musique
 * gardée s'arrêtait au moment précis où elle devait continuer (vu au banc).
 */
function KeptOnlyGate({ active, children }: { active: boolean; children: ReactElement }) {
  const has = useHasPlayableKept();
  if (!active) return children;
  if (has === null) return null;
  return has ? children : <Navigate to="/" replace />;
}

/** La route d'Octave dans `App.tsx` : en ligne telle quelle ; hors ligne, seulement avec de la musique gardée. */
export function octaveOfflineAware(offlineMode: boolean, element: ReactElement): ReactElement {
  return <KeptOnlyGate active={offlineMode}>{element}</KeptOnlyGate>;
}

/** La disponibilité d'Octave : hors ligne, ce qui est gardé sur l'appareil la donne. */
export function useKeptAwareAvailability(base: OctaveAvailability): OctaveAvailability {
  const offline = useOfflineMode();
  const has = useHasPlayableKept();
  if (!offline) return base;
  if (has === null) return { available: false, settled: false };
  return has ? { available: true, settled: true } : base;
}

/** Les routes d'Octave : hors ligne, « Sur cet appareil » seulement. */
export function OfflineOctaveRoutes({ children }: { children: ReactNode }) {
  const offline = useOfflineMode();
  if (!offline) return <Fragment>{children}</Fragment>;
  return (
    <Routes>
      <Route path="device" element={<DeviceView />} />
      {/* Une adresse ABSOLUE : relative, elle s'ajoutait à la route courante (`…/album/x/device/device…`). */}
      <Route path="*" element={<Navigate to={octavePaths.device} replace />} />
    </Routes>
  );
}
