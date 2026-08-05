import { estHorizontale, type Direction } from "./touches";
import { recenser, conteneurPiegeant } from "./candidats";
import { focusParDefaut } from "./defaut";
import { donnerFocus, elementActif } from "./actif";
import {
  meilleur,
  restreindreALaPremiereLigne,
  surLaMemeColonne,
  surLaMemeLigne,
} from "./geometrie";
import { boiteDeNavigation } from "./mesure";
import { defilerParPas } from "./defilement";
import { reviserApresMontage } from "./attente";
import {
  SELECTEUR_RAIL,
  dansLeRail,
  entreeDuRail,
  redirigerEntreeDeZone,
  sortieDuRail,
} from "./zones";

/**
 * Le déplacement du focus : viser un voisin, défiler s'il n'est pas monté,
 * viser à nouveau.
 *
 * Extrait de `moteur.ts`, qui garde les écouteurs et les conditions de
 * suspension : lui décide QUAND une touche appartient au déplacement, ce
 * module décide OÙ le focus va. La coupure suit la question qu'on se pose en
 * lisant un défaut — « pourquoi la touche n'a rien fait » se cherche là-bas,
 * « pourquoi le focus est parti LÀ » se cherche ici.
 */

/**
 * Budget d'attente d'un montage après un pas de défilement.
 *
 * Plus long que celui d'un déplacement ordinaire : le fenêtrage d'une liste
 * paresseuse — `RevealCell` monte le contenu d'une ligne à 600 px de la zone
 * visible — peut prendre quelques images de plus qu'une rangée virtualisée.
 */
const BUDGET_PAS_MS = 400;

/**
 * Un déplacement : viser, sinon défiler d'un pas et viser à nouveau une fois
 * les cartes montées — deux pas au plus, et TOUT est rendu si aucun focus
 * n'aboutit. La règle qu'on achète avec cette annulation : la page ne défile
 * jamais sans que le focus bouge. L'ancien pas aveugle de 60 % d'écran
 * laissait la page partie et le focus resté, ou pire — la carte focalisée
 * démontée par le fenêtrage, et le focus rendu au premier venu du haut de
 * page.
 */
export function deplacer(direction: Direction): void {
  if (viser(direction)) return;

  // Aucun voisin : soit on est au bord, soit la cible n'est pas montée. Le
  // fenêtrage des rangées vide une rangée entière dès qu'elle sort de l'écran,
  // et une carte non montée ne peut pas recevoir le focus.
  const annulerPremier = defilerParPas(elementActif(), direction);
  if (!annulerPremier) return;

  reviserApresMontage(() => viser(direction), {
    budgetMs: BUDGET_PAS_MS,
    auDelai: () => {
      // Un second pas absorbe une rangée plus haute que la moyenne ; au-delà,
      // il n'y a réellement rien, et l'on rend le terrain parcouru — dans
      // l'ordre inverse, chaque pas pouvant avoir touché un scroller différent.
      const annulerSecond = defilerParPas(elementActif(), direction);
      if (!annulerSecond) {
        annulerPremier();
        return;
      }
      reviserApresMontage(() => viser(direction), {
        budgetMs: BUDGET_PAS_MS,
        auDelai: () => {
          annulerSecond();
          annulerPremier();
        },
      });
    },
  });
}

/** Cherche un voisin et lui donne le focus. Rend vrai s'il en a trouvé un. */
export function viser(direction: Direction): boolean {
  const depart = elementActif();
  if (!depart) return viserPremier();

  const piege = conteneurPiegeant();

  // Le rail se navigue à part — sauf sous un dialogue, qui piège comme
  // partout : ses entrées se parcourent de haut en bas, la droite rend au
  // contenu ce qu'on lui avait pris, la gauche est le bord du monde.
  if (!piege && dansLeRail(depart)) return viserDansLeRail(depart, direction);

  const racine = piege ?? document;
  let candidats = recenser(racine).filter((candidat) => candidat.element !== depart);

  // La boîte de mise en page, pas celle du rendu : le départ est justement la
  // carte agrandie par le focus, la pire à mesurer transformée.
  const depuis = boiteDeNavigation(depart);

  // Un déplacement horizontal reste dans sa rangée. Sans cela, la dernière
  // carte d'une piste voit à sa droite les éléments des rangées voisines — la
  // géométrie ne dit rien de l'appartenance — et le focus part au hasard, ce
  // qu'aucune interface de salon ne fait.
  //
  // Dans une PISTE, le confinement se lève au bout : la piste défile, ce qui
  // suit est atteint par `defilerParPas`. Dans une GRILLE, il ne se lève
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
  } else {
    // Un déplacement VERTICAL en grille descend dans sa colonne. La géométrie
    // brute arbitrait sur tout l'écran — distance contre désalignement — et il
    // suffisait d'une rangée absente du recensement pour partir en diagonale,
    // deux rangées plus bas. La colonne d'abord ; si elle n'a pas de suite —
    // dernière rangée incomplète —, la première ligne rencontrée, et la carte
    // la moins désalignée y gagne. Si la grille n'offre plus rien dans cette
    // direction, la géométrie générale reprend : le chrome au-dessus, la suite
    // de la page en dessous restent atteignables.
    const grille = depart.closest("[data-tv-grille]");
    if (grille) {
      const dansLaGrille = candidats.filter((candidat) => grille.contains(candidat.element));
      const memeColonne = dansLaGrille.filter((candidat) =>
        surLaMemeColonne(depuis, candidat.boite),
      );
      if (meilleur(depuis, memeColonne, direction)) {
        candidats = memeColonne;
      } else {
        const premiereLigne = restreindreALaPremiereLigne(depuis, dansLaGrille, direction);
        if (premiereLigne.length > 0) candidats = premiereLigne;
      }
    }
  }

  // Le rail n'est JAMAIS un candidat géométrique. Il couvre toute la hauteur
  // de l'écran : sans cette règle, « bas » depuis une carte y remonterait au
  // lieu de descendre d'une rangée, la géométrie seule y voyant un candidat
  // parfaitement valable. On y ENTRE par la règle d'en dessous — gauche sans
  // issue —, jamais par un score.
  candidats = candidats.filter((candidat) => !candidat.element.closest(SELECTEUR_RAIL));

  const choisi = meilleur(depuis, candidats, direction);
  if (!choisi) {
    // « Gauche » sans voisin, c'est la demande du rail — depuis la première
    // colonne d'une grille, le début d'une piste rembobinée, le chrome. La
    // destination est l'écran COURANT, pas l'entrée la plus proche. Un
    // dialogue ouvert garde son piège : on ne s'en évade pas vers le rail.
    if (direction === "gauche" && !piege) {
      const entree = entreeDuRail();
      if (entree) {
        donnerFocus(entree);
        return true;
      }
    }
    return false;
  }

  // À l'arrivée dans une zone déclarée, la destination l'emporte sur la
  // géométrie — entrer par « Lecture », par la saison active. Les déplacements
  // INTERNES à la zone ne sont pas redirigés, sans quoi elle serait un piège.
  const redirige = redirigerEntreeDeZone(depart, choisi.element);
  donnerFocus(redirige ?? choisi.element);
  return true;
}

/**
 * Les déplacements depuis le rail, tous consommés : le rail est une zone
 * fermée. Haut et bas parcourent ses entrées — la géométrie voyait parfois
 * mieux ailleurs et s'échappait en diagonale dans le contenu. La droite
 * RESTITUE : l'élément qu'on avait en quittant le contenu, sinon ce que la
 * mémoire de route retrouve, sinon l'entrée par défaut de l'écran. La gauche
 * ne mène nulle part, et un pas de défilement n'y a pas sa place non plus.
 */
function viserDansLeRail(depart: HTMLElement, direction: Direction): boolean {
  if (direction === "gauche") return true;

  if (direction === "droite") {
    const sortie = sortieDuRail();
    if (sortie) donnerFocus(sortie);
    return true;
  }

  const depuis = boiteDeNavigation(depart);
  const candidats = recenser(document).filter(
    (candidat) => candidat.element !== depart && dansLeRail(candidat.element),
  );
  const choisi = meilleur(depuis, candidats, direction);
  if (choisi) donnerFocus(choisi.element);
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
