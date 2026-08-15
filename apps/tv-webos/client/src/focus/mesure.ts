import { boiteDepuisRectangle, type Boite } from "./geometrie";

/**
 * La boîte qui sert à naviguer : celle de la mise en page, pas celle du rendu.
 *
 * La carte focalisée est agrandie de 8 % (`cartes-tv.css`, origine « center
 * bottom ») et `getBoundingClientRect` rend la boîte APRÈS transformation. Deux
 * dégâts mesurés sur une grille : le bord haut remonte de ~26 px, ce qui fait
 * passer la rangée du dessus sous la tolérance de départ — « haut » ne trouvait
 * plus rien et sautait deux rangées après un défilement ; et les bords latéraux
 * mordent la gouttière, ce qui réduit de moitié la pénalité de désalignement de
 * la colonne voisine — d'où des départs en diagonale que rien ne justifiait.
 *
 * On inverse donc la transformation de l'élément LUI-MÊME quand c'est une
 * échelle (accompagnée ou non d'une translation, ce que `scale()` seul produit
 * aussi dès que l'origine n'est pas le centre). Une translation PURE n'est pas
 * compensée : c'est du positionnement — les lignes virtualisées d'une grille se
 * posent par `translateY` — et l'annuler renverrait la boîte là où l'élément
 * n'est pas. Les transformations d'ancêtres ne sont pas touchées non plus,
 * pour la même raison : elles placent, elles ne décorent pas.
 *
 * L'inversion est exacte à chaque instant de la transition de 180 ms : la
 * matrice intermédiaire lue pendant l'animation est inversée comme les autres.
 */

/** Échelle 2D affine sans rotation : `matrix(a, 0, 0, d, tx, ty)`. */
export interface EchellePure {
  a: number;
  d: number;
  tx: number;
  ty: number;
}

/** Point du `transform-origin`, en pixels depuis le coin haut-gauche non transformé. */
export interface Origine {
  x: number;
  y: number;
}

/**
 * Lit une échelle à inverser dans un `transform` calculé.
 *
 * `null` dans tous les cas où il n'y a rien à corriger — pas de transformation,
 * translation pure — ou rien à corriger SANS RISQUE : rotation, cisaillement,
 * `matrix3d`, échelle nulle ou négative. Le style calculé rend toujours une
 * matrice résolue, jamais la fonction d'origine.
 */
export function lireEchellePure(transform: string): EchellePure | null {
  if (!transform || transform === "none") return null;

  const matrice = /^matrix\(([^)]+)\)$/.exec(transform);
  if (!matrice) return null;

  const valeurs = matrice[1].split(",").map((brut) => Number.parseFloat(brut));
  if (valeurs.length !== 6 || valeurs.some((valeur) => !Number.isFinite(valeur))) return null;

  const [a, b, c, d, tx, ty] = valeurs;
  if (b !== 0 || c !== 0) return null;
  if (a <= 0 || d <= 0) return null;
  if (a === 1 && d === 1) return null;

  return { a, d, tx, ty };
}

/**
 * Défait une échelle autour de son origine.
 *
 * Un point `p` de la boîte de mise en page est rendu en `o + m·(p − o) + t`.
 * Le coin haut-gauche s'en déduit sans connaître la boîte d'origine : seul
 * l'écart au point d'origine est mis à l'échelle, donc
 * `gauche = gauche' − x·(1 − a) − tx`, et les dimensions se divisent.
 *
 * Fonction pure, et testée : c'est de l'arithmétique de rectangles, exactement
 * ce qu'un test sait juger.
 */
export function inverserEchelle(boite: Boite, echelle: EchellePure, origine: Origine): Boite {
  const gauche = boite.gauche - origine.x * (1 - echelle.a) - echelle.tx;
  const haut = boite.haut - origine.y * (1 - echelle.d) - echelle.ty;

  return {
    gauche,
    haut,
    droite: gauche + (boite.droite - boite.gauche) / echelle.a,
    bas: haut + (boite.bas - boite.haut) / echelle.d,
  };
}

/** L'origine calculée est toujours « Xpx Ypx » ; au moindre doute, on renonce. */
function lireOrigine(transformOrigin: string): Origine | null {
  const [brutX, brutY] = transformOrigin.split(" ");
  const x = Number.parseFloat(brutX);
  const y = Number.parseFloat(brutY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/**
 * La boîte de navigation d'un élément.
 *
 * `rectangle` évite une seconde mesure quand l'appelant vient d'en faire une —
 * le recensement mesure déjà chaque candidat pour la fenêtre de viewport.
 */
export function boiteDeNavigation(element: HTMLElement, rectangle?: DOMRect): Boite {
  const boite = boiteDepuisRectangle(rectangle ?? element.getBoundingClientRect());

  const style = window.getComputedStyle(element);
  const echelle = lireEchellePure(style.transform);
  if (!echelle) return boite;

  const origine = lireOrigine(style.transformOrigin);
  if (!origine) return boite;

  return inverserEchelle(boite, echelle, origine);
}

/**
 * L'élément est-il encore dans la fenêtre ?
 *
 * Sert au réancrage du focus après un défilement au pointeur : la vue a pu
 * descendre de trois écrans sans que l'anneau bouge, et le laisser là ferait
 * remonter toute la page au premier appui de flèche, par `amenerEnVue`.
 *
 * La marge est la même qu'au recensement — un demi-écran de part et d'autre —
 * et il faut que ce soit la même : un élément que le recensement accepte encore
 * comme voisin n'a aucune raison d'être considéré comme perdu ici.
 */
export function dansLaFenetre(element: HTMLElement, marge = 0.5): boolean {
  const rectangle = element.getBoundingClientRect();
  if (rectangle.width === 0 && rectangle.height === 0) return false;
  const hauteur = window.innerHeight;
  const largeur = window.innerWidth;
  return (
    rectangle.bottom >= -hauteur * marge
    && rectangle.top <= hauteur * (1 + marge)
    && rectangle.right >= -largeur * marge
    && rectangle.left <= largeur * (1 + marge)
  );
}
