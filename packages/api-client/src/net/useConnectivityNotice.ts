import { useCallback, useMemo, useState } from "react";
import {
  connectivityNoticeOf, nextConnectivityEpisode, type ConnectivityNoticeModel, type ConnectivityReason,
} from "@tentacle-tv/shared";

export interface ConnectivityNotice extends ConnectivityNoticeModel {
  /** Le compte à rebours est fini, ou le message chassé : il ne reparaît qu'à la prochaine occasion. */
  done: () => void;
}

/**
 * Le message TEMPORAIRE d'un passage hors ligne — la règle du mobile et du
 * bureau (shared `connectivityCase.ts`) : à chaque bascule en hors ligne
 * automatique, ou quand la cause change pendant, il dit le cas (appareil,
 * serveur, Jellyfin), compte à rebours visible, puis s'efface. Plus de voile :
 * l'application est déjà passée sur ce qu'il y a sur l'appareil.
 * `null` : rien à dire.
 */
export function useConnectivityNotice(offlineAuto: boolean, reason: ConnectivityReason): ConnectivityNotice | null {
  // Le numéro du passage, dérivé au rendu (motif « état tiré des props ») :
  // une bascule vue une fois avance le compteur une fois.
  const [track, setTrack] = useState({ episode: 0, wasOffline: false });
  if (track.wasOffline !== offlineAuto) {
    setTrack({ episode: nextConnectivityEpisode(track.episode, track.wasOffline, offlineAuto), wasOffline: offlineAuto });
  }
  const episode = nextConnectivityEpisode(track.episode, track.wasOffline, offlineAuto);
  const [doneOccasion, setDoneOccasion] = useState<string | null>(null);
  const model = useMemo(
    () => connectivityNoticeOf({ offlineAuto, reason, episode }, doneOccasion),
    [offlineAuto, reason, episode, doneOccasion],
  );
  const occasion = model?.occasion ?? null;
  const done = useCallback(() => setDoneOccasion(occasion), [occasion]);
  return useMemo(() => (model ? { ...model, done } : null), [model, done]);
}
