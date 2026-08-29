import { trappingContainer } from "./candidates";
import { inFixedLayer } from "./beyond";
import { pointerActive, pointerPosition, sealPointer } from "./cursor";
import { verticalScrollers } from "./scrollers";
import { push, type Push } from "./edgeZones";

/**
 * Défiler en visant un bord de l'écran, au pointeur de la Magic Remote.
 *
 * C'est le geste de webOS, et il manquait : la télécommande n'a pas de molette,
 * et pointer une carte trois écrans plus bas supposait de reprendre le D-pad.
 *
 * **Seconde exception à « la page ne défile jamais sans que le focus bouge ».**
 * La première est le cas « bord » de `border.ts`. Celle-ci est plus franche :
 * ici la vue bouge et le focus ne bouge pas du tout. Elle se tient par les deux
 * bouts. D'un côté le SCEAU (`cursor.ts`) : chaque écriture de défilement
 * scelle l'état, et le survol refuse de prendre le focus tant que le pointeur
 * n'a pas réellement bougé — sans quoi le focus partirait dans le sens du
 * défilement, à chaque image. De l'autre le RÉANCRAGE : à l'arrêt, si l'anneau
 * a quitté la fenêtre, on le repose sur l'écran courant. Sans lui, la première
 * flèche appuyée ramènerait la vue trois écrans en arrière, par `bringIntoView` —
 * le pire résultat possible pour qui vient de descendre à la main.
 *
 * **Aucune boucle au repos.** La boucle d'animation n'existe que pendant le
 * défilement : elle démarre quand la poussée devient non nulle et s'arrête
 * quand elle retombe à zéro. C'est la règle de coût de ce dépôt — une boucle
 * `requestAnimationFrame` permanente force une composition par image, sur une
 * machine qui n'en a pas les moyens.
 */

/** Au-delà, on tient l'image pour perdue : elle ne doit pas téléporter la vue. */
const MAX_STEP_MS = 50;

/** Ce qu'on demande à `entry.ts` quand le focus a quitté la fenêtre. */
type Reanchor = () => void;

export function watchCursorScroll(
  suspended: () => boolean,
  reanchor: Reanchor,
): () => void {
  let image: number | null = null;
  let precedent = 0;
  /**
   * Les cibles, résolues au DÉMARRAGE et gardées pour toute la durée du geste.
   *
   * Les réévaluer à chaque image paraissait plus juste, et c'est le contraire :
   * la page défile sous un pointeur immobile, si bien que `elementFromPoint`
   * finit par désigner autre chose — un calque fixe, un pied de page sans
   * conteneur défilant — et le geste s'arrêtait au milieu, sans rien pour le
   * reprendre. Mesuré sur la dalle : 753 px puis plus rien, alors qu'il restait
   * du mou. On vise un ENDROIT, on ne suit pas ce qui passe dessous.
   */
  let targetY: HTMLElement | "fenetre" | null = null;
  let targetX: HTMLElement | null = null;
  // `scrollTop` tronque : jeter la fraction à chaque image coûterait jusqu'à
  // soixante pixels par seconde, soit un cinquième de la vitesse la plus lente.
  let restY = 0;
  let restX = 0;

  const stop = () => {
    if (image === null) return;
    cancelAnimationFrame(image);
    image = null;
    restY = 0;
    restX = 0;
    targetY = null;
    targetX = null;
    reanchor();
  };

  const start = () => {
    if (image !== null) return;
    const point = pointerPosition();
    if (!point) return;
    const under = document.elementFromPoint(point.x, point.y);
    const element = under instanceof HTMLElement ? under : null;
    targetY = verticalTarget(element);
    targetX = element?.closest<HTMLElement>("[data-tv-piste]") ?? null;
    if (targetY === null && targetX === null) return;
    precedent = 0;
    image = requestAnimationFrame(tour);
  };

  const tour = (now: number) => {
    image = null;
    if (suspended() || !pointerActive()) {
      stop();
      return;
    }
    const request = currentRequest();
    if (request === null || (request.x === 0 && request.y === 0)) {
      stop();
      return;
    }

    // La première image n'a pas de précédente : on ne défile pas encore, on
    // pose l'horloge. Écrire `now - 0` ferait un bond de plusieurs
    // secondes de vue.
    const gap = precedent === 0 ? 0 : Math.min(now - precedent, MAX_STEP_MS);
    precedent = now;

    if (gap > 0 && !write(request, gap / 1000)) {
      stop();
      return;
    }
    image = requestAnimationFrame(tour);
  };

  /** Rend `false` quand plus rien n'a bougé — il n'y a plus de mou. */
  const write = (request: Push, seconds: number): boolean => {
    restY += request.y * seconds;
    restX += request.x * seconds;
    const deltaY = Math.trunc(restY);
    const deltaX = Math.trunc(restX);
    restY -= deltaY;
    restX -= deltaX;
    if (deltaY === 0 && deltaX === 0) return true;

    // Scellé AVANT l'écriture : entre les deux, le navigateur a déjà pu émettre
    // son `mouseover` sur ce qui est passé sous le pointeur.
    sealPointer();
    const moveY = deltaY !== 0 && targetY !== null && scrollVertical(targetY, deltaY);
    const moveX = deltaX !== 0 && targetX !== null && scrollHorizontal(targetX, deltaX);
    return moveY || moveX;
  };

  const onMove = () => {
    if (suspended()) return;
    const request = currentRequest();
    if (!request || (request.x === 0 && request.y === 0)) {
      stop();
      return;
    }
    // Le pointeur a bougé : les cibles sont réévaluées, mais seulement là — un
    // geste continu garde les siennes.
    if (image === null) start();
  };

  const surSortie = () => stop();

  document.addEventListener("mousemove", onMove, { passive: true });
  document.addEventListener("mouseleave", surSortie);
  document.addEventListener("cursorStateChange", surSortie);
  document.addEventListener("visibilitychange", surSortie);
  // Un appui directionnel reprend la main : `cursor.ts` repasse en `dpad`, et
  // le tour suivant s'arrêterait de lui-même — mais une image plus tard, donc
  // avec un dernier soubresaut de vue sous l'anneau qui vient de se déplacer.
  document.addEventListener("keydown", surSortie, true);
  window.addEventListener("blur", surSortie);

  return () => {
    if (image !== null) cancelAnimationFrame(image);
    image = null;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseleave", surSortie);
    document.removeEventListener("cursorStateChange", surSortie);
    document.removeEventListener("visibilitychange", surSortie);
    document.removeEventListener("keydown", surSortie, true);
    window.removeEventListener("blur", surSortie);
  };
}

/** Ce que la position courante du pointeur demande, ou `null` s'il n'y en a pas. */
function currentRequest(): Push | null {
  const point = pointerPosition();
  if (!point) return null;
  return push(
    point.x,
    point.y,
    { width: window.innerWidth, hauteur: window.innerHeight },
    overscanInset(),
  );
}

/**
 * Le retrait d'overscan, lu dans la feuille plutôt que recopié.
 *
 * Les deux valeurs vivent dans `tokens-tv.css` et y sont commentées ; les
 * dupliquer ici les ferait diverger le jour où une gamme demandera autre chose.
 */
function overscanInset(): { x: number; y: number } {
  const racine = getComputedStyle(document.documentElement);
  return {
    x: pixels(racine.getPropertyValue("--tv-overscan-x"), 96),
    y: pixels(racine.getPropertyValue("--tv-overscan-y"), 54),
  };
}

function pixels(value: string, fallback: number): number {
  const count = parseFloat(value);
  return Number.isFinite(count) ? count : fallback;
}

/**
 * Défilement vertical : la chaîne des conteneurs sous le pointeur, puis la
 * fenêtre.
 *
 * Le rail est `position: fixed` — il ne suit pas la page, et `inFixedLayer`
 * est déjà le juge de cette question pour le D-pad. Viser une icône du rail ne
 * défile donc rien, ce qui est le comportement voulu : on y va pour la lire.
 *
 * Sous une surface piégeante — recherche, panneau de choix —, seuls les
 * conteneurs qu'elle contient sont recevables. Même règle que `scrollByStep`,
 * et pour la même raison : la page ne doit pas glisser derrière un panneau.
 */
function verticalTarget(element: HTMLElement | null): HTMLElement | "fenetre" | null {
  // Le rail est `position: fixed` — il ne suit pas la page, et
  // `inFixedLayer` est déjà le juge de cette question pour le D-pad. Viser
  // une icône du rail ne défile donc rien, ce qui est voulu : on y va pour lire.
  if (element && inFixedLayer(element)) return null;
  const trap = trappingContainer();

  if (element) {
    for (const scroller of verticalScrollers(element)) {
      // Sous une surface piégeante — recherche, panneau de choix —, seuls les
      // conteneurs qu'elle contient sont recevables. Même règle que
      // `scrollByStep` : la page ne doit pas glisser derrière un panneau.
      if (trap && !trap.contains(scroller)) continue;
      return scroller;
    }
  }
  // La fenêtre n'est jamais intérieure à un piège.
  return trap ? null : "fenetre";
}

function scrollVertical(target: HTMLElement | "fenetre", delta: number): boolean {
  if (target === "fenetre") {
    const before = window.pageYOffset;
    window.scrollBy(0, delta);
    return window.pageYOffset !== before;
  }
  const before = target.scrollTop;
  target.scrollTop += delta;
  return target.scrollTop !== before;
}

/**
 * Défilement horizontal : la piste sous le pointeur, et rien d'autre.
 *
 * Jamais la fenêtre — `index.css` interdit le défilement horizontal de page, et
 * c'est ce qui empêche la bande gauche de traîner quoi que ce soit pendant
 * qu'on vise le rail.
 */
function scrollHorizontal(piste: HTMLElement, delta: number): boolean {
  const before = piste.scrollLeft;
  piste.scrollLeft += delta;
  return piste.scrollLeft !== before;
}
