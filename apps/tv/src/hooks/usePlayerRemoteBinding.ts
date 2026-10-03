import type { PlayerRemoteHandlers } from "@tentacle-tv/tv-core";
import { useTVRemote } from "../components/focus/useTVRemote";

/**
 * La télécommande du lecteur sur ANDROID TV (la variante Apple TV :
 * `usePlayerRemoteBinding.ios.ts`, l'entrée unique). Les gestes vont aux
 * contrôles de tv-core (`player/playerControls.ts`), qui décident.
 *
 * À retirer au portage Android TV : `useTVRemote` traduit encore ici les
 * événements natifs (key-down qui agit, key-up qui relâche, BackHandler) ;
 * Android TV recevra sa table de traduction (tv-core `remote/bindings/`) et
 * passera par `playerRemoteSteps`, comme Apple TV.
 */
export function usePlayerRemoteBinding(remote: PlayerRemoteHandlers): void {
  useTVRemote({
    debugTag: "PLAYER", // TODO(diag): À RETIRER
    // Un panneau ouvert garde son Retour ; un défilement s'annule ; sinon,
    // le Retour du lecteur.
    onBack: remote.back,
    onPlayPause: remote.playPause,
    onLeft: () => remote.arrow("backward"),
    onRight: () => remote.arrow("forward"),
    onLongLeft: () => remote.arrowHold("backward"),
    onLongRight: () => remote.arrowHold("forward"),
    onRewind: () => remote.mediaSeek("backward"),
    onFastForward: () => remote.mediaSeek("forward"),
    onKeyUp: remote.release,
    onDown: remote.vertical,
    onUp: remote.vertical,
    onSelect: remote.select,
    onAnyPress: remote.anyPress,
  });
}
