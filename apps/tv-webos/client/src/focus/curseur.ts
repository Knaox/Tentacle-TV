/**
 * Le pointeur de la Magic Remote.
 *
 * webOS fait apparaître un vrai curseur dès qu'on agite la télécommande, et la
 * page reçoit alors de vrais `mouseover`. Toute la machinerie de survol du
 * client web se réveille : aperçu au survol, révélation différée des
 * commandes, épinglage de la carte survolée dans le fenêtrage des rangées.
 *
 * Deux systèmes se disputeraient alors le même état visuel — l'un désignant la
 * carte survolée, l'autre celle qui a le focus. Le moteur spatial se met donc
 * en veille tant que le pointeur est visible, et reprend la main dès qu'il
 * disparaît.
 *
 * L'attribut posé sur `<html>` permet en outre à la feuille TV de distinguer
 * les deux modes si le besoin s'en présente.
 */

const ATTRIBUT = "data-tv-entree";

type Mode = "dpad" | "pointeur";

let mode: Mode = "dpad";

interface EvenementCurseur extends Event {
  detail?: { visibility?: boolean };
}

function poser(nouveau: Mode): void {
  if (mode === nouveau) return;
  mode = nouveau;
  document.documentElement.setAttribute(ATTRIBUT, nouveau);
}

/**
 * Branche l'écoute et rend la fonction de débranchement.
 *
 * `cursorStateChange` est propre à webOS. Le repli sur `mousemove` sert au
 * développement dans un navigateur de bureau, où l'événement n'existe pas :
 * sans lui, le mode pointeur ne serait jamais testable ailleurs que sur une
 * dalle.
 */
export function surveillerCurseur(): () => void {
  const surChangement = (evenement: Event) => {
    const visible = (evenement as EvenementCurseur).detail?.visibility;
    poser(visible ? "pointeur" : "dpad");
  };

  const surMouvement = () => poser("pointeur");
  const surTouche = () => poser("dpad");

  document.addEventListener("cursorStateChange", surChangement);
  document.addEventListener("mousemove", surMouvement, { passive: true });
  document.addEventListener("keydown", surTouche, true);

  document.documentElement.setAttribute(ATTRIBUT, mode);

  return () => {
    document.removeEventListener("cursorStateChange", surChangement);
    document.removeEventListener("mousemove", surMouvement);
    document.removeEventListener("keydown", surTouche, true);
  };
}

/** Vrai quand le pointeur est visible : le moteur spatial doit s'effacer. */
export function pointeurActif(): boolean {
  return mode === "pointeur";
}
