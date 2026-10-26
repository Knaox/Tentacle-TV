/**
 * Octave — l'exécutant de la tenue à jour, monté dans la portée du mode
 * (`MusicOfflineScope`, une ligne). Ne tourne que si le réglage de l'appareil est
 * allumé, que le compte de l'appareil peut garder (jamais une session de profil :
 * `keepRules.ts`) et que le serveur répond.
 *
 * Quand (`syncRunner.ts`) : à l'ouverture et à la RECONNEXION, un relevé complet ;
 * aux évènements `music:*` qui comptent, la playlist concernée et les jumeaux ; à
 * chaque fin de transfert, la règle rejouée sans rien demander — c'est là qu'une
 * copie remplacée part, une fois la nouvelle complète. Jamais un relevé en boucle.
 */

import { useEffect, useRef } from "react";
import { useConnectivity } from "../../../../offline/useConnectivity";
import { useOctaveProvider } from "../../mode/useOctaveProvider";
import { canKeepTrack, type MusicOfflineSurface } from "../keepRules";
import { keptMusicState, refreshKeptMusic, subscribeKeptMusic } from "../keptMusicStore";
import { keepTracks, removeKeptFiles, saveKeptCollections } from "../keepMusic";
import { useAutoSync } from "./autoSyncStore";
import { onSyncSignal } from "./syncSignals";
import { readPlaylists, readTwins, readWanted } from "./syncInputs";
import { SyncRunner } from "./syncRunner";

/** Les signaux en rafale (une playlist modifiée trois fois) ne font qu'un passage. */
const SIGNAL_DELAY_MS = 2_000;

/**
 * La tenue à jour tourne-t-elle ? Le réglage allumé, le droit de garder du compte
 * de l'appareil (jamais une session de profil, jamais le web) et un serveur qui
 * répond — hors ligne elle s'arrête, et la reconnexion la relance (relevé complet).
 */
export function autoSyncActive(on: boolean, surface: MusicOfflineSurface, connectivity: string): boolean {
  return on && surface.library && connectivity === "online";
}

export function useKeptAutoSync(surface: MusicOfflineSurface): void {
  const on = useAutoSync();
  const provider = useOctaveProvider();
  const { state } = useConnectivity();
  const active = autoSyncActive(on, surface, state);
  const live = useRef({ surface, provider });
  live.current = { surface, provider };

  useEffect(() => {
    if (!active) return;
    const runner = new SyncRunner({
      refresh: refreshKeptMusic,
      state: keptMusicState,
      readPlaylists: (collections, only) => readPlaylists(collections, live.current.provider, only),
      readTwins,
      readWanted,
      canKeep: (track) => canKeepTrack(track, live.current.surface),
      apply: async (actions) => {
        // Garder d'abord, réécrire ce qui retient, retirer en dernier : jamais un titre sans fichier.
        if (actions.keep.length > 0) await keepTracks(actions.keep, live.current.provider, null);
        await saveKeptCollections(actions.saveCollections, actions.removeCollections);
        await removeKeptFiles(actions.removeFileIds);
        await refreshKeptMusic();
      },
      delayMs: SIGNAL_DELAY_MS,
    });
    runner.start();
    const offSignals = onSyncSignal((signal) => runner.signal(signal));
    let done = -1;
    const offKept = subscribeKeptMusic(() => {
      const now = keptMusicState().tracks.filter((t) => t.status === "complete").length;
      if (now === done) return;
      done = now;
      runner.transferred();
    });
    return () => {
      runner.stop();
      offSignals();
      offKept();
    };
  }, [active]);
}
