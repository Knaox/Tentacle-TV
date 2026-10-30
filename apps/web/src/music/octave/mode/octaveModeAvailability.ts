/**
 * Octave (web, bureau) — la disponibilité telle que le MODE la lit, règle PURE :
 * la règle partagée `octaveStayVerdict` (`@tentacle-tv/shared/octave/mode`,
 * posée par le mobile) rendue dans la forme qu'attendent la porte de l'accueil
 * (`OctaveHomeGate`) et celle d'Octave (`OctaveApp`).
 *
 * Une PANNE n'est jamais une absence (lot « fl », 30/10) : hors ligne, ou
 * `/api/config` fini sans réponse (démarrage à froid sans réseau : capacités
 * vides, « réglé » trop tôt), Octave est disponible — le mode reste celui de
 * l'appareil et montre la musique gardée. Avant ce correctif, la porte de
 * l'accueil prenait cette absence pour un fait et rendait le hors ligne de
 * Tentacle TV, selon que la sonde avait tranché avant ou après elle (vu au
 * banc du bureau : deux démarrages sur trois).
 */

import { octaveStayVerdict, type OctaveModeFacts } from "@tentacle-tv/shared/octave/mode";
import type { OctaveAvailabilityState } from "./octaveStartup";

/** `fresh` est ici la disponibilité du LANCEMENT (le miroir s'y applique déjà, `launchAvailability`). */
export function octaveModeAvailability(facts: OctaveModeFacts): OctaveAvailabilityState {
  const verdict = octaveStayVerdict(facts);
  if (verdict === "open") return { available: true, settled: true };
  if (verdict === "leave") return { available: false, settled: true };
  return { available: false, settled: false };
}
