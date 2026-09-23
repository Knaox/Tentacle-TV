import { useEffect, useRef } from "react";
import { onSessionCommand, onSessionGeneral } from "@tentacle-tv/api-client";
import type { PlayerTransportRef } from "../watchTogether/playerTransport";

/**
 * La télécommande de Jellyfin — son tableau de bord, ou celui de Tentacle —
 * appliquée au lecteur en cours. Les commandes arrivent par le canal de
 * session (`sessionChannel`), le backend les relayant depuis la connexion
 * Jellyfin de l'appareil.
 *
 * Elles passent par la surface de commande que Watch Together utilise déjà
 * (`PlayerTransport`), commune au lecteur web et à mpv : une pause venue de
 * Jellyfin est une pause du lecteur comme une autre — en séance de groupe,
 * elle part donc au groupe comme un clic.
 */

const TICKS_PER_SECOND = 10_000_000;
/** Les pas de `Rewind` / `FastForward` — ceux des touches fléchées du lecteur. */
const REWIND_SECONDS = 10;
const FAST_FORWARD_SECONDS = 30;

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
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const offCommand = onSessionCommand(({ command, seekPositionTicks }) => {
      const h = latest.current;
      if (command === "Stop") return h.onStop();
      if (command === "NextTrack") return h.onNext?.();
      if (command === "PreviousTrack") return h.onPrevious?.();
      const transport = h.transportRef?.current;
      if (!transport) return;
      switch (command) {
        case "Pause":
          transport.pause();
          break;
        case "Unpause":
          transport.play();
          break;
        case "PlayPause":
          if (transport.isPaused()) transport.play();
          else transport.pause();
          break;
        case "Seek":
          if (seekPositionTicks !== undefined) transport.seekTo(seekPositionTicks / TICKS_PER_SECOND);
          break;
        case "Rewind":
          transport.seekTo(Math.max(0, transport.getPositionSeconds() - REWIND_SECONDS));
          break;
        case "FastForward":
          transport.seekTo(transport.getPositionSeconds() + FAST_FORWARD_SECONDS);
          break;
      }
    });
    const offGeneral = onSessionGeneral(({ name, arguments: args }) => {
      const h = latest.current;
      const index = Number(args.Index);
      if (!Number.isInteger(index)) return;
      if (name === "SetAudioStreamIndex") h.onAudioChange?.(index);
      else if (name === "SetSubtitleStreamIndex") h.onSubtitleChange?.(index < 0 ? null : index);
    });
    return () => {
      offCommand();
      offGeneral();
    };
  }, []);
}
