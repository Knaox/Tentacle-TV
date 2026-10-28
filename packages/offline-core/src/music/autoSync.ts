/**
 * Octave — l'exécutant de la tenue à jour des playlists gardées, le MÊME sur le
 * bureau et le mobile : il branche le `SyncRunner` sur le magasin de la musique
 * gardée, les requêtes du serveur et les gestes du moteur. La plateforme le
 * démarre quand `autoSyncActive` le dit, et l'arrête dans le cas contraire.
 *
 * Quand (`syncRunner.ts`) : au démarrage et à la RECONNEXION, un relevé complet ;
 * aux évènements `music:*` qui comptent (`syncSignals.ts`), la playlist
 * concernée, les jumeaux, et — attentes de l'extension changées — les playlists
 * de la bibliothèque gardées ; à chaque fin de transfert, la règle rejouée sans
 * rien demander — c'est là qu'une copie remplacée part, une fois la nouvelle
 * complète. Jamais un relevé en boucle.
 */

import type { MusicTrack } from "@tentacle-tv/shared/music";
import type { KeepActions } from "./keepActions";
import type { ExternalKeepPath } from "./keepItems";
import { canKeepTrack, type MusicOfflineSurface } from "./keepRules";
import type { KeptMusicStore } from "./keptMusicStore";
import { onSyncSignal } from "./syncSignals";
import { readPendingWith, readPlaylistsWith, readTwinsWith, readWantedWith, type SyncProvider, type SyncReadApi } from "./syncInputs";
import { SyncRunner } from "./syncRunner";

/** Les signaux en rafale (une playlist modifiée trois fois) ne font qu'un passage. */
export const AUTOSYNC_SIGNAL_DELAY_MS = 2_000;

/**
 * La tenue à jour tourne-t-elle ? Le réglage allumé, le droit de garder du compte
 * de l'appareil (jamais une session de profil, jamais le web) et un serveur qui
 * répond — hors ligne elle s'arrête, et la reconnexion la relance (relevé complet).
 */
export function autoSyncActive(on: boolean, surface: MusicOfflineSurface, connectivity: string): boolean {
  return on && surface.library && connectivity === "online";
}

export interface AutoSyncDeps<P extends SyncProvider> {
  store: KeptMusicStore;
  actions: KeepActions;
  api: SyncReadApi<P>;
  /** Lus à chaque passage : ils changent sans relancer l'exécutant. */
  current(): { provider: P | null; surface: MusicOfflineSurface; externalPath: ExternalKeepPath | null };
  delayMs?: number;
}

/** Démarre la tenue à jour ; rend son arrêt. */
export function startKeptAutoSync<P extends SyncProvider>(deps: AutoSyncDeps<P>): () => void {
  const { store, actions, api } = deps;
  const runner = new SyncRunner({
    refresh: store.refresh,
    state: store.state,
    readPending: () => readPendingWith(api, deps.current().provider),
    readPlaylists: (collections, only, pending) => readPlaylistsWith(api, collections, deps.current().provider, only, pending),
    readTwins: (tracks) => readTwinsWith(api, tracks),
    readWanted: (tracks) => readWantedWith(api, tracks),
    canKeep: (track: MusicTrack) => canKeepTrack(track, deps.current().surface),
    apply: async (plan) => {
      // Garder d'abord, réécrire ce qui retient, retirer en dernier : jamais un titre sans fichier.
      if (plan.keep.length > 0) await actions.keepTracks(plan.keep, deps.current().externalPath, null);
      await actions.saveKeptCollections(plan.saveCollections, plan.removeCollections);
      await actions.removeKeptFiles(plan.removeFileIds);
      await store.refresh();
    },
    delayMs: deps.delayMs ?? AUTOSYNC_SIGNAL_DELAY_MS,
  });
  runner.start();
  const offSignals = onSyncSignal((signal) => runner.signal(signal));
  let done = -1;
  const offKept = store.subscribe(() => {
    const now = store.state().tracks.filter((t) => t.status === "complete").length;
    if (now === done) return;
    done = now;
    runner.transferred();
  });
  return () => {
    runner.stop();
    offSignals();
    offKept();
  };
}
