import { lireIntention, estHorizontale, sens } from "../focus/touches";
import { creerMoteurMaintien } from "./moteurMaintien";
import { activerSautFocalise } from "./BoutonSautTv";
import type { MachineScrub } from "./machineScrub";
import { lireEtat, montrerOsd } from "./etatLecteurTv";

/**
 * L'arbitre unique des touches sur le lecteur.
 *
 * Trois écouteurs se disputaient les flèches : le moteur de focus, qui se
 * retirait de toute la route ; les touches de transport globales, qui écrivent
 * `currentTime` en dur ; et `usePlayerHotkeys` du client web, qui traduit les
 * flèches en sauts de trente secondes. **On n'arbitre pas par l'ordre
 * d'installation** — `stopPropagation` n'empêche pas les autres écouteurs du
 * même nœud de tirer dans la même phase, seule la remontée est coupée. La règle
 * se lit donc dans l'état : à chaque touche un propriétaire, déduit du mode.
 *
 * Ce que cet écouteur absorbe, il l'absorbe pour de bon : `preventDefault` et
 * `stopPropagation` sur tout ce qu'il reconnaît. C'est ce qui met
 * `usePlayerHotkeys`, qui écoute en bulle sur la fenêtre, hors du chemin — sans
 * quoi une flèche droite déplacerait le curseur fantôme ET sauterait de trente
 * secondes.
 *
 * En mode `osd`, les flèches ne lui appartiennent pas : le moteur de focus a
 * déjà tiré, sur le même nœud, avant lui. Il se contente de les absorber. Et il
 * le fait sans condition, parce que le moteur, lui, se retire quand le pointeur
 * de la Magic Remote est visible — laisser passer dans ce cas rendrait la main
 * à `usePlayerHotkeys`.
 *
 * La touche Retour n'est PAS traitée ici : elle a sa propre pile de
 * consommateurs, à laquelle le lecteur s'inscrit comme la recherche.
 */

export interface ActionsLecteurTv {
  basculerLecture: () => void;
  quitter: () => void;
  scrub: MachineScrub;
}

/**
 * Les actions sont lues à CHAQUE touche, jamais capturées à l'installation :
 * les rappels du lecteur changent d'identité à chaque rendu, et réattacher un
 * écouteur en capture à chaque image lui ferait manquer des appuis.
 */
export function installerTouchesLecteurTv(lire: () => ActionsLecteurTv): () => void {
  // Le moteur possède l'avance : appui simple comme tic de maintien passent
  // par lui, et lui seul décide du palier. Les actions sont relues à chaque
  // pas, tic compris — un tic qui part une seconde après l'appui doit joindre
  // le lecteur d'alors, pas celui d'avant.
  const moteur = creerMoteurMaintien({
    avancer: (direction, palier) => lire().scrub.pas(direction, palier),
  });

  /**
   * Instant de la dernière sortie de déplacement, pour avaler son écho.
   *
   * Confirmer remet l'habillage à l'écran, boutons compris. La touche qui vient
   * de confirmer est encore enfoncée, la dalle la répète — et cette répétition
   * trouve désormais un bouton focalisé sous elle. Un OK tenu un peu trop
   * longtemps validait la position PUIS mettait la lecture en pause, ce qui n'a
   * l'air d'un défaut de plus que parce qu'on ne voit pas le lien.
   *
   * C'est le même écho qu'`apps/tv` avale sur 400 ms (`SCRUB_TWIN_PRESS_MS`),
   * pour une cause différente — là-bas deux événements pour un seul appui, ici
   * la répétition automatique. La parade est la même.
   */
  let finDeplacement = 0;
  const ECHO_SORTIE_MS = 400;

  const echoDeSortie = (): boolean => Date.now() - finDeplacement < ECHO_SORTIE_MS;

  const surTouche = (evenement: KeyboardEvent): void => {
    const intention = lireIntention(evenement);
    if (!intention || intention.type === "retour") return;

    const etat = lireEtat();
    if (!etat.monte) return;

    const actions = lire();
    evenement.preventDefault();
    evenement.stopPropagation();

    if (intention.type === "deplacer") {
      if (etat.mode === "osd") return;
      if (!estHorizontale(intention.direction)) {
        if (etat.mode === "repos") montrerOsd();
        return;
      }
      moteur.appuyer(evenement.keyCode, sens(intention.direction));
      return;
    }

    if (intention.type === "valider") {
      if (etat.mode === "scrub") {
        actions.scrub.confirmer();
        finDeplacement = Date.now();
        return;
      }
      if (etat.mode === "repos") {
        // Un bouton « passer » paraît alors que l'habillage est éteint et
        // prend le focus. Tant qu'il le tient, OK lui appartient — c'est le
        // seul geste qui change de propriétaire, les flèches gardent le leur.
        if (activerSautFocalise()) return;
        montrerOsd();
        return;
      }
      if (echoDeSortie()) return;
      activerElementFocalise();
      return;
    }

    // Transport.
    if (intention.commande === "arret") {
      if (etat.mode === "scrub") actions.scrub.annuler();
      actions.quitter();
      return;
    }

    if (intention.commande === "avance" || intention.commande === "retour") {
      moteur.appuyer(evenement.keyCode, intention.commande === "avance" ? 1 : -1);
      return;
    }

    // Lecture, pause : la touche de transport confirme un scrub en cours plutôt
    // que de reprendre à l'ancienne position — c'est le geste qu'on fait quand
    // on a trouvé où l'on voulait aller.
    if (etat.mode === "scrub") {
      actions.scrub.confirmer();
      finDeplacement = Date.now();
      return;
    }
    if (echoDeSortie()) return;
    actions.basculerLecture();
    montrerOsd();
  };

  const surRelachement = (): void => moteur.relacher();

  document.addEventListener("keydown", surTouche, true);
  document.addEventListener("keyup", surRelachement, true);

  return () => {
    document.removeEventListener("keydown", surTouche, true);
    document.removeEventListener("keyup", surRelachement, true);
    // Sans quoi un tic de maintien survivrait au démontage du lecteur et
    // continuerait de pousser le curseur d'un écran qui n'est plus là.
    moteur.detruire();
  };
}

/**
 * Le `preventDefault` ci-dessus a supprimé l'activation native d'Entrée ; on la
 * rejoue explicitement. C'est le parti pris de `CarteFocusable` : un clic
 * déclenché à la main est un clic dont on connaît le nombre, là où compter sur
 * la synthèse du moteur en dépend.
 */
function activerElementFocalise(): void {
  const actif = document.activeElement;
  if (actif instanceof HTMLElement && actif !== document.body) actif.click();
}
