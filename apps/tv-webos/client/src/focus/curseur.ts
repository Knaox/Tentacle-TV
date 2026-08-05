/**
 * Le pointeur de la Magic Remote.
 *
 * webOS fait apparaître un vrai curseur dès qu'on agite la télécommande, et la
 * page reçoit alors de vrais `mouseover`. Toute la machinerie de survol du
 * client web se réveille : aperçu au survol, révélation différée des
 * commandes, épinglage de la carte survolée dans le fenêtrage des rangées.
 *
 * Deux systèmes se disputeraient alors le même état visuel — l'un désignant la
 * carte survolée, l'autre celle qui a le focus. Ce module tient donc le mode
 * d'entrée courant, et le publie en attribut sur `<html>` pour que la feuille
 * TV puisse distinguer les deux.
 *
 * **Le mode ne commande rien au moteur, et ne doit pas le commander.** Un appui
 * directionnel EST le signal que le pointeur a disparu : l'écoute de `keydown`
 * ci-dessous bascule en `dpad`, et la flèche suit son cours. Refuser la flèche
 * parce que le curseur était visible une milliseconde plus tôt laisserait
 * l'utilisateur devant une télécommande muette. Le survol, lui, se retire de
 * lui-même — `survolFocus.ts` ne fait rien quand l'élément visé a déjà le
 * focus.
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
