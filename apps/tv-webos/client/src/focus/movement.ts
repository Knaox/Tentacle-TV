import { isHorizontal, type Direction } from "./keys";
import { collect, trappingContainer } from "./candidates";
import { defaultFocus } from "./default";
import { giveFocus, activeElement } from "./active";
import {
  best,
  restrictToFirstRow,
  onSameColumn,
  onSameRow,
} from "@tentacle-tv/tv-core";
import { navBox } from "./measure";
import { scrollByStep } from "./scroll";
import { reviewAfterMount } from "./wait";
import { closeExpandedMenu } from "./expandedMenu";
import {
  RAIL_SELECTOR,
  inRail,
  railEntry,
  redirectZoneEntry,
  railExit,
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
const STEP_BUDGET_MS = 400;

/**
 * Le cycle en vol : ses révocations, et le numéro qui les périme.
 *
 * `move` est appelé une fois par appui, et la répétition automatique d'une
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
let currentCycle = 0;

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
export function move(direction: Direction): void {
  // Le numéro est pris AVANT toute chose : viser peut déplacer le focus, donc
  // rendre caduque la révocation d'un pas antérieur qui n'avait rien donné.
  const cycle = ++currentCycle;
  const stale = () => currentCycle !== cycle;

  if (aim(direction)) return;

  // Un piège borne tout ce qui suit : rien de ce qui lui est extérieur ne doit
  // bouger sous lui, et un menu déployé est le cas courant. Relu une fois et
  // passé aux deux pas, plutôt que redemandé à chaque tentative.
  const trap = trappingContainer();

  // Aucun voisin : soit on est au bord, soit la cible n'est pas montée. Le
  // fenêtrage des rangées vide une rangée entière dès qu'elle sort de l'écran,
  // et une carte non montée ne peut pas recevoir le focus.
  const first = scrollByStep(activeElement(), direction, trap);
  if (!first) return;

  reviewAfterMount(() => aim(direction), {
    budgetMs: STEP_BUDGET_MS,
    onTimeout: () => {
      if (stale()) return;
      // Un second pas absorbe une rangée plus haute que la moyenne ; au-delà,
      // il n'y a réellement rien, et l'on rend le terrain parcouru — dans
      // l'ordre inverse, chaque pas pouvant avoir touché un scroller
      // différent — sauf ce qui a accosté un bord.
      const second = scrollByStep(activeElement(), direction, trap);
      if (!second) {
        if (!first.docked) first.cancel();
        return;
      }
      reviewAfterMount(() => aim(direction), {
        budgetMs: STEP_BUDGET_MS,
        onTimeout: () => {
          if (stale()) return;
          if (second.docked || first.docked) return;
          second.cancel();
          first.cancel();
        },
      });
    },
  });
}

/** Cherche un voisin et lui donne le focus. Rend vrai s'il en a trouvé un. */
export function aim(direction: Direction): boolean {
  const start = activeElement();
  if (!start) return aimFirst();

  const trap = trappingContainer();

  // Le rail se navigue à part — sauf sous un dialogue, qui piège comme
  // partout : ses entrées se parcourent de haut en bas, la droite rend au
  // contenu ce qu'on lui avait pris, la gauche est le bord du monde.
  if (!trap && inRail(start)) return aimInRail(start, direction);

  const root = trap ?? document;
  let candidates = collect(root).filter((candidate) => candidate.element !== start);

  // Le rail n'est JAMAIS un candidat géométrique. Il couvre toute la hauteur
  // de l'écran : sans cette règle, « bas » depuis une carte y remonterait au
  // lieu de descendre d'une rangée, la géométrie seule y voyant un candidat
  // parfaitement valable. On y ENTRE par la règle d'en dessous — gauche sans
  // issue —, jamais par un score. Écarté AVANT les confinements : une entrée
  // du rail ne doit pas non plus servir de bande de référence à la
  // restriction verticale.
  candidates = candidates.filter((candidate) => !candidate.element.closest(RAIL_SELECTOR));

  // La boîte de mise en page, pas celle du rendu : le départ est justement la
  // carte agrandie par le focus, la pire à mesurer transformée.
  const since = navBox(start);

  // Un déplacement horizontal reste dans sa rangée, et il y reste JUSQU'AU
  // BOUT. Sans cela, la dernière carte d'une piste voit à sa droite les
  // éléments des rangées voisines — la géométrie ne dit rien de
  // l'appartenance — et le focus part au hasard, ce qu'aucune interface de
  // salon ne fait.
  //
  // Le confinement se levait au bout, au motif que la piste défile et que ce
  // qui suit est atteint par `scrollByStep`. Le raisonnement se mordait la
  // queue : une fois le confinement levé, la géométrie trouve toujours
  // QUELQUE CHOSE — une carte de la rangée d'en dessous, en diagonale — donc
  // `aim` réussit et l'on n'atteint jamais le pas de défilement. Vécu sur un
  // carrousel : arrivé au bout de « Reprendre la lecture », le focus tombait
  // dans la rangée suivante au lieu de s'arrêter.
  //
  // Confiné jusqu'au bout, le protocole reprend son sens : plus de voisin dans
  // la piste, donc `aim` échoue, donc `scrollByStep` fait glisser la
  // rangée, et l'on vise à nouveau DANS la piste — c'est ainsi qu'on parcourt
  // une rangée dont la fin n'est pas montée. Au vrai bout, il n'y a plus de
  // mou : le pas est refusé et le focus ne bouge pas. « Gauche » garde sa
  // porte de sortie vers le rail, qui est traitée plus bas, faute de candidat.
  //
  // Une GRILLE se confine de la même façon, mais par les ordonnées : elle n'a
  // aucun conteneur par ligne.
  if (isHorizontal(direction)) {
    const track = start.closest("[data-tv-piste]");
    if (track) {
      candidates = candidates.filter((candidate) => track.contains(candidate.element));
    } else if (start.closest("[data-tv-grille]")) {
      candidates = candidates.filter((candidate) => onSameRow(since, candidate.box));
    }
  } else {
    // Un déplacement VERTICAL en grille descend dans sa colonne. La géométrie
    // brute arbitrait sur tout l'écran — distance contre désalignement — et il
    // suffisait d'une rangée absente du recensement pour partir en diagonale,
    // deux rangées plus bas. La colonne d'abord ; si elle n'a pas de suite —
    // dernière rangée incomplète —, la première ligne rencontrée, et la carte
    // la moins désalignée y gagne.
    const grid = start.closest("[data-tv-grille]");
    let confine = false;
    if (grid) {
      const inGrid = candidates.filter((candidate) => grid.contains(candidate.element));
      const sameColumn = inGrid.filter((candidate) =>
        onSameColumn(since, candidate.box),
      );
      if (best(since, sameColumn, direction)) {
        candidates = sameColumn;
        confine = true;
      } else {
        const firstLine = restrictToFirstRow(since, inGrid, direction);
        if (firstLine.length > 0) {
          candidates = firstLine;
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
      const band = restrictToFirstRow(since, candidates, direction);
      if (band.length > 0) candidates = band;
    }
  }

  const chosen = best(since, candidates, direction);
  if (!chosen) {
    // « Gauche » sans voisin, c'est la demande du rail — depuis la première
    // colonne d'une grille, le début d'une piste rembobinée, le chrome. La
    // destination est l'écran COURANT, pas l'entrée la plus proche. Un
    // dialogue ouvert garde son piège : on ne s'en évade pas vers le rail.
    if (direction === "gauche" && !trap) {
      const entry = railEntry();
      if (entry) {
        giveFocus(entry);
        return true;
      }
    }

    // « Haut » depuis le début d'un menu déployé le referme, et rend le focus
    // à la pastille qui l'a ouvert. Sans cela, remonter au-delà de la première
    // ligne ne faisait rien — la seule issue était Retour, qu'il fallait avoir
    // deviné. Le geste est celui qu'on a déjà fait pour entrer, à l'envers.
    //
    // Un dialogue n'a pas de déclencheur `aria-expanded` : `closeExpandedMenu`
    // rend faux, et une modale reste ce qu'elle est — une surface dont on sort
    // par Retour.
    if (direction === "haut" && trap) return closeExpandedMenu(trap);

    return false;
  }

  // À l'arrivée dans une zone déclarée, la destination l'emporte sur la
  // géométrie — entrer par « Lecture », par la saison active. Les déplacements
  // INTERNES à la zone ne sont pas redirigés, sans quoi elle serait un piège.
  const redirected = redirectZoneEntry(start, chosen.element);
  giveFocus(redirected ?? chosen.element);
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
function aimInRail(start: HTMLElement, direction: Direction): boolean {
  if (direction === "gauche") return true;

  if (direction === "droite") {
    const exit = railExit();
    if (exit) giveFocus(exit);
    return true;
  }

  const since = navBox(start);
  const candidates = collect(document).filter(
    (candidate) => candidate.element !== start && inRail(candidate.element),
  );
  const chosen = best(since, candidates, direction);
  if (chosen) giveFocus(chosen.element);
  return true;
}

/**
 * Aucun élément actif : au premier appui après un chargement d'écran, ou
 * quand l'élément qui portait le focus a été démonté sous nos pieds — ce qui
 * arrive précisément quand une rangée se vide.
 */
function aimFirst(): boolean {
  const target = defaultFocus(trappingContainer() ?? document);
  if (!target) return false;
  giveFocus(target);
  return true;
}
