import { useEffect, useRef } from "react";
import {
  onSessionCommand,
  onSessionGeneral,
  type SessionCommand,
  type SessionGeneral,
} from "../socket/sessionChannel";

/**
 * La télécommande de Jellyfin — son tableau de bord, ou celui de Tentacle —
 * appliquée au lecteur en cours, quel qu'il soit : lecteur web, mpv du
 * bureau, lecteurs du mobile. Les commandes arrivent par le canal de session
 * (`sessionChannel`), le backend les relayant depuis la connexion Jellyfin de
 * l'appareil. Une seule traduction commande → geste, pour que « Retour
 * rapide » recule d'autant partout.
 */

const TICKS_PER_SECOND = 10_000_000;
/** Les pas de `Rewind` / `FastForward` — ceux des touches fléchées du lecteur. */
export const REMOTE_REWIND_SECONDS = 10;
export const REMOTE_FAST_FORWARD_SECONDS = 30;

/** Ce que le lecteur sait faire ; une commande sans geste correspondant est ignorée. */
export interface SessionRemoteTarget {
  /** `Stop` : quitter le lecteur, comme le bouton retour. */
  stop: () => void;
  pause?: () => void;
  play?: () => void;
  isPaused?: () => boolean;
  seekTo?: (seconds: number) => void;
  positionSeconds?: () => number;
  next?: () => void;
  previous?: () => void;
  audio?: (index: number) => void;
  /** `null` = sous-titres coupés (Jellyfin envoie -1). */
  subtitle?: (index: number | null) => void;
}

/** Une commande de lecture (`Playstate`) traduite en geste du lecteur. */
export function applySessionCommand(t: SessionRemoteTarget, { command, seekPositionTicks }: SessionCommand): void {
  switch (command) {
    case "Stop":
      t.stop();
      break;
    case "NextTrack":
      t.next?.();
      break;
    case "PreviousTrack":
      t.previous?.();
      break;
    case "Pause":
      t.pause?.();
      break;
    case "Unpause":
      t.play?.();
      break;
    case "PlayPause":
      if (t.isPaused?.()) t.play?.();
      else t.pause?.();
      break;
    case "Seek":
      if (seekPositionTicks !== undefined) t.seekTo?.(seekPositionTicks / TICKS_PER_SECOND);
      break;
    case "Rewind":
      if (t.positionSeconds) t.seekTo?.(Math.max(0, t.positionSeconds() - REMOTE_REWIND_SECONDS));
      break;
    case "FastForward":
      if (t.positionSeconds) t.seekTo?.(t.positionSeconds() + REMOTE_FAST_FORWARD_SECONDS);
      break;
  }
}

/** Une commande générale : seuls les changements de piste concernent le lecteur. */
export function applySessionGeneral(t: SessionRemoteTarget, { name, arguments: args }: SessionGeneral): void {
  const index = Number(args.Index);
  if (!Number.isInteger(index)) return;
  if (name === "SetAudioStreamIndex") t.audio?.(index);
  else if (name === "SetSubtitleStreamIndex") t.subtitle?.(index < 0 ? null : index);
}

/**
 * Branche le lecteur sur la télécommande tant qu'il est monté. La cible est
 * relue à chaque commande : l'appelant peut la recréer à chaque rendu.
 */
export function useSessionRemoteTarget(target: SessionRemoteTarget): void {
  const latest = useRef(target);
  latest.current = target;

  useEffect(() => {
    const offCommand = onSessionCommand((command) => applySessionCommand(latest.current, command));
    const offGeneral = onSessionGeneral((general) => applySessionGeneral(latest.current, general));
    return () => {
      offCommand();
      offGeneral();
    };
  }, []);
}
