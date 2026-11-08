/**
 * Octave (mobile) — l'écoute branchée sur la sonde de connectivité : tant que
 * le son avance, la sonde périodique (90 s) se tait ; un blocage ou un échec
 * de lecture la déclenche aussitôt. Règle : `listeningSignal.ts`.
 */

import type { OctavePlayer } from "@tentacle-tv/shared/octave";
import { reportPossibleOutage } from "../../offline/connectivityStore";
import { setMusicPlaying } from "../../offline/probeQuiet";
import { listeningSignal } from "./listeningSignal";

/** Suit le lecteur jusqu'au nettoyage rendu (qui rend la sonde à son rythme). */
export function followListeningForProbe(player: OctavePlayer): () => void {
  let previous = player.snapshot.get();
  setMusicPlaying(listeningSignal(null, previous).playing);
  const off = player.snapshot.subscribe(() => {
    const next = player.snapshot.get();
    const signal = listeningSignal(previous, next);
    previous = next;
    setMusicPlaying(signal.playing);
    if (signal.suspect) reportPossibleOutage();
  });
  return () => {
    off();
    setMusicPlaying(false);
  };
}
