/**
 * Octave (mobile) — la porte de la musique gardée et l'extension, telles que la
 * portée les pose (`MusicOfflineScope`). Module LÉGER : les rangées et les
 * boutons le lisent sans tirer la connectivité ni les requêtes de droits. Hors
 * portée : rien (aucun bouton, aucune marque).
 */

import { createContext, useContext } from "react";
import type { MusicProvider } from "@tentacle-tv/api-client";
import { NO_MUSIC_OFFLINE, type MusicOfflineSurface } from "@tentacle-tv/offline-core/music";

export interface MusicOfflineContextValue {
  surface: MusicOfflineSurface;
  provider: MusicProvider | null;
}

export const MusicOfflineContext = createContext<MusicOfflineContextValue>({ surface: NO_MUSIC_OFFLINE, provider: null });

export function useOfflineSurface(): MusicOfflineSurface {
  return useContext(MusicOfflineContext).surface;
}

export function useMusicOfflineContext(): MusicOfflineContextValue {
  return useContext(MusicOfflineContext);
}
