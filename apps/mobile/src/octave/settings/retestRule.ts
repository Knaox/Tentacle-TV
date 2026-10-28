/**
 * Octave (mobile) — « Retester la connexion » (Réglages › Hors ligne), règle PURE
 * (`retestRule.test.ts`) : la ligne n'existe que hors ligne ; elle dit ce qui se
 * passe (test en cours), puis, si le serveur ne répond toujours pas, le dit
 * plutôt que de se taire. Hors ligne PAR CHOIX, le test quitte ce mode : le
 * serveur répond → en ligne ; sinon l'application reste hors ligne, subie.
 */

import type { ConnectivityState } from "@tentacle-tv/offline-core";

export type RetestLine = "hidden" | "idle" | "idleManual" | "checking" | "still";

export function retestLine(state: ConnectivityState, checking: boolean, tried: boolean): RetestLine {
  if (state !== "offline-auto" && state !== "offline-manual") return "hidden";
  if (checking) return "checking";
  if (state === "offline-manual") return "idleManual";
  return tried ? "still" : "idle";
}
