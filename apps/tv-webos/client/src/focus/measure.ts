import { boxFromRect, type Box } from "@tentacle-tv/tv-core";

/**
 * La boîte qui sert à naviguer : celle de la mise en page, pas celle du rendu.
 *
 * La carte focalisée est agrandie de 8 % (`cards-tv.css`, origine « center
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
export interface PureScale {
  a: number;
  d: number;
  tx: number;
  ty: number;
}

/** Point du `transform-origin`, en pixels depuis le coin haut-gauche non transformé. */
export interface Origin {
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
export function readPureScale(transform: string): PureScale | null {
  if (!transform || transform === "none") return null;

  const matrix = /^matrix\(([^)]+)\)$/.exec(transform);
  if (!matrix) return null;

  const values = matrix[1].split(",").map((raw) => Number.parseFloat(raw));
  if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) return null;

  const [a, b, c, d, tx, ty] = values;
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
export function unscale(box: Box, scale: PureScale, origin: Origin): Box {
  const left = box.left - origin.x * (1 - scale.a) - scale.tx;
  const top = box.top - origin.y * (1 - scale.d) - scale.ty;

  return {
    left,
    top,
    right: left + (box.right - box.left) / scale.a,
    bottom: top + (box.bottom - box.top) / scale.d,
  };
}

/** L'origine calculée est toujours « Xpx Ypx » ; au moindre doute, on renonce. */
function readOrigin(transformOrigin: string): Origin | null {
  const [brutX, brutY] = transformOrigin.split(" ");
  const x = Number.parseFloat(brutX);
  const y = Number.parseFloat(brutY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/**
 * La boîte de navigation d'un élément.
 *
 * `rect` évite une seconde mesure quand l'appelant vient d'en faire une —
 * le recensement mesure déjà chaque candidat pour la fenêtre de viewport.
 */
export function navBox(element: HTMLElement, rect?: DOMRect): Box {
  const box = boxFromRect(rect ?? element.getBoundingClientRect());

  const style = window.getComputedStyle(element);
  const scale = readPureScale(style.transform);
  if (!scale) return box;

  const origin = readOrigin(style.transformOrigin);
  if (!origin) return box;

  return unscale(box, scale, origin);
}

/**
 * L'élément est-il encore dans la fenêtre ?
 *
 * Sert au réancrage du focus après un défilement au pointeur : la vue a pu
 * descendre de trois écrans sans que l'anneau bouge, et le laisser là ferait
 * remonter toute la page au premier appui de flèche, par `bringIntoView`.
 *
 * La marge est la même qu'au recensement — un demi-écran de part et d'autre —
 * et il faut que ce soit la même : un élément que le recensement accepte encore
 * comme voisin n'a aucune raison d'être considéré comme perdu ici.
 */
export function inWindow(element: HTMLElement, margin = 0.5): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const hauteur = window.innerHeight;
  const width = window.innerWidth;
  return (
    rect.bottom >= -hauteur * margin
    && rect.top <= hauteur * (1 + margin)
    && rect.right >= -width * margin
    && rect.left <= width * (1 + margin)
  );
}
