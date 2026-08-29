import { isHorizontal, type Direction } from "./keys";
import { recenser, conteneurPiegeant } from "./candidates";
import { focusParDefaut } from "./default";
import { donnerFocus, elementActif } from "./active";
import {
  best,
  restrictToFirstRow,
  onSameColumn,
  onSameRow,
} from "@tentacle-tv/tv-core";
import { boiteDeNavigation } from "./measure";
import { defilerParPas } from "./scroll";
import { reviserApresMontage } from "./wait";
import { fermerMenuDeploye } from "./expandedMenu";
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
 * Extrait de `engine.ts`, qui garde les écouteurs et les conditions de
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
 * Le cycle en vol : ses révocations, et le numéro qui les périme.
 *
 * `deplacer` est appelé une fois par appui, et la répétition automatique d'une
 * télécommande en produit une dizaine par seconde. Rien n'empêchait deux
 * cycles de se chevaucher : chacun capturait sa position de départ, chacun
 * armait ses minuteurs de 400 ms, et le dernier à s'exécuter restaurait une
 * position devenue arbitraire. Mesuré sur l'accueil : la page atteignait bien
 * le haut, puis redescendait de cent vingt et un pixels — la révocation d'un
 * cycle antérieur, dont la position de référence datait d'avant les autres.
 *
 * Un nouvel appui périme donc les révocations pendantes : il adopte la
 * position courante, quelle qu'elle soit, comme nouvelle référence.
 */
let cycleCourant = 0;

/**
 * Un déplacement : viser, sinon défiler d'un pas et viser à nouveau une fois
 * les cartes montées — deux pas au plus, et TOUT est rendu si aucun focus
 * n'aboutit. La règle qu'on achète avec cette annulation : la page ne défile
 * jamais sans que le focus bouge. L'ancien pas aveugle de 60 % d'écran
 * laissait la page partie et le focus resté, ou pire — la carte focalisée
 * démontée par le fenêtrage, et le focus rendu au premier venu du haut de
 * page.
 *
 * L'EXCEPTION, et elle est voulue : un pas qui a ACCOSTÉ — écrit jusqu'au
 * bord du document — n'est pas rendu. Appuyer « haut » au premier élément
 * d'une bibliothèque est une demande explicite : montrer ce qui précède — la
 * bannière entière —, même si aucun focusable ne s'y trouve. La révocation
 * transformait ce geste en aller-retour : la page sautait au bord puis
 * revenait, huit dixièmes de seconde plus tard, comme si la barre refusait
 * d'atteindre le bout. Le bord est une destination ; on y reste.
 */
export function deplacer(direction: Direction): void {
  // Le numéro est pris AVANT toute chose : viser peut déplacer le focus, donc
  // rendre caduque la révocation d'un pas antérieur qui n'avait rien donné.
  const cycle = ++cycleCourant;
  const perime = () => cycleCourant !== cycle;

  if (viser(direction)) return;

  // Un piège borne tout ce qui suit : rien de ce qui lui est extérieur ne doit
  // bouger sous lui, et un menu déployé est le cas courant. Relu une fois et
  // passé aux deux pas, plutôt que redemandé à chaque tentative.
  const piege = conteneurPiegeant();

  // Aucun voisin : soit on est au bord, soit la cible n'est pas montée. Le
  // fenêtrage des rangées vide une rangée entière dès qu'elle sort de l'écran,
  // et une carte non montée ne peut pas recevoir le focus.
  const premier = defilerParPas(elementActif(), direction, piege);
  if (!premier) return;

  reviserApresMontage(() => viser(direction), {
    budgetMs: BUDGET_PAS_MS,
    auDelai: () => {
      if (perime()) return;
      // Un second pas absorbe une rangée plus haute que la moyenne ; au-delà,
      // il n'y a réellement rien, et l'on rend le terrain parcouru — dans
      // l'ordre inverse, chaque pas pouvant avoir touché un scroller
      // différent — sauf ce qui a accosté un bord.
      const second = defilerParPas(elementActif(), direction, piege);
      if (!second) {
        if (!premier.accoste) premier.annuler();
        return;
      }
      reviserApresMontage(() => viser(direction), {
        budgetMs: BUDGET_PAS_MS,
        auDelai: () => {
          if (perime()) return;
          if (second.accoste || premier.accoste) return;
          second.annuler();
          premier.annuler();
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

  // Le rail n'est JAMAIS un candidat géométrique. Il couvre toute la hauteur
  // de l'écran : sans cette règle, « bas » depuis une carte y remonterait au
  // lieu de descendre d'une rangée, la géométrie seule y voyant un candidat
  // parfaitement valable. On y ENTRE par la règle d'en dessous — gauche sans
  // issue —, jamais par un score. Écarté AVANT les confinements : une entrée
  // du rail ne doit pas non plus servir de bande de référence à la
  // restriction verticale.
  candidats = candidats.filter((candidat) => !candidat.element.closest(SELECTEUR_RAIL));

  // La boîte de mise en page, pas celle du rendu : le départ est justement la
  // carte agrandie par le focus, la pire à mesurer transformée.
  const depuis = boiteDeNavigation(depart);

  // Un déplacement horizontal reste dans sa rangée, et il y reste JUSQU'AU
  // BOUT. Sans cela, la dernière carte d'une piste voit à sa droite les
  // éléments des rangées voisines — la géométrie ne dit rien de
  // l'appartenance — et le focus part au hasard, ce qu'aucune interface de
  // salon ne fait.
  //
  // Le confinement se levait au bout, au motif que la piste défile et que ce
  // qui suit est atteint par `defilerParPas`. Le raisonnement se mordait la
  // queue : une fois le confinement levé, la géométrie trouve toujours
  // QUELQUE CHOSE — une carte de la rangée d'en dessous, en diagonale — donc
  // `viser` réussit et l'on n'atteint jamais le pas de défilement. Vécu sur un
  // carrousel : arrivé au bout de « Reprendre la lecture », le focus tombait
  // dans la rangée suivante au lieu de s'arrêter.
  //
  // Confiné jusqu'au bout, le protocole reprend son sens : plus de voisin dans
  // la piste, donc `viser` échoue, donc `defilerParPas` fait glisser la
  // rangée, et l'on vise à nouveau DANS la piste — c'est ainsi qu'on parcourt
  // une rangée dont la fin n'est pas montée. Au vrai bout, il n'y a plus de
  // mou : le pas est refusé et le focus ne bouge pas. « Gauche » garde sa
  // porte de sortie vers le rail, qui est traitée plus bas, faute de candidat.
  //
  // Une GRILLE se confine de la même façon, mais par les ordonnées : elle n'a
  // aucun conteneur par ligne.
  if (isHorizontal(direction)) {
    const piste = depart.closest("[data-tv-piste]");
    if (piste) {
      candidats = candidats.filter((candidat) => piste.contains(candidat.element));
    } else if (depart.closest("[data-tv-grille]")) {
      candidats = candidats.filter((candidat) => onSameRow(depuis, candidat.box));
    }
  } else {
    // Un déplacement VERTICAL en grille descend dans sa colonne. La géométrie
    // brute arbitrait sur tout l'écran — distance contre désalignement — et il
    // suffisait d'une rangée absente du recensement pour partir en diagonale,
    // deux rangées plus bas. La colonne d'abord ; si elle n'a pas de suite —
    // dernière rangée incomplète —, la première ligne rencontrée, et la carte
    // la moins désalignée y gagne.
    const grille = depart.closest("[data-tv-grille]");
    let confine = false;
    if (grille) {
      const dansLaGrille = candidats.filter((candidat) => grille.contains(candidat.element));
      const memeColonne = dansLaGrille.filter((candidat) =>
        onSameColumn(depuis, candidat.box),
      );
      if (best(depuis, memeColonne, direction)) {
        candidats = memeColonne;
        confine = true;
      } else {
        const premiereLigne = restrictToFirstRow(depuis, dansLaGrille, direction);
        if (premiereLigne.length > 0) {
          candidats = premiereLigne;
          confine = true;
        }
      }
    }

    // Hors grille — et quand une grille n'offre plus rien dans la direction —,
    // le mouvement s'arrête à la PREMIÈRE bande rencontrée : la ligne visuelle
    // du candidat le plus proche, où le score existant départage, puis la
    // redirection de zone s'applique au gagnant, inchangée. La géométrie brute
    // sur tout l'écran faisait gagner ce qui s'ALIGNE au départ plutôt que ce
    // qui le SUIT : sur une fiche, « bas » depuis Retour filait à la tuile
    // d'extras qui partage sa gouttière — désalignement nul — par-dessus la
    // rangée des actions, et « bas » depuis une pastille ronde enjambait
    // extras et saisons jusqu'à la ligne d'épisode, pleine largeur donc
    // jamais désalignée. S'arrêter à la première bande rend au « bas » de
    // salon son sens : le bloc SUIVANT, jamais deux plus loin.
    if (!confine) {
      const bande = restrictToFirstRow(depuis, candidats, direction);
      if (bande.length > 0) candidats = bande;
    }
  }

  const choisi = best(depuis, candidats, direction);
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

    // « Haut » depuis le début d'un menu déployé le referme, et rend le focus
    // à la pastille qui l'a ouvert. Sans cela, remonter au-delà de la première
    // ligne ne faisait rien — la seule issue était Retour, qu'il fallait avoir
    // deviné. Le geste est celui qu'on a déjà fait pour entrer, à l'envers.
    //
    // Un dialogue n'a pas de déclencheur `aria-expanded` : `fermerMenuDeploye`
    // rend faux, et une modale reste ce qu'elle est — une surface dont on sort
    // par Retour.
    if (direction === "haut" && piege) return fermerMenuDeploye(piege);

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
  const choisi = best(depuis, candidats, direction);
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
