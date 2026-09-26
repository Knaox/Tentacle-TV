/**
 * Savoir qu'on a changé d'écran, sans que le routeur ait à le dire.
 *
 * Le focus initial n'était posé qu'une fois, au démarrage. Toute navigation
 * ultérieure — ouvrir une fiche, revenir en arrière, changer de bibliothèque —
 * laissait donc l'écran suivant SANS aucun élément focalisé : `activeElement`
 * retombait sur `<body>` au démontage du précédent, et le premier appui sur une
 * flèche ne servait qu'à poser l'anneau. Sur une télécommande, c'est un appui
 * pour rien à chaque écran.
 *
 * `apps/web` n'est pas modifié, donc le routeur ne nous préviendra pas. On
 * observe l'historique lui-même : `pushState` et `replaceState` sont les deux
 * seules portes par lesquelles React Router change d'adresse, et `popstate`
 * couvre le retour. C'est la même surface que celle qu'écoute déjà
 * `focus/back.ts` de l'autre côté.
 *
 * **On enveloppe, on ne remplace pas.** La méthode d'origine est appelée la
 * première, avec son `this` et ses arguments intacts ; nous n'ajoutons qu'une
 * notification après coup. Et le débranchement rend les méthodes d'origine,
 * pour qu'un module installé deux fois — ce que fait React en mode strict — ne
 * laisse pas une chaîne d'enveloppes derrière lui.
 */

type Setter = History["pushState"];

/** La route du lecteur, sous la base `/tv` du portage. */
const PLAYER_PATH = "/tv/watch";

/**
 * Le chemin est-il celui du lecteur ?
 *
 * Le préfixe doit s'arrêter à une frontière de segment. `startsWith("/tv/watch")`
 * répondait vrai sur **`/tv/watchlist`** : le moteur s'y croyait dans le
 * lecteur, se suspendait faute d'habillage à piloter, et Ma liste devenait
 * entièrement impilotable — aucune flèche n'y faisait quoi que ce soit. Le
 * défaut ne se voyait pas au premier essai : on arrive sur cet écran par le
 * rail, dont les entrées gardent le focus, et tout semble normal jusqu'à ce
 * qu'on tente d'en descendre.
 *
 * Une seule définition pour tout le moteur. La touche Retour tenait sa propre
 * copie, restée sur l'ancien préfixe : quitter Ma liste y passait pour une
 * sortie du lecteur.
 */
export function isPlayerPath(path: string): boolean {
  return path === PLAYER_PATH || path.startsWith(`${PLAYER_PATH}/`);
}

/** Sommes-nous sur la route du lecteur ? */
export function onPlayerRoute(): boolean {
  return isPlayerPath(window.location.pathname);
}

export function watchRoute(onChange: (path: string) => void): () => void {
  let previous = window.location.pathname;

  const check = () => {
    const path = window.location.pathname;
    // Le routeur écrit aussi l'historique pour un simple changement de
    // paramètres — un filtre de bibliothèque, une saison. Ce n'est pas un
    // changement d'écran, et reposer le focus à ce moment-là le ferait sauter
    // sous les doigts de l'utilisateur.
    if (path === previous) return;
    previous = path;
    onChange(path);
  };

  const pushOrigin = window.history.pushState;
  const replaceOrigin = window.history.replaceState;

  const wrapper =
    (origin: Setter): Setter =>
    function (this: History, ...arguments_: Parameters<Setter>) {
      origin.apply(this, arguments_);
      check();
    };

  window.history.pushState = wrapper(pushOrigin);
  window.history.replaceState = wrapper(replaceOrigin);
  window.addEventListener("popstate", check);

  return () => {
    window.history.pushState = pushOrigin;
    window.history.replaceState = replaceOrigin;
    window.removeEventListener("popstate", check);
  };
}
