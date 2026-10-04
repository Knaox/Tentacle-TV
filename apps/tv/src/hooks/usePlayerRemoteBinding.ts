import type { PlayerRemoteHandlers } from "@tentacle-tv/tv-core";
import { useTVRemote } from "../components/focus/useTVRemote";
import { REDESIGN_ACTIVE } from "../redesignWiring/redesignGate";
import { usePlayerIntentBinding } from "./usePlayerIntentBinding";

/**
 * La télécommande du lecteur. La refonte (Apple TV, Android TV refondu)
 * passe par l'entrée unique de sa plateforme (`usePlayerIntentBinding`) ;
 * l'ancienne UI d'Android TV, tant que l'aiguillage la garde, par
 * `useTVRemote` (key-down qui agit, key-up qui relâche, `BackHandler`) — à
 * retirer avec elle. Le choix est fait une fois, au chargement : l'aiguillage
 * ne change pas en cours de route.
 */
function useLegacyAndroidBinding(remote: PlayerRemoteHandlers): void {
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

export const usePlayerRemoteBinding: (remote: PlayerRemoteHandlers) => void = REDESIGN_ACTIVE
  ? usePlayerIntentBinding
  : useLegacyAndroidBinding;
