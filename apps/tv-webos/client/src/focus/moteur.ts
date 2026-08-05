import { lireIntention, estHorizontale, type Direction } from "./touches";
import { recenser, conteneurPiegeant, estUnChampDeSaisie } from "./candidats";
import { focusParDefaut } from "./defaut";
import { retenir } from "./memoire";
import { surveillerRoute } from "./route";
import { amorcerFocus, noterAppui, placementEnCours } from "./entree";
import { donnerFocus, elementActif } from "./actif";
import { boiteDepuisRectangle, meilleur, surLaMemeLigne } from "./geometrie";
import { defilerAveuglement } from "./defilement";
import { reviserApresMontage } from "./attente";
import { surveillerCurseur } from "./curseur";
import { surveillerSurvol } from "./survolFocus";
import { navigationOsdActive } from "../lecture/etatLecteurTv";

/**
 * Navigation spatiale à la télécommande.
 *
 * Le moteur écoute les touches, calcule le voisin géométriquement le plus
 * proche parmi ce que le document offre, et lui donne le focus. Aucun
 * composant n'est enregistré, aucun n'est modifié : `apps/web` ignore
 * l'existence du téléviseur, et un bouton ajouté demain sera navigable sans
 * que personne y pense.
 *
 * **Écoute en capture, et c'est délibéré.** Les rangées du client web posent
 * un `tabIndex` sur leur section et interceptent les flèches pour défiler
 * elles-mêmes ; sur un téléviseur ce comportement entrerait en conflit avec le
 * déplacement du focus. En capturant, le moteur voit l'événement avant elles
 * et l'arrête net.
 *
 * Le lecteur fait exception, mais à moitié : quand ses commandes sont
 * déployées, ce sont des boutons comme les autres et le moteur les parcourt
 * sans qu'on écrive une ligne. Le reste du temps — habillage masqué, ou
 * curseur fantôme en cours —, les flèches appartiennent au déplacement dans le
 * flux, et le moteur se retire. La condition se lit dans l'état du lecteur,
 * jamais dans le chemin seul.
 */

/** Route sur laquelle le moteur laisse la main aux raccourcis du lecteur. */
const CHEMIN_LECTEUR = "/watch";

/** La navigation latérale, qui obéit à des règles d'accès particulières. */
const SELECTEUR_RAIL = ".rail-tv";

export function installerMoteurFocus(): () => void {
  const arreterCurseur = surveillerCurseur();
  // Le pointeur déplace le focus, sous la même condition de suspension que les
  // flèches : ce qui vaut pour un mode d'entrée vaut pour l'autre.
  const arreterSurvol = surveillerSurvol(moteurSuspendu);

  // Toute arrivée du focus est notée, quelle qu'en soit l'origine — flèche,
  // pointeur, clic, ou restitution. Un seul écouteur délégué : les cartes vont
  // et viennent au gré du fenêtrage, et un abonnement par composant serait posé
  // et retiré sans arrêt.
  const surArrivee = (evenement: FocusEvent) => {
    if (placementEnCours()) return;
    const cible = evenement.target;
    if (cible instanceof HTMLElement) retenir(cible);
  };
  document.addEventListener("focusin", surArrivee, true);

  /**
   * Le focus PERDU, et rendu.
   *
   * C'est la garantie de la première règle — il y a toujours exactement un
   * élément focalisé — et elle ne pouvait pas tenir sans cela. Un élément
   * focalisé peut disparaître sous nos pieds sans qu'aucune route ne change :
   * la bannière d'accueil se re-rend quand ses données arrivent, React remplace
   * le nœud du bouton, et le focus tombe sur `<body>`. Mesuré, l'accueil restait
   * ainsi indéfiniment sans anneau après un démarrage à froid — la pose initiale
   * avait pourtant réussi, quelques centaines de millisecondes plus tôt.
   *
   * Le report d'un tour de boucle est nécessaire : `focusout` part AVANT que le
   * focus suivant ne soit posé, donc un déplacement ordinaire passerait ici pour
   * une perte. Au tour suivant, `elementActif()` répond et l'on ne fait rien.
   */
  const rendreLeFocus = () => {
    if (placementEnCours()) return;
    if (elementActif()) return;
    amorcerFocus();
  };

  const surPerte = () => setTimeout(rendreLeFocus, 0);
  document.addEventListener("focusout", surPerte, true);

  /**
   * Le chien de garde de la première règle.
   *
   * `focusout` réagit vite, mais il ne réagit que si l'on nous prévient — et il
   * y a au moins deux cas où personne ne prévient. React peut REMPLACER le nœud
   * focalisé au lieu de le retirer, et le focus tombe alors sur `<body>` sans
   * qu'aucun événement ne parte. Et un document qui n'a pas le focus système
   * n'émet aucun événement de focus du tout, ce qui arrive sur une dalle chaque
   * fois qu'une surcouche de la plateforme passe devant l'application.
   *
   * Une vérification par demi-seconde ferme ces cas sans rien supposer : c'est
   * une lecture de propriété, la dépense la plus faible qu'on puisse imaginer,
   * et elle ne fait quoi que ce soit que lorsque l'écran a réellement perdu son
   * anneau. On préfère cette dépense-là à un écran de salon où la télécommande
   * ne répond plus.
   */
  const INTERVALLE_GARDE_MS = 500;
  const garde = setInterval(rendreLeFocus, INTERVALLE_GARDE_MS);

  // Changer d'écran repose le focus. Sans cela, le premier appui sur une flèche
  // ne sert qu'à faire apparaître l'anneau.
  const arreterRoute = surveillerRoute(() => amorcerFocus(true));

  // Le mode d'entrée n'est PAS consulté ici, et c'est délibéré.
  //
  // On lisait `pointeurActif()` pour se mettre en veille tant que le curseur de
  // la Magic Remote était visible. La condition ne pouvait pas être vraie :
  // `surveillerCurseur` écoute `keydown` en capture et a été branché juste
  // au-dessus, donc il a déjà basculé en `dpad` quand on arrive ici. Le test
  // était mort — et le rétablir serait un défaut, pas un correctif. **Un appui
  // directionnel est précisément le signal que le pointeur a disparu** : c'est
  // ainsi que webOS traite la bascule, et refuser la flèche laisserait
  // l'utilisateur devant une télécommande muette jusqu'à ce qu'il bouge la
  // souris. Le survol, lui, se tait de son côté dès que le focus a changé.
  const surTouche = (evenement: KeyboardEvent) => {
    noterAppui();
    if (moteurSuspendu()) return;

    const intention = lireIntention(evenement);
    if (!intention || intention.type !== "deplacer") return;

    // Dans un champ de texte, gauche et droite déplacent le curseur de saisie —
    // les lui prendre rendrait la correction d'une frappe impossible. Haut et
    // bas, qu'un champ d'une seule ligne n'utilise pas, restent au moteur :
    // c'est par eux qu'on sort du champ. Sans cette distinction, entrer dans un
    // formulaire à la télécommande serait un aller sans retour.
    const cible = evenement.target instanceof HTMLElement ? evenement.target : null;
    if (estHorizontale(intention.direction) && estUnChampDeSaisie(cible)) return;

    evenement.preventDefault();
    evenement.stopPropagation();
    deplacer(intention.direction);
  };

  document.addEventListener("keydown", surTouche, true);

  return () => {
    document.removeEventListener("keydown", surTouche, true);
    document.removeEventListener("focusin", surArrivee, true);
    document.removeEventListener("focusout", surPerte, true);
    clearInterval(garde);
    arreterRoute();
    arreterSurvol();
    arreterCurseur();
  };
}

/**
 * Le préfixe doit s'arrêter à une frontière de segment.
 *
 * `startsWith("/tv/watch")` répondait vrai sur **`/tv/watchlist`** : le moteur
 * s'y croyait dans le lecteur, se suspendait faute d'habillage à piloter, et
 * Ma liste devenait entièrement impilotable — aucune flèche n'y faisait quoi que
 * ce soit. Le défaut ne se voyait pas au premier essai : on arrive sur cet écran
 * par le rail, dont les entrées gardent le focus, et tout semble normal jusqu'à
 * ce qu'on tente d'en descendre.
 */
function surLecteur(): boolean {
  const chemin = window.location.pathname;
  const base = `/tv${CHEMIN_LECTEUR}`;
  return chemin === base || chemin.startsWith(`${base}/`);
}

/** Le moteur ne rend la main que lorsque les commandes du lecteur sont là. */
function moteurSuspendu(): boolean {
  return surLecteur() && !navigationOsdActive();
}

/**
 * Un déplacement, en trois temps : viser, défiler si rien n'est visé, viser à
 * nouveau une fois les cartes montées.
 */
function deplacer(direction: Direction): void {
  if (viser(direction)) return;

  // Aucun voisin : soit on est au bord, soit la cible n'est pas montée. Le
  // fenêtrage des rangées vide une rangée entière dès qu'elle sort de l'écran,
  // et une carte non montée ne peut pas recevoir le focus.
  const depart = elementActif();
  if (!defilerAveuglement(depart, direction)) return;

  reviserApresMontage(() => viser(direction));
}

/** Cherche un voisin et lui donne le focus. Rend vrai s'il en a trouvé un. */
function viser(direction: Direction): boolean {
  const depart = elementActif();
  if (!depart) return viserPremier();

  const racine = conteneurPiegeant() ?? document;
  let candidats = recenser(racine).filter((candidat) => candidat.element !== depart);

  const depuis = boiteDepuisRectangle(depart.getBoundingClientRect());

  // Un déplacement horizontal reste dans sa rangée. Sans cela, la dernière
  // carte d'une piste voit à sa droite les éléments des rangées voisines — la
  // géométrie ne dit rien de l'appartenance — et le focus part au hasard, ce
  // qu'aucune interface de salon ne fait.
  //
  // Dans une PISTE, le confinement se lève au bout : la piste défile, ce qui
  // suit est atteint par `defilerAveuglement`. Dans une GRILLE, il ne se lève
  // pas — une ligne de grille est une fin, et « droite » depuis la dernière
  // carte ne doit pas descendre en diagonale sur la première de la suivante.
  // Une grille n'ayant aucun conteneur par ligne, la ligne se reconnaît aux
  // ordonnées.
  if (estHorizontale(direction)) {
    const piste = depart.closest("[data-tv-piste]");
    if (piste) {
      const dansLaPiste = candidats.filter((candidat) => piste.contains(candidat.element));
      if (meilleur(depuis, dansLaPiste, direction)) candidats = dansLaPiste;
    } else if (depart.closest("[data-tv-grille]")) {
      candidats = candidats.filter((candidat) => surLaMemeLigne(depuis, candidat.boite));
    }
  }

  // Le rail s'atteint par la gauche, mais pas depuis le contenu.
  //
  // Il couvre toute la hauteur de l'écran : sans règle, « bas » depuis une carte
  // y remonterait au lieu de descendre d'une rangée, la géométrie seule y voyant
  // un candidat parfaitement valable. Et « gauche » depuis la première carte
  // d'une rangée s'en échappait — on ne veut pas quitter le catalogue en
  // longeant une ligne.
  //
  // La porte reste le chrome de la page : retour, filtres, onglets, champ de
  // recherche. Ils sont déjà en haut à gauche, donc le geste ne change pas —
  // Haut jusqu'au chrome, puis Gauche — et aucune touche n'est inventée.
  const dansLeContenu = depart.closest("[data-tv-piste], [data-tv-grille]");
  const railAtteignable = direction === "gauche" && !dansLeContenu;
  if (!depart.closest(SELECTEUR_RAIL) && !railAtteignable) {
    candidats = candidats.filter((candidat) => !candidat.element.closest(SELECTEUR_RAIL));
  }

  const choisi = meilleur(depuis, candidats, direction);
  if (!choisi) return false;

  donnerFocus(choisi.element);
  return true;
}

/**
 * Aucun élément actif : au premier appui après un chargement d'écran, ou
 * quand l'élément qui portait le focus a été démonté sous nos pieds — ce qui
 * arrive précisément quand une rangée se vide.
 */
function viserPremier(): boolean {
  const cible = focusParDefaut(conteneurPiegeant() ?? document);
  if (!cible) return false;
  donnerFocus(cible);
  return true;
}
