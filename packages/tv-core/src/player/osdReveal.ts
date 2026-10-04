/**
 * Où va le focus quand l'habillage du lecteur RÉAPPARAÎT (OK, une flèche,
 * Lecture/Pause, la fin d'un défilement) — la règle de la réapparition ; la
 * pilule de saut qui tient ou réclame le focus le garde dans tous les cas
 * (`overlayFocusCore` : une restauration douce lui cède).
 *
 * - Toute télécommande de la plateforme a Lecture/Pause (`always`, la Siri
 *   Remote) : le DERNIER bouton utilisé — l'habillage reprend où on l'a
 *   laissé, la pause a sa touche.
 * - Certaines ne l'ont pas (`sometimes`, la télécommande Google TV) : OK en
 *   tient lieu, et c'est la règle des lecteurs d'Android TV (YouTube,
 *   Netflix ; les consignes d'Android : « OK met en pause ») — le premier OK
 *   montre l'habillage, le SECOND met en pause. Il faut donc que l'habillage
 *   reparaisse sur Lecture/Pause, jamais sur le dernier bouton : un « +30 »
 *   ou « Pistes » resté en mémoire ferait d'un second OK un saut ou un menu
 *   (le défaut que relèvent les utilisateurs de Plex).
 *
 * Module pur.
 */

export type OsdRevealTarget = "playpause" | null;

export function osdRevealTarget(traits: { playPauseKey: "always" | "sometimes" }): OsdRevealTarget {
  return traits.playPauseKey === "sometimes" ? "playpause" : null;
}
