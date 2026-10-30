/**
 * Octave (mobile) — l'onglet « Hors ligne » (lot fl, 30/10) : montré seulement derrière la porte du hors ligne
 * d'Octave (compte de l'appareil, droit `keepOffline`, jamais une session de profil — `useOfflineSurface`), et sa
 * PASTILLE tant que des titres partent (`keptTransfersRunning`). Un booléen lu dans le magasin : la barre ne se
 * redessine qu'à la bascule, jamais à chaque progression d'un transfert.
 */

import { useSyncExternalStore } from "react";
import { keptTransfersRunning } from "@tentacle-tv/offline-core/music";
import { keptMusicStore, subscribeKeptMusic } from "../offline/keptMusic";
import { useOfflineSurface } from "../offline/musicOfflineContext";

const readRunning = () => keptTransfersRunning(keptMusicStore.state().tracks);

export interface OfflineTabState {
  shown: boolean;
  running: boolean;
}

export function useOfflineTab(): OfflineTabState {
  const shown = useOfflineSurface().visible;
  const running = useSyncExternalStore(subscribeKeptMusic, readRunning, readRunning);
  return { shown, running: shown && running };
}
