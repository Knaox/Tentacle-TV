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
 * l'utilisateur devant une télécommande muette.
 *
 * **Le survol, lui, le consulte** — et l'affirmation contraire, qui figurait
 * ici, était fausse. On lisait que « le survol se retire de lui-même, puisque
 * `hoverFocus.ts` ne fait rien quand l'élément visé a déjà le focus ». Cette
 * garde ne couvre que le cas où le pointeur est DÉJÀ sur l'élément focalisé,
 * pas celui où un AUTRE élément passe dessous. Or c'est précisément ce que
 * fait un défilement : le navigateur refait son test de collision et émet un
 * `mouseover` sur ce qui se trouve désormais sous un pointeur immobile, sans
 * qu'on ait bougé la télécommande. Le focus partait alors ailleurs, dans le
 * sens du défilement.
 */

const ATTRIBUTE = "data-tv-entree";

type Mode = "dpad" | "pointeur";

let mode: Mode = "dpad";

/** Dernière position connue du pointeur, en coordonnées de fenêtre. */
let position: { x: number; y: number } | null = null;

/**
 * Le sceau : « aucun mouvement réel depuis qu'on a écrit un défilement ».
 *
 * Il est posé par ce qui fait bouger la vue et levé par tout `mousemove`. Sa
 * raison d'être est le paragraphe ci-dessus : un défilement refait le test de
 * collision et signale ce qui passe sous un pointeur IMMOBILE. Le mode ne
 * suffit pas à écarter ce survol-là, puisqu'on est bel et bien en mode
 * pointeur ; seule la question « a-t-on bougé depuis ? » le distingue d'un
 * vrai.
 *
 * Formulé ainsi plutôt qu'en comparant des coordonnées, et c'est le point
 * délicat : un déplacement lent d'un pixel émet un `mousemove` puis un
 * `mouseover` aux MÊMES coordonnées. Une comparaison stricte refuserait ce
 * survol parfaitement légitime.
 */
let sealed = false;

interface CursorEvent extends Event {
  detail?: { visibility?: boolean };
}

function applyMode(fresh: Mode): void {
  if (mode === fresh) return;
  mode = fresh;
  document.documentElement.setAttribute(ATTRIBUTE, fresh);
}

/**
 * Le pointeur est-il de la partie ?
 *
 * Lu par le survol, qui n'a de sens que dans ce mode. Le mode bascule en
 * `dpad` sur le premier appui de touche, en capture — donc avant tout
 * `mouseover` que le défilement provoqué par cet appui pourrait engendrer.
 */
export function pointerActive(): boolean {
  return mode === "pointeur";
}

/** Où est le pointeur, ou `null` s'il n'a jamais bougé sur cette page. */
export function pointerPosition(): { x: number; y: number } | null {
  return position;
}

/**
 * Scelle l'état avant d'écrire un défilement.
 *
 * Tout survol qui suivra sans mouvement réel du pointeur sera refusé par
 * `hoverFocus`. À appeler juste avant l'écriture, jamais après : entre les
 * deux, le navigateur a déjà pu émettre son `mouseover`.
 */
export function sealPointer(): void {
  sealed = true;
}

/** Le pointeur a-t-il réellement bougé depuis le dernier scellement ? */
export function pointerMovedSinceSeal(): boolean {
  return !sealed;
}

/**
 * Branche l'écoute et rend la fonction de débranchement.
 *
 * `cursorStateChange` est propre à webOS. Le repli sur `mousemove` sert au
 * développement dans un navigateur de bureau, où l'événement n'existe pas :
 * sans lui, le mode pointeur ne serait jamais testable ailleurs que sur une
 * dalle.
 */
export function watchCursor(): () => void {
  const onChange = (event: Event) => {
    const visible = (event as CursorEvent).detail?.visibility;
    // Chaque apparition du curseur a droit à son premier survol franc : le
    // sceau tombe, sans quoi le pointeur qui revient à l'écran ne pourrait
    // rien désigner avant d'avoir bougé.
    if (visible) sealed = false;
    else position = null;
    applyMode(visible ? "pointeur" : "dpad");
  };

  const onMove = (event: Event) => {
    const mouse = event as MouseEvent;
    position = { x: mouse.clientX, y: mouse.clientY };
    sealed = false;
    applyMode("pointeur");
  };
  const onKey = () => {
    // Le D-pad reprend la main : le pointeur n'a plus rien à désigner, et sa
    // dernière position ne doit pas servir de prétexte à un survol.
    sealed = true;
    applyMode("dpad");
  };

  document.addEventListener("cursorStateChange", onChange);
  document.addEventListener("mousemove", onMove, { passive: true });
  document.addEventListener("keydown", onKey, true);

  document.documentElement.setAttribute(ATTRIBUTE, mode);

  return () => {
    document.removeEventListener("cursorStateChange", onChange);
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("keydown", onKey, true);
  };
}
