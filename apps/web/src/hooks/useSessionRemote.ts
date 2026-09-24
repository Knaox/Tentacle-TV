import { useSessionRemoteTarget } from "@tentacle-tv/api-client";
import type { PlayerTransportRef } from "../watchTogether/playerTransport";

/**
 * La télécommande de Jellyfin — son tableau de bord, ou celui de Tentacle —
 * appliquée au lecteur en cours. La traduction commande → geste est partagée
 * avec le mobile (`useSessionRemoteTarget`, api-client) ; ici, elle vise la
 * surface de commande que Watch Together utilise déjà (`PlayerTransport`),
 * commune au lecteur web et à mpv : une pause venue de Jellyfin est une pause
 * du lecteur comme une autre — en séance de groupe, elle part donc au groupe
 * comme un clic.
 */

export interface SessionRemoteHandlers {
  transportRef?: PlayerTransportRef;
  /** `Stop` : quitter le lecteur, comme le bouton retour. */
  onStop: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onAudioChange?: (index: number) => void;
  /** `null` = sous-titres coupés (Jellyfin envoie -1). */
  onSubtitleChange?: (index: number | null) => void;
}

export function useSessionRemote(handlers: SessionRemoteHandlers): void {
  const { transportRef } = handlers;
  useSessionRemoteTarget({
    stop: handlers.onStop,
    next: handlers.onNext,
    previous: handlers.onPrevious,
    audio: handlers.onAudioChange,
    subtitle: handlers.onSubtitleChange,
    pause: () => transportRef?.current?.pause(),
    play: () => transportRef?.current?.play(),
    isPaused: () => transportRef?.current?.isPaused() ?? false,
    seekTo: (seconds) => transportRef?.current?.seekTo(seconds),
    positionSeconds: () => transportRef?.current?.getPositionSeconds() ?? 0,
  });
}
