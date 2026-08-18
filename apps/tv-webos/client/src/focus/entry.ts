import { conteneurPiegeant, cibleAtteignable, estUnChampDeSaisie, recenser } from "./candidates";
import { ciblePreferee, estCiblePreferee, focusParDefaut } from "./default";
import { aUneMemoire, oublier, retrouver } from "./memory";
import { reviserApresMontage } from "./wait";
import { donnerFocus, elementActif } from "./active";

/**
 * Où le focus se pose en ARRIVANT sur un écran.
 *
 * Distinct du déplacement, et pour une raison de fond : déplacer le focus est
 * une réponse à un geste, le poser est une décision qu'on prend à la place de
 * l'utilisateur. La première se juge à la géométrie, la seconde à ce que
 * l'écran veut dire.
 *
 * Le défaut réparé ici se voyait partout : le focus initial n'était posé qu'au
 * démarrage. Ouvrir une fiche, revenir, changer de bibliothèque — chaque écran
 * suivant arrivait SANS anneau, `activeElement` retombé sur `<body>`, et le
 * premier appui sur une flèche ne servait qu'à le faire apparaître. Un appui
 * pour rien par écran, sur l'appareil où l'appui coûte le plus cher.
 *
 * **La pose se fait en deux temps**, parce que les données arrivent après le
 * rendu. Une bibliothèque affiche ses filtres en un rendu et ses affiches après
 * un aller-retour réseau : décider une seule fois, tout de suite, posait
 * l'anneau sur le premier filtre. Décider une seule fois, plus tard, laissait
 * l'écran sans anneau le temps du réseau. On fait donc les deux — au plus vite
 * avec ce qui est là, puis on remonte vers la vraie cible dès qu'elle paraît.
 *
 * Ce second temps s'annule dès que l'utilisateur appuie sur quoi que ce soit :
 * remonter le focus sous ses doigts serait pire que de l'avoir mal posé.
 */

/**
 * Temps laissé aux données d'un écran pour arriver.
 *
 * Le budget d'un déplacement — 250 ms — attend un MONTAGE. Celui-ci attend un
 * aller-retour RÉSEAU, ce qui n'est pas du même ordre : mesuré, une
 * bibliothèque chargée à froid dépasse la seconde et demie avant d'afficher sa
 * première affiche. Un budget d'une seconde expirait donc pile entre les deux,
 * et l'écran restait sans anneau.
 *
 * Trois secondes ne sont pas une attente : rien ne bloque, l'anneau est déjà
 * posé ailleurs, et l'utilisateur qui appuie annule tout. C'est un délai de
 * grâce, pas une latence.
 */
const BUDGET_ENTREE_MS = 3000;

/**
 * Durée pendant laquelle on tient l'écran précédent pour sortant.
 *
 * Le temps d'un rendu de React, pas davantage : au-delà, ce qui est encore là
 * est là pour rester.
 */
const DUREE_SORTANT_MS = 500;

/** Nombre d'appuis vus depuis le démarrage. Voir `noterAppui`. */
let appuisVus = 0;

/** Vrai pendant que le moteur pose lui-même le focus. Voir `placementEnCours`. */
let placementAutomatique = false;

/**
 * Relances restantes quand un écran n'a toujours rien à viser.
 *
 * Le démarrage à froid dépasse le délai de grâce : le moteur est installé avant
 * même le premier rendu de React, et sur une dalle le catalogue peut mettre
 * plusieurs secondes à répondre. Mesuré, l'accueil finissait sans anneau — la
 * seule règle qu'on ne s'autorise jamais à enfreindre.
 *
 * On relance donc, borné. Quatre tours de trois secondes couvrent un démarrage
 * lent sans jamais boucler : dès qu'un élément est focalisable, le compteur est
 * remis à zéro et la chaîne s'arrête.
 */
const RELANCES_MAX = 3;
let relances = 0;

/**
 * Les éléments de l'écran qu'on vient de quitter.
 *
 * Le routeur change l'adresse AVANT que React ne rende l'écran suivant : à
 * l'instant où l'on est prévenu, le document montre encore le précédent. Poser
 * le focus dessus le placerait sur une carte démontée la fraction de seconde
 * d'après, et l'écran finirait sans anneau — c'est exactement ce qu'on a
 * observé, deux fois de suite et à deux niveaux différents.
 *
 * Retirer le focus au sortant ne suffit donc pas : il faut refuser de le lui
 * rendre. On retient ses éléments, et on ne considère que ce qui n'en fait pas
 * partie. **Le rail y figure aussi**, ce qui tombe bien : on ne veut jamais
 * qu'il soit la cible d'entrée d'un écran.
 *
 * Une `WeakSet` : on ne veut retenir aucun de ces nœuds en vie.
 */
let ecranSortant: WeakSet<HTMLElement> | null = null;

/**
 * À appeler pour chaque touche reçue.
 *
 * Sert à une seule question, mais elle est décisive : l'utilisateur a-t-il pris
 * la main pendant qu'on attendait le montage d'un écran ? Si oui, remonter le
 * focus vers la cible d'entrée le lui arracherait des doigts.
 */
export function noterAppui(): void {
  appuisVus++;
}

/**
 * Vrai quand le focus qui vient de changer a été posé par le moteur.
 *
 * La mémoire enregistre où l'UTILISATEUR était, pas où nous avons deviné qu'il
 * fallait commencer. Sans cette question, la pose provisoire d'un écran
 * s'écrivait dans la mémoire de cet écran, et l'affinage y retrouvait sa propre
 * supposition — le focus ne remontait donc jamais vers la vraie cible.
 */
export function placementEnCours(): boolean {
  return placementAutomatique;
}

/**
 * @param quitteUnEcran vrai quand on vient de changer de route, faux au
 * démarrage. La distinction décide du sort du focus courant.
 */
export function amorcerFocus(quitteUnEcran = false): void {
  const depart = appuisVus;

  if (quitteUnEcran) {
    // Le focus courant appartient à l'écran qu'on quitte : on le lui retire, et
    // on retient tout ce qu'il expose pour ne pas le lui rendre.
    ecranSortant = new WeakSet(recenser(document).map((candidat) => candidat.element));
    elementActif()?.blur();

    // **Et on l'oublie vite.** Cette liste ne sert qu'à franchir l'instant qui
    // sépare le changement d'adresse du rendu de React ; au-delà, elle ment.
    //
    // Le cas qui l'a montré : arriver sur les réglages enchaîne DEUX
    // changements d'adresse, la redirection vers la première section. Au
    // second, l'écran des réglages est déjà monté — la photo le classait donc
    // parmi les sortants, et sa liste de sections restait exclue jusqu'à
    // l'épuisement du délai. Le focus gardait ce que l'ordre de lecture lui
    // avait donné : « Oublier ce jumelage », une action destructive.
    setTimeout(() => {
      ecranSortant = null;
    }, DUREE_SORTANT_MS);
  } else {
    ecranSortant = null;
  }

  // Tout de suite, avec ce qui est déjà là : un écran sans anneau est le pire
  // des cas, et il durerait aussi longtemps que le réseau.
  reviserApresMontage(poserFocusInitial);

  // Puis, le temps que les données arrivent.
  reviserApresMontage(
    () => {
      if (appuisVus !== depart) return true;
      return affinerFocus();
    },
    {
      budgetMs: BUDGET_ENTREE_MS,
      // Filet, et la règle qu'il fait tenir : il y a TOUJOURS exactement un
      // élément focalisé. Un écran dont les données n'arrivent pas — réseau
      // coupé, bibliothèque vide — perdrait sinon son anneau au démontage de
      // l'écran précédent, et la télécommande n'aurait plus rien à déplacer.
      auDelai: () => {
        // Le sortant a eu tout le temps de disparaître : ce qui reste est
        // l'écran courant, quel qu'il soit.
        ecranSortant = null;
        if (elementActif()) {
          relances = 0;
          return;
        }
        // La cible mémorisée n'est jamais reparue — liste vidée, élément
        // retiré, réseau muet. On renonce à elle plutôt que de laisser l'écran
        // sans anneau : c'est la règle qui prime sur toutes les autres.
        oublier();
        if (poserFocusInitial()) {
          relances = 0;
          return;
        }
        // Rien à viser : l'écran n'a pas encore rendu quoi que ce soit
        // d'atteignable. On rouvre un délai de grâce plutôt que d'abandonner.
        if (relances >= RELANCES_MAX) return;
        relances++;
        amorcerFocus();
      },
    },
  );
}

/**
 * La pose immédiate. Trois réponses, dans cet ordre, et l'ordre est le sujet :
 *
 * 1. **Ce qu'on avait quitté**, s'il se retrouve. Il passe en premier, sinon un
 *    composant qui prend le focus de lui-même au montage gagnerait la course
 *    contre la restitution.
 * 2. **Ce qui a déjà le focus**, s'il est atteignable et n'est pas un champ de
 *    saisie. Un écran qui désigne sa propre cible d'entrée est respecté ; un
 *    `<input>` ne l'est pas, parce que webOS y ouvrirait son clavier système.
 * 3. **Le focus par défaut de l'écran**, résolu par `default.ts`.
 */
function poserFocusInitial(): boolean {
  const racine = conteneurPiegeant() ?? document;

  // Un écran qui a DÉJÀ désigné sa cible d'entrée a raison contre nous, et
  // avant tout le reste — y compris avant le filtre de l'écran sortant.
  //
  // Sans cette règle, les réglages perdaient la leur. Ils se désignent
  // eux-mêmes, à la seule place d'où l'on sache quelle section est affichée ;
  // mais l'arrivée enchaîne deux changements d'adresse, la seconde photographie
  // un écran déjà monté, et la section s'en trouvait classée « sortante ». Notre
  // pose la remplaçait alors par ce que l'ordre de lecture proposait — « Oublier
  // ce jumelage », une action destructive.
  const deja = elementActif();
  if (deja && estCiblePreferee(deja) && cibleAtteignable(deja)) return true;

  // La mémoire ne ramène JAMAIS le focus dans un champ de saisie.
  //
  // C'était la seule des quatre portes d'entrée du focus à ne pas appliquer
  // cette règle — `default.ts`, `zones.ts` et `hoverFocus.ts` la respectent, et
  // la ligne 221 ci-dessous aussi. L'oubli suffisait à piéger la recherche.
  //
  // Mesuré sur l'émulateur webOS 4 : un `blur()` sur le champ produit bien
  // `keyboardStateChange visibility=false`, puis IMMÉDIATEMENT
  // `visibility=true`, sans que `document.activeElement` ait cessé d'être
  // l'`<input>`. C'est cette pose-ci qui l'y ramenait. webOS rouvrait donc son
  // clavier, `moteurSuspendu()` redevenait vrai, et plus une flèche n'était
  // traitée : ni pour descendre vers les résultats, ni pour remonter au champ.
  // Les deux symptômes n'en faisaient qu'un.
  const memorise = entrant(retrouver(racine));
  const memoireDansUnChamp = memorise !== null && estUnChampDeSaisie(memorise);
  if (memorise && !memoireDansUnChamp) {
    poser(memorise);
    return true;
  }

  const actif = elementActif();
  if (actif && entrant(actif) && cibleAtteignable(actif) && !estUnChampDeSaisie(actif)) return true;

  // Une trace existe, mais sa cible n'est pas encore montée. On ne pose RIEN :
  // amener une carte par défaut en vue remettrait la grille en haut et
  // détruirait le défilement restauré, si bien que la carte mémorisée ne serait
  // jamais montée. L'affinage la posera, et le filet de fin de budget garantit
  // que l'écran ne reste pas sans anneau.
  // Une trace dont la cible est un champ de saisie ne vaut pas d'attendre : la
  // laisser gouverner ici rendrait l'écran sans anneau, la pose ci-dessus
  // l'ayant justement refusée.
  if (aUneMemoire() && !memoireDansUnChamp) return true;

  const defaut = focusParDefaut(racine, candidatsEntrants(racine));
  if (!defaut) return false;
  poser(defaut);
  return true;
}

/** L'élément appartient-il à l'écran qui ARRIVE ? `null` passe au travers. */
function entrant(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;
  if (ecranSortant !== null && ecranSortant.has(element)) return null;
  return element;
}

function candidatsEntrants(racine: ParentNode) {
  const tous = recenser(racine);
  if (ecranSortant === null) return tous;
  const restants = tous.filter((candidat) => !ecranSortant?.has(candidat.element));
  // Tout appartient encore à l'écran sortant : rien n'est monté, on attend.
  return restants;
}

/**
 * Le second temps : remonter vers la cible d'entrée une fois les données là.
 *
 * Rend vrai quand il n'y a plus rien à attendre — soit qu'on ait placé le
 * focus, soit qu'il soit déjà au bon endroit. Rend faux tant que la cible n'est
 * pas montée, ce qui relance l'attente jusqu'à l'épuisement du budget.
 */
function affinerFocus(): boolean {
  const racine = conteneurPiegeant() ?? document;
  const actif = entrant(elementActif());

  const memorise = entrant(retrouver(racine));
  if (memorise) {
    if (memorise !== actif) poser(memorise);
    ecranSortant = null;
    return true;
  }

  if (actif && estCiblePreferee(actif)) {
    ecranSortant = null;
    return true;
  }

  // Une trace existe et sa cible n'est pas encore montée : on ATTEND.
  //
  // Se rabattre ici sur la première carte serait une décision qui s'annule
  // elle-même : l'amener en vue remet la grille en haut, la position restaurée
  // est perdue, et la carte mémorisée — qui vit trois lignes plus bas — ne sera
  // jamais montée ni retrouvée. Mesuré exactement ainsi : retour sur la
  // bibliothèque, défilement ramené de 958 à 266, focus sur la première affiche
  // au lieu de celle qu'on avait quittée.
  if (aUneMemoire()) return false;

  const preferee = ciblePreferee(racine, candidatsEntrants(racine));
  if (!preferee) return false;

  poser(preferee);
  ecranSortant = null;
  return true;
}

/** Pose le focus sans que la mémoire y voie un geste de l'utilisateur. */
function poser(element: HTMLElement): void {
  placementAutomatique = true;
  try {
    donnerFocus(element);
  } finally {
    placementAutomatique = false;
  }
}
