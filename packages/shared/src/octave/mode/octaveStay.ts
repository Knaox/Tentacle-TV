/**
 * Octave — le MODE (Tentacle TV / Octave) est une donnée de l'APPAREIL, règle
 * PURE (`octaveStay.test.ts`) commune au mobile et au bureau. Il décide de la
 * coquille au démarrage, EN LIGNE COMME HORS LIGNE, et survit à la bascule
 * hors ligne → en ligne : seuls l'utilisateur (la bascule) et une absence
 * ÉTABLIE par le serveur (capacité absente, compte sans musique, droit
 * retiré) l'éteignent.
 *
 * Une PANNE n'est jamais une absence (lot « fl », 30/10, Damien : un démarrage
 * hors ligne dans Octave rendait la page hors ligne de Tentacle, éteignait le
 * mode, et le retour du réseau rouvrait Tentacle). Est une panne :
 * - l'appareil hors ligne (manuel ou subi) ;
 * - `/api/config` FINI sans avoir répondu (`configKnown` faux) : ses capacités
 *   sont alors vides, et « pas de `music.library` » n'y est pas un fait ;
 * - le statut de la musique en erreur (`failed`).
 *
 * Trois questions, une règle :
 * - `octaveStayVerdict` : la porte d'un écran d'Octave déjà ouvert — y rester,
 *   attendre, ou rendre la main à Tentacle ;
 * - `octaveMirrorNote` : ce que le miroir du lancement (`tentacle_octave_launch`)
 *   peut retenir — une panne n'y entre jamais ;
 * - `octaveSwitchShown` : la bascule vers Octave (côté Tentacle) se montre-t-elle —
 *   hors ligne, d'après le miroir (la musique gardée vit sur l'appareil).
 */

import type { OctaveAvailabilityState } from "./octaveStartup";

export type OctaveStayVerdict = "open" | "wait" | "leave";

export interface OctaveModeFacts {
  /** La disponibilité telle que le serveur la dit (`useOctaveAvailability`). */
  fresh: OctaveAvailabilityState;
  /** Le statut de la musique est en erreur (panne). */
  failed: boolean;
  /** `/api/config` a RÉPONDU (capacités connues) : une requête finie en échec ne compte pas. */
  configKnown: boolean;
  /** L'appareil est hors ligne (mode manuel, ou serveur injoignable). */
  offline: boolean;
  /** Le miroir du lancement dit Octave disponible pour cette identité. */
  mirrorAvailable: boolean;
}

/** L'absence d'Octave est-elle un FAIT dit par un serveur qui a répondu (jamais une panne) ? */
export function octaveAbsenceEstablished(facts: Omit<OctaveModeFacts, "mirrorAvailable">): boolean {
  if (facts.offline || facts.failed || !facts.configKnown) return false;
  return facts.fresh.settled && !facts.fresh.available;
}

export function octaveStayVerdict(facts: OctaveModeFacts): OctaveStayVerdict {
  if (facts.fresh.available) return "open";
  // Hors ligne, panne : on reste — la musique gardée s'y montre.
  if (facts.offline || facts.failed) return "open";
  if (octaveAbsenceEstablished(facts)) return "leave";
  // Configuration finie sans réponse : une panne, comme le hors ligne.
  if (facts.fresh.settled && !facts.configKnown) return "open";
  return facts.mirrorAvailable ? "open" : "wait";
}

/** La valeur à retenir dans le miroir du lancement ; `null` : rien (pas de réponse établie, ou une panne). */
export function octaveMirrorNote(facts: Omit<OctaveModeFacts, "mirrorAvailable">): boolean | null {
  if (facts.offline || facts.failed || !facts.configKnown || !facts.fresh.settled) return null;
  return facts.fresh.available;
}

/**
 * La bascule Tentacle → Octave se montre-t-elle ? En ligne, la réponse du
 * serveur ; hors ligne (ou configuration en panne), le miroir : Octave était
 * disponible pour ce compte au dernier passage en ligne.
 */
export function octaveSwitchShown(facts: OctaveModeFacts): boolean {
  if (facts.fresh.available) return true;
  if (facts.offline || facts.failed || !facts.configKnown) return facts.mirrorAvailable;
  return false;
}
