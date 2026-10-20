/**
 * Watch Together mobile — la reprise après l'arrière-plan ou une coupure
 * réseau, en module PUR.
 *
 * Au premier plan (ou au retour du réseau), un appareil EN SÉANCE :
 *  - relance la socket TOUT DE SUITE (`reconnect`) : son recul peut être monté
 *    à 30 s pendant l'arrière-plan, et le groupe l'attendrait d'autant ;
 *  - redemande l'état de la salle (`syncRequest`) : iOS garde parfois une
 *    socket « ouverte » qui n'a rien reçu pendant le sommeil — la reconnexion
 *    ne se déclencherait pas, l'état serait périmé ;
 *  - relance une rafale d'horloge (`clockBurst`) : l'horloge du téléphone a pu
 *    dériver pendant la veille.
 * La grâce de l'appareil (2 min, côté serveur) garde sa place entre-temps.
 * Hors séance : rien (la socket suit son propre cours).
 */

export type ResumeAction = "reconnect" | "syncRequest" | "clockBurst";

export type AppPhase = "active" | "background" | "inactive" | "unknown" | "extension";

export function resumeActions(previous: AppPhase, next: AppPhase, inGroup: boolean): ResumeAction[] {
  if (!inGroup) return [];
  if (next !== "active" || previous === "active") return [];
  // « inactive » seul (centre de contrôle, appel entrant bref) : la socket n'a pas dormi.
  if (previous === "inactive") return ["syncRequest"];
  return ["reconnect", "syncRequest", "clockBurst"];
}

/** Le réseau revient (hors ligne → en ligne) en séance. */
export function networkResumeActions(wasOnline: boolean, isOnline: boolean, inGroup: boolean): ResumeAction[] {
  if (!inGroup || wasOnline || !isOnline) return [];
  return ["reconnect", "syncRequest", "clockBurst"];
}
