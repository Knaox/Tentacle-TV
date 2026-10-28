/**
 * Octave — la porte de la musique gardée, telle que la portée la pose
 * (`MusicOfflineScope`). Module LÉGER : les rangées et les menus le lisent sans
 * tirer la connectivité ni les requêtes de droits. Hors portée : rien.
 */

import { createContext, useContext } from "react";
import { NO_MUSIC_OFFLINE, type MusicOfflineSurface } from "@tentacle-tv/offline-core/music";

export const OfflineSurfaceContext = createContext<MusicOfflineSurface>(NO_MUSIC_OFFLINE);

export function useOfflineSurface(): MusicOfflineSurface {
  return useContext(OfflineSurfaceContext);
}
