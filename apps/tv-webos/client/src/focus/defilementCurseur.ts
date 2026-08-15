import { conteneurPiegeant } from "./candidats";
import { dansUnCalqueFixe } from "./audela";
import { pointeurActif, positionPointeur, scellerPointeur } from "./curseur";
import { scrollersVerticaux } from "./scrollers";
import { poussee, type Poussee } from "./zonesBord";

/**
 * Défiler en visant un bord de l'écran, au pointeur de la Magic Remote.
 *
 * C'est le geste de webOS, et il manquait : la télécommande n'a pas de molette,
 * et pointer une carte trois écrans plus bas supposait de reprendre le D-pad.
 *
 * **Seconde exception à « la page ne défile jamais sans que le focus bouge ».**
 * La première est le cas « bord » de `bordure.ts`. Celle-ci est plus franche :
 * ici la vue bouge et le focus ne bouge pas du tout. Elle se tient par les deux
 * bouts. D'un côté le SCEAU (`curseur.ts`) : chaque écriture de défilement
 * scelle l'état, et le survol refuse de prendre le focus tant que le pointeur
 * n'a pas réellement bougé — sans quoi le focus partirait dans le sens du
 * défilement, à chaque image. De l'autre le RÉANCRAGE : à l'arrêt, si l'anneau
 * a quitté la fenêtre, on le repose sur l'écran courant. Sans lui, la première
 * flèche appuyée ramènerait la vue trois écrans en arrière, par `amenerEnVue` —
 * le pire résultat possible pour qui vient de descendre à la main.
 *
 * **Aucune boucle au repos.** La boucle d'animation n'existe que pendant le
 * défilement : elle démarre quand la poussée devient non nulle et s'arrête
 * quand elle retombe à zéro. C'est la règle de coût de ce dépôt — une boucle
 * `requestAnimationFrame` permanente force une composition par image, sur une
 * machine qui n'en a pas les moyens.
 */

/** Au-delà, on tient l'image pour perdue : elle ne doit pas téléporter la vue. */
const PAS_MAXIMAL_MS = 50;

/** Ce qu'on demande à `entree.ts` quand le focus a quitté la fenêtre. */
type Reancrage = () => void;

export function surveillerDefilementCurseur(
  suspendu: () => boolean,
  reancrer: Reancrage,
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
  let cibleY: HTMLElement | "fenetre" | null = null;
  let cibleX: HTMLElement | null = null;
  // `scrollTop` tronque : jeter la fraction à chaque image coûterait jusqu'à
  // soixante pixels par seconde, soit un cinquième de la vitesse la plus lente.
  let resteY = 0;
  let resteX = 0;

  const arreter = () => {
    if (image === null) return;
    cancelAnimationFrame(image);
    image = null;
    resteY = 0;
    resteX = 0;
    cibleY = null;
    cibleX = null;
    reancrer();
  };

  const demarrer = () => {
    if (image !== null) return;
    const point = positionPointeur();
    if (!point) return;
    const sous = document.elementFromPoint(point.x, point.y);
    const element = sous instanceof HTMLElement ? sous : null;
    cibleY = cibleVerticale(element);
    cibleX = element?.closest<HTMLElement>("[data-tv-piste]") ?? null;
    if (cibleY === null && cibleX === null) return;
    precedent = 0;
    image = requestAnimationFrame(tour);
  };

  const tour = (maintenant: number) => {
    image = null;
    if (suspendu() || !pointeurActif()) {
      arreter();
      return;
    }
    const demande = demandeCourante();
    if (demande === null || (demande.x === 0 && demande.y === 0)) {
      arreter();
      return;
    }

    // La première image n'a pas de précédente : on ne défile pas encore, on
    // pose l'horloge. Écrire `maintenant - 0` ferait un bond de plusieurs
    // secondes de vue.
    const ecart = precedent === 0 ? 0 : Math.min(maintenant - precedent, PAS_MAXIMAL_MS);
    precedent = maintenant;

    if (ecart > 0 && !ecrire(demande, ecart / 1000)) {
      arreter();
      return;
    }
    image = requestAnimationFrame(tour);
  };

  /** Rend `false` quand plus rien n'a bougé — il n'y a plus de mou. */
  const ecrire = (demande: Poussee, secondes: number): boolean => {
    resteY += demande.y * secondes;
    resteX += demande.x * secondes;
    const deltaY = Math.trunc(resteY);
    const deltaX = Math.trunc(resteX);
    resteY -= deltaY;
    resteX -= deltaX;
    if (deltaY === 0 && deltaX === 0) return true;

    // Scellé AVANT l'écriture : entre les deux, le navigateur a déjà pu émettre
    // son `mouseover` sur ce qui est passé sous le pointeur.
    scellerPointeur();
    const bougeY = deltaY !== 0 && cibleY !== null && defilerVertical(cibleY, deltaY);
    const bougeX = deltaX !== 0 && cibleX !== null && defilerHorizontal(cibleX, deltaX);
    return bougeY || bougeX;
  };

  const surMouvement = () => {
    if (suspendu()) return;
    const demande = demandeCourante();
    if (!demande || (demande.x === 0 && demande.y === 0)) {
      arreter();
      return;
    }
    // Le pointeur a bougé : les cibles sont réévaluées, mais seulement là — un
    // geste continu garde les siennes.
    if (image === null) demarrer();
  };

  const surSortie = () => arreter();

  document.addEventListener("mousemove", surMouvement, { passive: true });
  document.addEventListener("mouseleave", surSortie);
  document.addEventListener("cursorStateChange", surSortie);
  document.addEventListener("visibilitychange", surSortie);
  // Un appui directionnel reprend la main : `curseur.ts` repasse en `dpad`, et
  // le tour suivant s'arrêterait de lui-même — mais une image plus tard, donc
  // avec un dernier soubresaut de vue sous l'anneau qui vient de se déplacer.
  document.addEventListener("keydown", surSortie, true);
  window.addEventListener("blur", surSortie);

  return () => {
    if (image !== null) cancelAnimationFrame(image);
    image = null;
    document.removeEventListener("mousemove", surMouvement);
    document.removeEventListener("mouseleave", surSortie);
    document.removeEventListener("cursorStateChange", surSortie);
    document.removeEventListener("visibilitychange", surSortie);
    document.removeEventListener("keydown", surSortie, true);
    window.removeEventListener("blur", surSortie);
  };
}

/** Ce que la position courante du pointeur demande, ou `null` s'il n'y en a pas. */
function demandeCourante(): Poussee | null {
  const point = positionPointeur();
  if (!point) return null;
  return poussee(
    point.x,
    point.y,
    { largeur: window.innerWidth, hauteur: window.innerHeight },
    retraitOverscan(),
  );
}

/**
 * Le retrait d'overscan, lu dans la feuille plutôt que recopié.
 *
 * Les deux valeurs vivent dans `tokens-tv.css` et y sont commentées ; les
 * dupliquer ici les ferait diverger le jour où une gamme demandera autre chose.
 */
function retraitOverscan(): { x: number; y: number } {
  const racine = getComputedStyle(document.documentElement);
  return {
    x: pixels(racine.getPropertyValue("--tv-overscan-x"), 96),
    y: pixels(racine.getPropertyValue("--tv-overscan-y"), 54),
  };
}

function pixels(valeur: string, repli: number): number {
  const nombre = parseFloat(valeur);
  return Number.isFinite(nombre) ? nombre : repli;
}

/**
 * Défilement vertical : la chaîne des conteneurs sous le pointeur, puis la
 * fenêtre.
 *
 * Le rail est `position: fixed` — il ne suit pas la page, et `dansUnCalqueFixe`
 * est déjà le juge de cette question pour le D-pad. Viser une icône du rail ne
 * défile donc rien, ce qui est le comportement voulu : on y va pour la lire.
 *
 * Sous une surface piégeante — recherche, panneau de choix —, seuls les
 * conteneurs qu'elle contient sont recevables. Même règle que `defilerParPas`,
 * et pour la même raison : la page ne doit pas glisser derrière un panneau.
 */
function cibleVerticale(element: HTMLElement | null): HTMLElement | "fenetre" | null {
  // Le rail est `position: fixed` — il ne suit pas la page, et
  // `dansUnCalqueFixe` est déjà le juge de cette question pour le D-pad. Viser
  // une icône du rail ne défile donc rien, ce qui est voulu : on y va pour lire.
  if (element && dansUnCalqueFixe(element)) return null;
  const piege = conteneurPiegeant();

  if (element) {
    for (const scroller of scrollersVerticaux(element)) {
      // Sous une surface piégeante — recherche, panneau de choix —, seuls les
      // conteneurs qu'elle contient sont recevables. Même règle que
      // `defilerParPas` : la page ne doit pas glisser derrière un panneau.
      if (piege && !piege.contains(scroller)) continue;
      return scroller;
    }
  }
  // La fenêtre n'est jamais intérieure à un piège.
  return piege ? null : "fenetre";
}

function defilerVertical(cible: HTMLElement | "fenetre", delta: number): boolean {
  if (cible === "fenetre") {
    const avant = window.pageYOffset;
    window.scrollBy(0, delta);
    return window.pageYOffset !== avant;
  }
  const avant = cible.scrollTop;
  cible.scrollTop += delta;
  return cible.scrollTop !== avant;
}

/**
 * Défilement horizontal : la piste sous le pointeur, et rien d'autre.
 *
 * Jamais la fenêtre — `index.css` interdit le défilement horizontal de page, et
 * c'est ce qui empêche la bande gauche de traîner quoi que ce soit pendant
 * qu'on vise le rail.
 */
function defilerHorizontal(piste: HTMLElement, delta: number): boolean {
  const avant = piste.scrollLeft;
  piste.scrollLeft += delta;
  return piste.scrollLeft !== avant;
}
