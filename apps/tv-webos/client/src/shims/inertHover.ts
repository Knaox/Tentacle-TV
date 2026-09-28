/**
 * Le survol, éteint côté JavaScript.
 *
 * `hoverPass` retire les règles `:hover` de la feuille ; il reste les
 * gestionnaires `onMouseEnter` du client web, que le CSS ne peut pas atteindre.
 * Ce sont eux qui font basculer `data-hovered`, qui montent les révélations et
 * qui posent des écouteurs globaux. Ce module remplace les hooks qui les
 * portent.
 *
 * Il en remplace deux pour un seul motif, d'où le fichier unique — deux
 * entrées de `substitutionTable.ts` pointent ici :
 *
 *   • `useHoverGuard` — pose un écouteur `pointermove` global **à l'import du
 *     module**, avant même qu'un composant soit monté. Le neutraliser demandait
 *     de ne pas charger le module du tout.
 *   • `useHoverMount` — monte à la demande les flèches de bannière et les
 *     chevrons de rangée. Rendre `mounted` toujours faux les retire du DOM :
 *     ce sont des commandes de souris, et la règle de coût GPU du dépôt veut
 *     qu'on démonte plutôt qu'on masque.
 *
 * Ce qui n'est PAS éteint : le **clic**. Le moteur de focus gère déjà un mode
 * pointeur (`focus/cursor.ts`) et s'efface quand la Magic Remote est visible.
 * On retire la sélection au survol, pas le pointeur.
 */

function nothingAry(): void {
  /* Le survol n'existe pas sur un téléviseur. */
}

// Identités stables : ces objets partent en props vers des composants mémoïsés,
// une nouvelle identité à chaque rendu les re-rendrait pour rien.
const HANDLERS = { onMouseEnter: nothingAry, onMouseLeave: nothingAry } as const;

/** Sans pointeur à surveiller, il n'y a rien à revalider. */
export function useHoverGuard(
  _ref: React.RefObject<HTMLElement | null>,
  _active: boolean,
  _onExit: () => void,
): void {
  /* Aucun écouteur global. */
}

/** Même raison que ci-dessus, pour la barre de progression du lecteur. */
export function useHoverEscape(
  _ref: React.RefObject<HTMLElement | null>,
  _active: boolean,
  _onExit: () => void,
): void {
  /* Aucun écouteur global. */
}

/**
 * `true` reprend la sémantique du client web quand il n'y a rien à interroger :
 * ne pas conclure au départ du pointeur. Aucun appelant n'en dépend ici, la
 * fonction n'existe que pour que le module reste substituable en bloc.
 */
export function pointerStillOn(_element: HTMLElement | null): boolean {
  return true;
}

/**
 * `mounted` toujours faux : les commandes révélées au survol ne sont jamais
 * montées. `hovered` suit, pour que le style de l'appelant reste cohérent.
 */
export function useHoverMount(_exitMs: number): {
  hovered: boolean;
  mounted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
} {
  return { hovered: false, mounted: false, ...HANDLERS };
}
