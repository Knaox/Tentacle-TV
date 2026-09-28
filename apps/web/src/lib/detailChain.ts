import { UNSAFE_createBrowserHistory, parsePath } from "react-router-dom";
import type { To } from "react-router-dom";

/**
 * La chaîne de fiches : une fiche ouverte DEPUIS une fiche remplace l'entrée
 * d'historique au lieu de s'empiler.
 *
 * On part de l'accueil, on ouvre un film, puis un titre similaire, puis encore
 * un autre : un seul « retour » doit ramener à l'accueil, pas remonter les
 * trois fiches une à une. La fiche n'est pas un lieu où l'on revient — c'est la
 * page d'où la chaîne est partie (accueil, bibliothèque, recherche, liste…) qui
 * l'est, et elle garde sa position de défilement, mémorisée par adresse
 * (`useScrollMemory`) : remplacer une fiche par une autre n'y touche pas.
 *
 * La règle ne dépend que de l'adresse de départ et de celle d'arrivée, jamais
 * du lien suivi : titres similaires, contenu d'une collection, épisode → série,
 * omnibox ouverte par-dessus une fiche, page d'extension qui demande une fiche.
 * Tous mènent d'une fiche à une fiche, tous remplacent. Le lecteur n'en fait
 * pas partie : il s'empile, et en sortir rend la fiche qu'on quittait.
 */
const DETAIL_PATH = /^\/media\/[^/]+\/?$/;

/** L'adresse désigne-t-elle une fiche média ? */
export function isDetailPath(pathname: string): boolean {
  return DETAIL_PATH.test(pathname);
}

/**
 * La navigation de `from` vers `to` doit-elle REMPLACER l'entrée courante ?
 *
 * `to` est ce que le routeur passe à son historique : déjà résolu en absolu
 * (chaîne ou objet `Path` partiel). Un objet sans `pathname` reste sur la même
 * adresse — changer la requête d'une fiche ne sort pas de la chaîne.
 */
export function replacesDetailEntry(fromPathname: string, to: To): boolean {
  if (!isDetailPath(fromPathname)) return false;
  const target = typeof to === "string" ? parsePath(to).pathname : to.pathname;
  return isDetailPath(target ?? fromPathname);
}

type BrowserHistory = ReturnType<typeof UNSAFE_createBrowserHistory>;

/**
 * L'historique du navigateur, avec la chaîne de fiches appliquée à `push`.
 *
 * Un seul point pour toute l'application : c'est le `navigator` du routeur,
 * que traversent `navigate()` comme `<Link>`. Poser l'option `replace` à
 * chaque lien vers une fiche en aurait oublié — il y en a une trentaine, dans
 * les cartes, l'aperçu au survol, l'omnibox, le miroir, les recommandations.
 *
 * Aucune méthode ne dépend de `this` : le routeur appelle `push` détaché
 * (`(replace ? navigator.replace : navigator.push)(…)`).
 */
export function withDetailChain(base: BrowserHistory): BrowserHistory {
  return {
    get action() { return base.action; },
    get location() { return base.location; },
    createHref: (to) => base.createHref(to),
    createURL: (to) => base.createURL(to),
    encodeLocation: (to) => base.encodeLocation(to),
    push: (to, state) => {
      if (replacesDetailEntry(base.location.pathname, to)) base.replace(to, state);
      else base.push(to, state);
    },
    replace: (to, state) => base.replace(to, state),
    go: (delta) => base.go(delta),
    listen: (listener) => base.listen(listener),
  };
}

/**
 * Ce que `BrowserRouter` fabrique lui-même (`v5Compat` : les écouteurs sont
 * aussi prévenus des `push`/`replace`, pas seulement des retours), enveloppé.
 */
export function createAppHistory(): BrowserHistory {
  return withDetailChain(UNSAFE_createBrowserHistory({ v5Compat: true }));
}
