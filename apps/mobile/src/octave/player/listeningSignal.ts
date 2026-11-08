/**
 * Octave (mobile) — ce que l'écoute dit à la sonde de connectivité, d'après
 * l'instantané du lecteur. Module pur (testé sans React Native) ; le
 * branchement est `listeningProbe.ts`.
 *
 * - `playing` : le son avance. Tant que c'est vrai (et l'app en ligne), la
 *   sonde périodique se tait (`offline/probeQuiet.ts`).
 * - `suspect` : le lecteur vient de passer en attente de données ou en échec
 *   sur une source du SERVEUR — peut-être le réseau : la sonde part tout de
 *   suite (l'anti-rafale de 2 s du magasin la borne). Une copie gardée sur le
 *   téléphone qui échoue n'accuse pas le réseau.
 */

import type { PlayerPhase, PlayerSnapshot } from "@tentacle-tv/shared/octave";

export interface ListeningSignal {
  playing: boolean;
  suspect: boolean;
}

type ListeningView = Pick<PlayerSnapshot, "phase" | "fromDevice">;

const TROUBLED: ReadonlySet<PlayerPhase> = new Set<PlayerPhase>(["stalled", "error"]);

export function listeningSignal(previous: ListeningView | null, next: ListeningView): ListeningSignal {
  const entered = TROUBLED.has(next.phase) && previous?.phase !== next.phase;
  return { playing: next.phase === "playing", suspect: entered && !next.fromDevice };
}
