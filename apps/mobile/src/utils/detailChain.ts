/**
 * La chaîne de fiches : une fiche ouverte PAR-DESSUS une fiche prend sa place
 * dans la pile au lieu de s'y ajouter.
 *
 * On part de l'accueil, on ouvre un film, puis un titre similaire, puis encore
 * un autre : un seul retour — bouton, geste de bord iOS, touche Retour
 * d'Android — doit ramener à l'accueil, pas redescendre les fiches une à une.
 * C'est la page d'où la chaîne est partie (accueil, bibliothèque, Ma liste…)
 * qu'on veut retrouver, et elle est restée montée sous la pile, défilement
 * compris.
 *
 * La règle porte sur la PILE, pas sur le lien suivi : titres similaires,
 * épisode → série, filmographie ouverte depuis le casting (la recherche est une
 * modale refermée avant d'ouvrir la fiche), page d'extension. Tous finissent
 * avec une fiche posée sur une fiche, tous se replient. Même règle que le web
 * et le bureau (`apps/web/src/lib/detailChain.ts`), qui remplacent l'entrée
 * d'historique.
 */
export const DETAIL_ROUTE = "media/[itemId]";

interface RouteLike {
  key: string;
  name: string;
}

/**
 * Les routes de la pile une fois la chaîne repliée, ou `null` s'il n'y a rien
 * à replier.
 *
 * Retire les fiches CONTIGUËS juste sous `currentKey` — toutes, pas seulement
 * la voisine : si une étape a échappé au repli (écran quitté pendant sa
 * transition), la suivante rattrape. Une fiche sous un autre écran (lecteur,
 * bibliothèque) reste : cet écran est une origine.
 */
export function collapseDetailChain<R extends RouteLike>(routes: readonly R[], currentKey: string): R[] | null {
  const at = routes.findIndex((r) => r.key === currentKey);
  if (at < 1 || routes[at].name !== DETAIL_ROUTE) return null;
  let start = at;
  while (start > 0 && routes[start - 1].name === DETAIL_ROUTE) start -= 1;
  if (start === at) return null;
  return [...routes.slice(0, start), ...routes.slice(at)];
}
