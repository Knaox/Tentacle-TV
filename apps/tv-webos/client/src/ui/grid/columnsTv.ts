import { useState, useEffect, useCallback, type RefObject } from "react";

/**
 * Le nombre de colonnes de la grille de bibliothèque — et, sur cette cible, la
 * largeur des cartes.
 *
 * **Pourquoi ce hook est substitué.** `LibraryGrid` pose ses colonnes en style
 * EN LIGNE : `gridTemplateColumns: repeat(n, 1fr)` et `gap: 16`. Les passes
 * PostCSS ne lisent que la feuille produite — un attribut `style` leur est
 * invisible, et `gardeCompat` laisse donc passer le build sans un mot. Sur la
 * dalle, `.grid` est bien devenu `flex` mais aucune de ces deux déclarations
 * n'existe avant Chrome 57 et Chrome 84 : les cartes n'ont plus ni largeur ni
 * écart, et la grille s'effondre sur la largeur de leur titre.
 *
 * Le composant fait 258 lignes et n'a par ailleurs aucun défaut. Le forker pour
 * une déclaration serait le meilleur moyen de le laisser diverger. Ce hook, lui,
 * en fait 32 : il est le seul endroit d'où la largeur est déjà connue, et il
 * suffit qu'il la publie pour que la feuille fasse le reste.
 *
 * **Et la mesure change aussi.** L'original lit `entry.contentRect.width`. Le
 * polyfill de cette cible rendait une boîte de bordure — corrigé depuis, mais
 * la dépendance restait fragile pour une valeur dont dépend toute la mise en
 * page. On mesure donc ici, à partir de `clientWidth` moins les paddings
 * calculés : l'observateur ne sert plus qu'à dire QUAND remesurer.
 */

const LARGEUR_MINIMALE = 180;
const ECART = 16;

/** Deux colonnes au minimum : une grille d'une colonne n'est plus une grille. */
function colonnesPour(largeur: number): number {
  if (largeur <= 0) return 2;
  return Math.max(2, Math.floor((largeur + ECART) / (LARGEUR_MINIMALE + ECART)));
}

export function useItemsPerRow(containerRef: RefObject<HTMLDivElement | null>) {
  const [itemsPerRow, setItemsPerRow] = useState(6);
  const [containerWidth, setContainerWidth] = useState(0);

  const update = useCallback((element: HTMLElement) => {
    const largeur = largeurDeContenu(element);
    const colonnes = colonnesPour(largeur);
    setContainerWidth(largeur);
    setItemsPerRow(colonnes);
    publier(element, largeur, colonnes);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    // Le marqueur porte la portée de la règle : sans lui, `.grid > *` toucherait
    // aussi le squelette de chargement, dont les colonnes viennent de
    // `.grid-cols-N` et sont déjà traitées par la passe de grille.
    element.setAttribute("data-tv-grille", "");
    update(element);

    if (typeof ResizeObserver !== "function") return;
    const observateur = new ResizeObserver(() => update(element));
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [containerRef, update]);

  return { itemsPerRow, containerWidth };
}

/**
 * Publie la largeur de carte sur le conteneur lui-même, pas sur la racine.
 *
 * Les variables CSS héritent : la règle de la feuille la retrouve depuis
 * n'importe quelle profondeur, et deux grilles montées en même temps ne se
 * marchent pas dessus.
 *
 * La valeur est la même que celle dont `estimateSize` déduit la hauteur d'une
 * ligne. Les deux doivent rester d'accord, sinon le virtualiseur réserve une
 * hauteur qui ne correspond à rien de ce qui est dessiné.
 */
function publier(element: HTMLElement, largeur: number, colonnes: number): void {
  const carte = colonnes > 0 ? (largeur - ECART * (colonnes - 1)) / colonnes : 0;
  element.style.setProperty("--tv-grille-carte", `${Math.max(0, Math.floor(carte))}px`);
  // Zéro quand le moteur pose déjà l'écart lui-même : la marge s'y AJOUTERAIT.
  element.style.setProperty("--tv-grille-ecart", `${gapFlexApplique() ? 0 : ECART}px`);
}

/**
 * Le moteur applique-t-il `gap` à un conteneur flex ?
 *
 * Question qui n'a l'air de rien et qui décide de la mise en page entière.
 * `LibraryGrid` pose `gap: 16` en style EN LIGNE, hors de portée des passes
 * PostCSS comme de la garde de compatibilité. Sur Chrome 53 la déclaration est
 * ignorée — `gap` n'arrive en flexbox qu'avec Chrome 84 — et la marge droite
 * posée par `grid-tv.css` est le seul écart. Sur un navigateur récent, les
 * DEUX s'appliquent : l'écart réel passe de 201 à 217 px, la cinquième carte ne
 * tient plus sur sa ligne, elle passe à la suivante — et comme les lignes sont
 * virtualisées et positionnées en absolu, elle vient RECOUVRIR la ligne d'après.
 * C'est le chevauchement signalé dans la colonne de gauche.
 *
 * On ne peut pas trancher par `CSS.supports("gap", "1px")` : la propriété est
 * reconnue dès Chrome 66 pour les grilles, dix-huit versions avant que la
 * flexbox n'en fasse quoi que ce soit. La seule réponse fiable est la mesure —
 * un conteneur flex hors écran, deux enfants, et on regarde ce qui les sépare.
 *
 * Faite une fois, retenue ensuite : le moteur ne change pas en cours de route.
 */
let gapFlex: boolean | null = null;

function gapFlexApplique(): boolean {
  if (gapFlex !== null) return gapFlex;

  const sonde = document.createElement("div");
  sonde.style.cssText =
    "display:flex;flex-wrap:nowrap;gap:8px;position:absolute;top:-1000px;left:-1000px;visibility:hidden";
  const premier = document.createElement("span");
  const second = document.createElement("span");
  premier.style.cssText = "width:20px;height:4px;flex:0 0 auto";
  second.style.cssText = premier.style.cssText;
  sonde.appendChild(premier);
  sonde.appendChild(second);
  document.body.appendChild(sonde);

  const separation = second.getBoundingClientRect().left - premier.getBoundingClientRect().right;
  sonde.parentNode?.removeChild(sonde);

  gapFlex = separation > 4;
  return gapFlex;
}

function largeurDeContenu(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  const interieur =
    element.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight);
  return Math.max(0, interieur);
}

function pixels(valeur: string): number {
  const nombre = parseFloat(valeur);
  return Number.isFinite(nombre) ? nombre : 0;
}
