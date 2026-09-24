import type { MutableRefObject } from "react";
import { useSessionRemoteTarget } from "@tentacle-tv/api-client";

/**
 * Le lecteur TV sous la télécommande de Jellyfin — son tableau de bord, ou
 * celui de Tentacle au bureau et sur le téléphone : pause, reprise, arrêt,
 * saut, épisode voisin, pistes audio et sous-titres. La traduction commande →
 * geste est celle du web et du mobile (`useSessionRemoteTarget`) ; ici, rien
 * que les gestes du lecteur TV.
 *
 * Une commande reçue montre l'habillage : qui regarde doit voir que la lecture
 * vient d'être mise en pause ou déplacée par quelqu'un d'autre.
 */
export function useTVSessionRemote(args: {
  leave: () => void;
  setPaused: (paused: boolean) => void;
  pausedRef: MutableRefObject<boolean>;
  seek: (seconds: number) => void;
  positionRef: MutableRefObject<number>;
  next: () => void;
  previous: () => void;
  audio: (index: number) => void;
  /** -1 = sous-titres coupés. */
  subtitle: (index: number) => void;
  showOverlay: () => void;
}): void {
  useSessionRemoteTarget({
    stop: args.leave,
    pause: () => {
      args.setPaused(true);
      args.showOverlay();
    },
    play: () => {
      args.setPaused(false);
      args.showOverlay();
    },
    isPaused: () => args.pausedRef.current,
    seekTo: (seconds) => {
      args.seek(seconds);
      args.showOverlay();
    },
    positionSeconds: () => args.positionRef.current,
    next: args.next,
    previous: args.previous,
    audio: args.audio,
    subtitle: (index) => args.subtitle(index ?? -1),
  });
}
