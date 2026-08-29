import { lireIntention, isHorizontal } from "./keys";
import { estUnChampDeSaisie } from "./candidates";
import { retenir } from "./memory";
import { surveillerRoute } from "./route";
import { amorcerFocus, noterAppui, placementEnCours } from "./entry";
import { elementActif } from "./active";
import { deplacer } from "./movement";
import { invaliderContenu, retenirContenu } from "./zones";
import { surveillerCurseur } from "./cursor";
import { surveillerSurvol } from "./hoverFocus";
import { surveillerDefilementCurseur } from "./cursorScroll";
import { dansLaFenetre } from "./measure";
import { clavierSystemeVisible, surveillerClavierSysteme } from "./systemKeyboard";
import { osdNavigationActive } from "@tentacle-tv/tv-core";

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
 *
 * Le calcul du déplacement lui-même — viser, défiler, viser à nouveau — vit
 * dans `movement.ts` : ici se décide QUAND une touche appartient au
 * déplacement, là-bas OÙ le focus va.
 */

/** Route sur laquelle le moteur laisse la main aux raccourcis du lecteur. */
const CHEMIN_LECTEUR = "/watch";

export function installerMoteurFocus(): () => void {
  const arreterCurseur = surveillerCurseur();
  // Le clavier système du téléviseur : tant qu'il est monté, les flèches lui
  // appartiennent. Branché en premier, comme le curseur — la suspension doit
  // être connue avant le premier appui.
  const arreterClavier = surveillerClavierSysteme();
  // Le pointeur déplace le focus, sous la même condition de suspension que les
  // flèches : ce qui vaut pour un mode d'entrée vaut pour l'autre.
  const arreterSurvol = surveillerSurvol(moteurSuspendu);
  // Et il fait DÉFILER quand il vise un bord — le geste de webOS, sous la même
  // condition de suspension. Le focus, lui, ne suit pas : il est réancré à
  // l'arrêt, et seulement s'il a quitté la fenêtre (cf. `cursorScroll.ts`).
  const arreterDefilementCurseur = surveillerDefilementCurseur(moteurSuspendu, reancrerFocus);

  // Toute arrivée du focus est notée, quelle qu'en soit l'origine — flèche,
  // pointeur, clic, ou restitution. Un seul écouteur délégué : les cartes vont
  // et viennent au gré du fenêtrage, et un abonnement par composant serait posé
  // et retiré sans arrêt. Deux mémoires s'alimentent ici : la clé de route,
  // pour les retours d'écran, et la référence vivante du contenu, pour la
  // sortie du rail — chacune filtre elle-même ce qui ne la regarde pas.
  const surArrivee = (evenement: FocusEvent) => {
    if (placementEnCours()) return;
    const cible = evenement.target;
    if (cible instanceof HTMLElement) {
      retenir(cible);
      retenirContenu(cible);
    }
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

  // Changer d'écran repose le focus — et invalide la référence vivante du
  // contenu : la restituer sur le nouvel écran viserait un nœud démonté avec
  // l'ancien. Sans la repose, le premier appui sur une flèche ne sert qu'à
  // faire apparaître l'anneau.
  const arreterRoute = surveillerRoute(() => {
    invaliderContenu();
    amorcerFocus(true);
  });

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
    if (isHorizontal(intention.direction) && estUnChampDeSaisie(cible)) return;

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
    arreterDefilementCurseur();
    arreterSurvol();
    arreterClavier();
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

/**
 * Le moteur ne rend la main que lorsque les commandes du lecteur sont là —
 * et il se retire entièrement tant que le clavier système occupe l'écran.
 *
 * Ce second cas n'est pas un choix de confort : les flèches appartiennent
 * alors au clavier, qui déplace la sélection sur ses touches. Les lui prendre
 * produit le défaut que LG documente sans contournement — le focus qui
 * « cascade » à travers la page après une validation.
 */
function moteurSuspendu(): boolean {
  if (clavierSystemeVisible()) return true;
  return surLecteur() && !osdNavigationActive();
}

/**
 * Reposer l'anneau après un défilement au pointeur.
 *
 * On ne cherche pas à SUIVRE la vue pendant le geste : ce serait un
 * recensement complet par image, et le pointeur est de toute façon la
 * désignation tant qu'il est là. Mais l'abandonner hors champ casserait la
 * première règle du moteur — un appui de flèche ramènerait la vue là où
 * l'anneau est resté, par `amenerEnVue`, annulant le geste qu'on vient de
 * faire.
 *
 * Un seul passage, à l'arrêt, et seulement si l'anneau a réellement quitté la
 * fenêtre. `amorcerFocus` sait choisir une cible sensée sur l'écran courant.
 */
function reancrerFocus(): void {
  const actif = document.activeElement;
  if (actif instanceof HTMLElement && actif !== document.body && dansLaFenetre(actif)) return;
  amorcerFocus();
}
