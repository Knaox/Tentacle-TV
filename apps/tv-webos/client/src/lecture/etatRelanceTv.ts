import { useSyncExternalStore } from "react";

/**
 * Ce que la veille de gel fait au lecteur, dit à l'écran.
 *
 * La veille recharge la source — `load()` puis repositionnement — sans qu'aucun
 * état de React ne bouge. Pendant une seconde ou deux, l'utilisateur voit donc
 * une image figée virer au noir puis revenir, sans que rien n'ait annoncé que
 * l'application travaillait. C'est le pire moment pour se taire : c'est
 * exactement celui où l'on se demande si le téléviseur a planté.
 *
 * Magasin externe plutôt que contexte, pour la même raison qu'`etatLecteurTv` :
 * l'écrivain est un `setInterval` posé hors de l'arbre, et le lecteur est une
 * surcouche montée ailleurs. L'instantané ne change de référence que si quelque
 * chose a changé — React boucle sur « The result of getSnapshot should be
 * cached » à la moindre fabrication d'objet.
 */

export interface EtatRelanceTv {
  /** Un rechargement est en cours : entre `load()` et la reprise. */
  enCours: boolean;
  /** Rechargements pour la source courante, depuis le début. */
  relances: number;
}

const INITIAL: EtatRelanceTv = { enCours: false, relances: 0 };

let etat: EtatRelanceTv = INITIAL;
const auditeurs = new Set<() => void>();

function poser(suivant: EtatRelanceTv): void {
  if (suivant.enCours === etat.enCours && suivant.relances === etat.relances) return;
  etat = suivant;
  auditeurs.forEach((auditeur) => auditeur());
}

export function sAbonnerRelance(rappel: () => void): () => void {
  auditeurs.add(rappel);
  return () => {
    auditeurs.delete(rappel);
  };
}

export function lireRelances(): EtatRelanceTv {
  return etat;
}

export function useEtatRelanceTv(): EtatRelanceTv {
  return useSyncExternalStore(sAbonnerRelance, lireRelances);
}

/** Un rechargement commence. */
export function signalerRelance(): void {
  poser({ enCours: true, relances: etat.relances + 1 });
}

/** Les métadonnées sont relues, la position reposée : l'image va revenir. */
export function signalerRelanceAboutie(): void {
  poser({ ...etat, enCours: false });
}

/** Nouvelle source : le compte repart, et rien n'est en cours. */
export function reinitialiserRelances(): void {
  poser(INITIAL);
}
