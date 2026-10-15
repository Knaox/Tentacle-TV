/**
 * Le moteur rapporte un changement de pause (`onPausedChange`) : est-ce une
 * PRÉSENCE (« Vous regardez encore ? ») ?
 *
 * Seulement une REPRISE que l'écran n'a pas demandée — la touche Lecture de
 * l'écran verrouillé, du casque, du Centre de contrôle : quelqu'un est là.
 *
 * Jamais :
 *  - l'écho de ce que l'écran a lui-même demandé (le moteur répète l'état
 *    qu'on vient de lui donner) — sinon « Reprendre » ou l'épisode suivant,
 *    qui relancent la lecture, remettraient le compteur à zéro sans geste ;
 *  - une pause venue du moteur (fin du fichier, appel entrant) : personne
 *    n'a rien touché, et le compteur ne court déjà plus en pause.
 *
 * `requestedPaused` : l'état que l'écran tient ; `reportedPaused` : ce que le
 * moteur annonce.
 */
export function engineResumeIsPresence(requestedPaused: boolean, reportedPaused: boolean): boolean {
  return requestedPaused && !reportedPaused;
}
