/**
 * Octave — la porte d'un écran d'Octave DÉJÀ ouvert (mobile, web étroit), règle
 * PURE : y rester, attendre, ou rendre la main à Tentacle. Une PANNE (statut en
 * erreur, hors ligne, serveur muet) n'est jamais une absence : Octave reste,
 * le hors ligne s'y montre. Seule une réponse établie du serveur (capacité
 * absente, compte sans musique, droit retiré) fait quitter, sans erreur.
 */

import type { OctaveAvailabilityState } from "./octaveStartup";

export type OctaveStayVerdict = "open" | "wait" | "leave";

export interface OctaveStayInput {
  /** La disponibilité telle que le serveur la dit (`useOctaveAvailability`). */
  fresh: OctaveAvailabilityState;
  /** Le statut de la musique est en erreur (panne, hors ligne). */
  failed: boolean;
  /** Le miroir du lancement dit Octave disponible pour cette identité. */
  mirrorAvailable: boolean;
}

export function octaveStayVerdict({ fresh, failed, mirrorAvailable }: OctaveStayInput): OctaveStayVerdict {
  if (fresh.available) return "open";
  if (failed) return "open";
  if (!fresh.settled) return mirrorAvailable ? "open" : "wait";
  return "leave";
}
