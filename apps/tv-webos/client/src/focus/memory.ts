import { FOCUSABLE_SELECTOR, reachableTarget } from "./candidates";

/**
 * Ce que le focus a quitté, pour le lui rendre en revenant.
 *
 * Le moteur est spatial et sans état : il ne connaît ni route ni historique.
 * Sans mémoire, un aller-retour — une carte, sa fiche, Retour — reposait le
 * focus là où le hasard du DOM le voulait, et jamais sur la carte d'où l'on
 * venait. Mesuré : le défilement de la grille était bien restauré, mais le
 * premier appui sur Bas faisait REMONTER la page jusqu'à la première carte,
 * parce que le recensement va jusqu'à un demi-écran au-dessus du viewport et
 * que le candidat le plus haut l'emportait.
 *
 * **On mémorise une CLÉ, pas un élément.** Revenir sur un écran le remonte : la
 * référence d'origine ne désigne plus rien, et une `WeakRef` ne réparerait que
 * le cas où le DOM a survécu — celui d'une surcouche qui se referme, pas celui
 * d'une navigation. Il faut donc de quoi RETROUVER la cible dans un document
 * reconstruit.
 *
 * La clé se tire de ce que l'élément porte déjà, par ordre de fiabilité
 * décroissante : un marqueur que nous posons nous-mêmes, une adresse, un
 * libellé accessible, puis le texte. Aucun ne survit à tout — un titre traduit
 * change avec la langue —, mais la langue ne change pas entre deux écrans, et
 * un échec de restitution retombe sur le focus par défaut. Le pire cas est
 * l'état d'avant, jamais pire.
 *
 * **Rien n'est mémorisé par conteneur, et c'est un choix.** La géométrie s'en
 * charge déjà : descendre d'une rangée puis remonter revient sur la même carte,
 * puisque « bas » puis « haut » visent la même colonne. Vérifié sur une grille
 * de bibliothèque. Ajouter un registre par rangée dupliquerait cette garantie
 * en s'exposant à diverger d'elle.
 */

/** Longueur au-delà de laquelle un libellé ne discrimine plus rien d'utile. */
const MAX_LABEL = 48;

/**
 * Nombre d'écrans dont on garde la trace.
 *
 * Une session de salon peut en visiter des centaines. La `Map` conserve son
 * ordre d'insertion, donc on retire toujours le plus ancien — et le plus ancien
 * est celui vers lequel un retour est le moins probable.
 */
const GUARDED_ROUTES = 32;

const parRoute = new Map<string, string>();

/**
 * De quoi retrouver un élément dans un document reconstruit.
 *
 * `null` quand rien ne le distingue : une icône sans libellé accessible dans
 * une barre qui en compte plusieurs identiques. On préfère ne rien mémoriser
 * que de restituer le focus au mauvais bouton.
 */
export function elementKey(element: HTMLElement): string | null {
  const marque = element.getAttribute("data-tv-cle");
  if (marque) return `m|${marque}`;

  const address = element.getAttribute("href");
  if (address) return `h|${address}`;

  const label = normalize(element.getAttribute("aria-label") ?? "");
  if (label) return `${element.tagName}|a|${label}`;

  const text = normalize(element.textContent ?? "");
  if (text) return `${element.tagName}|t|${text}`;

  return null;
}

function normalize(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL);
}

function routeCourante(): string {
  return window.location.pathname;
}

/**
 * Note où le focus se trouve, pour l'écran courant.
 *
 * Appelée à chaque déplacement du focus, quelle qu'en soit l'origine — flèche,
 * pointeur, ou restitution. Les paramètres de requête sont volontairement hors
 * de la clé : changer un filtre de bibliothèque ne doit pas faire oublier la
 * carte qu'on regardait.
 *
 * **Le rail n'est jamais retenu.** La clé est unique par route : focaliser une
 * entrée de navigation ÉCRASAIT la carte mémorisée, et le retour sur l'écran
 * restituait le focus… dans le rail. Ce qu'on avait quitté, c'est le contenu ;
 * le rail n'est qu'un couloir qu'on traverse. (Le littéral est volontairement
 * local : l'importer de `zones.ts` refermerait un cycle, `zones` lisant déjà
 * `recover` d'ici.)
 */
export function remember(element: HTMLElement): void {
  if (element.closest(".rail-tv")) return;

  const key = elementKey(element);
  if (!key) return;

  const route = routeCourante();
  // Réinsérer remet la route en fin de file : les écrans qu'on fréquente
  // survivent à l'élagage, ceux qu'on a traversés une fois s'effacent.
  parRoute.delete(route);
  parRoute.set(route, key);

  if (parRoute.size > GUARDED_ROUTES) {
    const oldest = parRoute.keys().next();
    if (!oldest.done) parRoute.delete(oldest.value);
  }
}

/** L'élément à qui rendre le focus sur l'écran courant, s'il est retrouvé. */
export function recover(racine: ParentNode = document): HTMLElement | null {
  const key = parRoute.get(routeCourante());
  if (!key) return null;

  for (const node of racine.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    if (elementKey(node) !== key) continue;
    // Retrouvé mais inatteignable — masqué, désactivé, dans une enveloppe
    // transparente : ce serait un trou noir. On laisse la main au focus par
    // défaut.
    if (!reachableTarget(node)) continue;
    return node;
  }

  return null;
}

/**
 * L'écran courant a-t-il une trace, même si sa cible n'est pas encore montée ?
 *
 * La distinction est tout sauf théorique. Une grille est fenêtrée : au retour,
 * la carte qu'on avait quittée n'existe dans le document qu'une fois le
 * défilement restauré. Poser entre-temps un focus « par défaut » sur la
 * première carte l'amène en vue — donc REMET LA GRILLE EN HAUT, donc détruit la
 * position restaurée, donc la carte mémorisée ne sera jamais montée et ne sera
 * jamais retrouvée. Le repli s'auto-réalisait.
 *
 * Savoir qu'une trace existe permet d'attendre sans rien casser. Le filet de
 * fin de budget garantit que l'écran ne reste pas sans anneau si elle ne
 * reparaît pas.
 */
export function hasMemory(): boolean {
  return parRoute.has(routeCourante());
}

/** Efface la trace de l'écran courant. Pour les tests, et pour un écran dont
 *  le contenu a changé de sens — une liste vidée, un compte déconnecté. */
export function forget(route: string = routeCourante()): void {
  parRoute.delete(route);
}
