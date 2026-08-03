import { lireIntention, estHorizontale, sens } from "../focus/touches";
import { creerCadence } from "./cadenceMaintien";
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
  const cadence = creerCadence();

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
      const palier = cadence.mesurer(evenement.keyCode, Date.now());
      actions.scrub.pas(sens(intention.direction), palier);
      return;
    }

    if (intention.type === "valider") {
      if (etat.mode === "scrub") {
        actions.scrub.confirmer();
        return;
      }
      if (etat.mode === "repos") {
        montrerOsd();
        return;
      }
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
      const direction = intention.commande === "avance" ? 1 : -1;
      const palier = cadence.mesurer(evenement.keyCode, Date.now());
      actions.scrub.pas(direction, palier);
      return;
    }

    // Lecture, pause : la touche de transport confirme un scrub en cours plutôt
    // que de reprendre à l'ancienne position — c'est le geste qu'on fait quand
    // on a trouvé où l'on voulait aller.
    if (etat.mode === "scrub") {
      actions.scrub.confirmer();
      return;
    }
    actions.basculerLecture();
    montrerOsd();
  };

  const surRelachement = (): void => cadence.relacher();

  document.addEventListener("keydown", surTouche, true);
  document.addEventListener("keyup", surRelachement, true);

  return () => {
    document.removeEventListener("keydown", surTouche, true);
    document.removeEventListener("keyup", surRelachement, true);
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
