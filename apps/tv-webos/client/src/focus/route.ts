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

type Poseur = History["pushState"];

export function watchRoute(onChange: (path: string) => void): () => void {
  let precedent = window.location.pathname;

  const check = () => {
    const path = window.location.pathname;
    // Le routeur écrit aussi l'historique pour un simple changement de
    // paramètres — un filtre de bibliothèque, une saison. Ce n'est pas un
    // changement d'écran, et reposer le focus à ce moment-là le ferait sauter
    // sous les doigts de l'utilisateur.
    if (path === precedent) return;
    precedent = path;
    onChange(path);
  };

  const pushOrigin = window.history.pushState;
  const replaceOrigin = window.history.replaceState;

  const wrapper =
    (origin: Poseur): Poseur =>
    function (this: History, ...arguments_: Parameters<Poseur>) {
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
