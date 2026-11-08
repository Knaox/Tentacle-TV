/**
 * Octave — le rythme du rapport d'écoute d'une app qui passe derrière (mobile) :
 * l'état de l'app, et le BATTEMENT du socket partagé (`socket/keepaliveBeat.ts`)
 * avec lequel la progression part, modem déjà réveillé par le ping. À rendre
 * (`dispose`) en démontant le lecteur.
 *
 *   const pacing = socketReportPacing(() => AppState.currentState !== "active");
 *   buildOctavePlayer(engine, qc, provider, kept, pacing.pacing);
 *   …
 *   pacing.dispose();
 */

import { onKeepaliveBeat } from "../../socket/keepaliveBeat";
import type { OctaveReportPacing } from "./buildOctavePlayer";

export interface SocketReportPacing {
  pacing: OctaveReportPacing;
  dispose: () => void;
}

export function socketReportPacing(background: () => boolean): SocketReportPacing {
  let beat: (() => void) | null = null;
  const off = onKeepaliveBeat(() => beat?.());
  return {
    pacing: {
      background,
      onBeat: (listener) => {
        beat = listener;
      },
    },
    dispose: () => {
      off();
      beat = null;
    },
  };
}
