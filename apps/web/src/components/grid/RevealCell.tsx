import {
  createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode,
} from "react";
import { createRevealObserver, type RevealObserver } from "./revealObserver";

/**
 * Cellules qui ne montent leur contenu que près du champ de vision.
 *
 * # Pourquoi ce mécanisme plutôt qu'une virtualisation
 *
 * Les grilles de l'application n'ont pas toutes la même densité : la
 * bibliothèque et les collections comptent leurs colonnes en JS
 * (`useItemsPerRow`), le catalogue hors ligne et la liste partagée les déclarent
 * en paliers Tailwind, la liste d'épisodes est une colonne. Une virtualisation
 * impose de calculer les colonnes ET la hauteur d'une rangée en JS, donc de
 * remplacer chaque mise en page par une autre — c'est un changement visuel sur
 * chaque page, et il n'y a aucune raison de le faire ici.
 *
 * Ce composant ne change RIEN à la mise en page : la grille garde ses classes et
 * son nombre d'enfants, chaque cellule reste à sa place. Seul son CONTENU est
 * démonté quand elle est loin — et c'est là que tout le poids se trouve :
 *
 *   • l'image décodée, de loin le premier poste (≈ 540 Ko pour une affiche 2:3,
 *     ≈ 200 Ko pour une vignette d'épisode) ;
 *   • les abonnements au cache de la cellule, qui la font re-rendre à chaque
 *     invalidation ;
 *   • ses propres observateurs et écouteurs.
 *
 * Un `<div>` vide qui reste, c'est une centaine d'octets. C'est le bon échange.
 *
 * # La hauteur, et pourquoi elle est mémorisée
 *
 * Une cellule vidée s'effondrerait et la page sauterait sous le curseur. On
 * retient donc la hauteur MESURÉE au dernier passage et on la réserve — pas une
 * estimation, la vraie. `minHeight` et non `height` : une cellule montée doit
 * pouvoir reprendre sa taille propre si le contenu a changé.
 */

const RevealCtx = createContext<RevealObserver | null>(null);

/**
 * Fournit l'observateur partagé à toutes les cellules d'une surface.
 *
 * À poser une fois par page ou par grille — pas par cellule, c'est tout l'objet
 * de la manœuvre.
 */
export function RevealScope({
  rootMargin = "600px",
  children,
}: {
  rootMargin?: string;
  children: ReactNode;
}) {
  const [observer] = useState(() => createRevealObserver(rootMargin));
  // ⚠️ PAS de `disconnect()` au démontage du scope, et ce n'est pas un oubli.
  //
  // Chaque cellule se désabonne déjà elle-même dans son propre nettoyage, donc
  // l'observateur n'a plus aucune cible quand la surface disparaît, et il est
  // ramassé avec elle. Un `disconnect()` au niveau du scope, lui, retire TOUTES
  // les cibles d'un coup — et selon l'ordre dans lequel React enchaîne les
  // nettoyages et les mises en place (il diffère entre effets de mise en page et
  // effets passifs), il pouvait s'exécuter APRÈS que les cellules se soient
  // réabonnées. L'observateur ne livrait alors plus rien : la fenêtre restait
  // figée sur les premières cellules et ne suivait plus le défilement.
  return <RevealCtx.Provider value={observer}>{children}</RevealCtx.Provider>;
}

interface RevealCellProps {
  /**
   * Hauteur réservée avant le premier passage de la cellule, en pixels.
   *
   * Dernier recours, pour une cellule dont la hauteur ne se déduit pas de sa
   * largeur (une ligne de liste, par exemple). Préférer `aspect` partout où la
   * cellule porte un visuel de ratio connu : la hauteur y est alors JUSTE dès la
   * première image, et la barre de défilement ne se réajuste pas au premier
   * parcours.
   */
  minHeight: number;
  /**
   * Ratio largeur/hauteur du visuel (2/3 pour une affiche, 16/9 pour une
   * vignette), et hauteur du bloc de texte qui le suit (`textHeight`).
   *
   * Une cellule vide connaît déjà sa LARGEUR — c'est la grille qui la lui donne.
   * `width × aspect⁻¹ + texte` est donc sa hauteur exacte, sans rien deviner.
   * Sans cela, la page grandissait de plusieurs centaines de pixels au premier
   * parcours, à mesure que chaque cellule découvrait sa vraie taille.
   */
  aspect?: number;
  textHeight?: number;
  /**
   * Monter dès le premier rendu, sans attendre l'observateur.
   *
   * À réserver aux premières cellules de la surface. Le rappel d'un
   * `IntersectionObserver` est asynchrone : sans cette avance, la première image
   * de la page montrerait une grille de cases vides, puis son contenu — un
   * clignotement à chaque arrivée. Inversement, le mettre partout rendrait le
   * premier rendu aussi lourd qu'avant, avant de retomber.
   */
  eager?: boolean;
  className?: string;
  children: ReactNode;
}

export function RevealCell({
  minHeight, aspect, textHeight = 0, eager = false, className, children,
}: RevealCellProps) {
  const observer = useContext(RevealCtx);
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);
  /** Hauteur à réserver : déduite de la largeur, puis mesurée. */
  const reserve = useRef(minHeight);

  // `useLayoutEffect` et non `useEffect` : la hauteur réservée doit être juste
  // AVANT la peinture, sinon la page grandit sous le curseur au premier parcours.
  useLayoutEffect(() => {
    const el = ref.current;
    // Hors de tout `RevealScope` : on monte, plutôt que de laisser un vide
    // définitif. Le composant reste ainsi utilisable seul.
    if (!observer) { setNear(true); return; }
    if (!el) return;
    // La largeur d'une cellule VIDE est déjà la bonne — c'est la grille qui la
    // donne : la hauteur s'en déduit sans rien deviner.
    //
    // Écrite dans le DOM, et pas seulement dans le ref : muter un ref ne
    // provoque aucun rendu, si bien que le style gardait la valeur de repli
    // jusqu'au prochain rendu de la cellule. C'était la cause de la page qui
    // s'allongeait de mille pixels en défilant une fois. Le ref sert aux rendus
    // suivants, où React reprend la main.
    if (aspect) {
      const width = el.clientWidth;
      if (width > 0) {
        reserve.current = width / aspect + textHeight;
        if (!near) el.style.minHeight = `${reserve.current}px`;
      }
    }
    return observer.observe(el, (visible) => {
      if (!visible) {
        // Mesurer AVANT de démonter, sinon on mesure le vide.
        const h = el.getBoundingClientRect().height;
        if (h > 0) reserve.current = h;
      }
      setNear(visible);
    });
  // `near` volontairement hors des dépendances : il ne doit pas relancer
  // l'abonnement. L'écriture impérative ci-dessus ne concerne que le premier
  // passage, où la cellule est vide par construction.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observer, aspect, textHeight]);

  return (
    <div ref={ref} className={className} style={near ? undefined : { minHeight: reserve.current }}>
      {near ? children : null}
    </div>
  );
}
