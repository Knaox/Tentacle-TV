/**
 * De combien faut-il défiler pour qu'un élément soit correctement posé.
 *
 * Module pur : il ne connaît ni le DOM ni les scrollers, il compare deux
 * segments. C'est ce qui le rend testable — et il a besoin de l'être, parce
 * que le cadrage se juge sur des cas qu'on ne reproduit pas à la main : un
 * élément à cheval sur le bord, un élément plus haut que la vue, un élément
 * pile sur la marge.
 *
 * **Pourquoi ce calcul nous appartient, et ne peut pas être laissé au
 * navigateur.** `element.focus({ preventScroll: true })` n'existe qu'à partir
 * de Chrome 64 ; la dalle en a 53. Blink y exécute son propre amené-en-vue, et
 * pour un élément PARTIELLEMENT visible il le RECENTRE verticalement. Mesuré
 * sur une liste d'épisodes : en remontant, une ligne affleurant le haut de
 * l'écran était renvoyée au milieu — un demi-écran de défilement pour un appui
 * qui en demandait un dixième, et l'anneau qui « redescend » alors qu'on
 * monte. `bringIntoView` ne rattrapait rien, puisqu'un élément recentré est dans
 * la marge et n'a plus rien à corriger. Le défaut ne se voit qu'à trois
 * mètres : sur un navigateur récent l'option est honorée et rien ne bouge.
 */

/** Une étendue sur un axe : bord d'entrée, bord de sortie. */
export interface Segment {
  start: number;
  end: number;
}

/**
 * Le MOU : ce qu'il reste à défiler de part et d'autre de la position
 * courante. C'est la connaissance du bord de document que ce module n'avait
 * pas — et sans elle, le scroll ne finissait JAMAIS à zéro ni au maximum :
 * la correction pose l'élément à la marge et s'arrête là, donc tout ce qui
 * précède le premier focusable — bannière, titre de section — restait coupé,
 * d'exactement la marge, quel que soit le nombre d'appuis.
 */
export interface Slack {
  before: number;
  after: number;
}

/**
 * La marge réellement tenable des deux côtés.
 *
 * Sur une surcouche courte — un panneau de choix de trois lignes —, deux fois
 * 96 px valent plus que la hauteur disponible : les deux bords se
 * contrediraient, et le focus oscillerait d'un appui à l'autre. On ramène donc
 * la marge à ce que la vue peut offrir, ce qui revient à centrer quand elle est
 * étroite. Nulle quand l'élément est plus grand que la vue.
 */
function tenableMargin(element: Segment, view: Segment, requested: number): number {
  const rest = view.end - view.start - (element.end - element.start);
  return Math.max(0, Math.min(requested, rest / 2));
}

/**
 * Le défilement à appliquer pour poser `element` dans `view`, marge comprise.
 *
 * Positif fait monter l'élément à l'écran — c'est le sens d'un `scrollTop` ou
 * d'un `scrollLeft` qui augmente. Zéro quand il n'y a rien à faire : c'est le
 * cas le plus fréquent, et le seul qui garantisse qu'un déplacement horizontal
 * dans une rangée ne fasse pas trembler la page verticalement.
 *
 * Les deux bords sont traités dans l'ordre, jamais ensemble. Un élément plus
 * grand que la vue déborde des deux côtés : la marge tombe alors à zéro et
 * l'on aligne son DÉBUT, ce qu'on veut lire en premier — et surtout ce qui est
 * stable, là où corriger les deux bords tour à tour oscillerait.
 *
 * Avec un `slack`, la correction connaît les bords : elle s'y borne — écrire
 * plus loin serait clampé par le navigateur, un état qu'on n'a pas calculé —
 * et quand le reliquat après application tiendrait DANS la marge, elle le
 * consomme et COLLE au bord. Poser le premier élément à la marge en laissant
 * 40 px de bannière coupés au-dessus n'aide personne : l'accrochage rend le
 * haut de page au premier focusable, le bas au dernier. Il ne s'arme que si
 * l'on corrigeait déjà — jamais de défilement sans déplacement du focus — et
 * il est stable : une fois collé, le mou de ce côté est nul, et la correction
 * suivante rend zéro.
 */
export function correction(element: Segment, view: Segment, margin: number, slack?: Slack): number {
  const usable = tenableMargin(element, view, margin);

  const missingAtStart = element.start - usable - view.start;
  if (missingAtStart < 0) return towardsEdge(missingAtStart, slack, margin);

  const overshootsAtEnd = element.end + usable - view.end;
  if (overshootsAtEnd > 0) return towardsEdge(overshootsAtEnd, slack, margin);

  return 0;
}

/** Borne un delta au mou disponible, et colle au bord quand le reliquat
 *  tiendrait dans la marge. Sans mou, le delta ressort tel quel. */
function towardsEdge(delta: number, slack: Slack | undefined, margin: number): number {
  if (!slack) return delta;

  if (delta < 0) {
    const bound = Math.max(delta, -slack.before);
    return slack.before + bound <= margin ? -slack.before : bound;
  }
  const bound = Math.min(delta, slack.after);
  return slack.after - bound <= margin ? slack.after : bound;
}
