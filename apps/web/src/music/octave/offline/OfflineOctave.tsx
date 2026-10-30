/**
 * Octave SANS RÉSEAU (bureau) : ce qui est gardé sur l'appareil s'écoute,
 * rien d'autre ne s'affiche — `OctaveApp.tsx` monte `OfflineOctaveRoutes`
 * (une seule vue, « Sur cet appareil »), la barre latérale `DeviceNavItem.tsx`.
 *
 * Le mode est celui de l'APPAREIL, hors ligne compris (lot « fl », 30/10) : la
 * porte d'Octave ne rend plus la main à Tentacle faute de musique gardée (une
 * panne n'est pas une absence, `useOctaveLaunchAvailability`) — « Sur cet
 * appareil », vide, le dit, et « Films et séries » ramène aux vidéos gardées.
 * La route d'Octave garde sa place dans l'arbre au passage hors ligne : rien ne
 * remonte, le lecteur de la musique gardée continue.
 */

import { Fragment, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useOfflineMode } from "../../../offline/useOfflineMode";
import { octavePaths } from "../octavePaths";
import { DeviceView } from "./DeviceView";

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
