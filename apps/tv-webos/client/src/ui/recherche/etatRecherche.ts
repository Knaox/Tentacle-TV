import { useSyncExternalStore } from "react";

/**
 * L'ouverture de la recherche, hors de l'arbre React.
 *
 * La recherche est ouverte depuis le rail et fermée par la touche Retour, dont
 * le consommateur est installé au démarrage, très loin de tout composant. Un
 * contexte obligerait à faire descendre un état d'un bout à l'autre de la
 * disposition pour deux booléens ; un magasin externe se lit d'où l'on veut,
 * c'est le motif déjà employé par `usePinnedNav` et `useUserId`.
 *
 * **Pas une route.** Les routes sont déclarées dans `App.tsx`, qu'on ne modifie
 * pas — et le client web ne fait pas autrement : sa recherche est un portail
 * ouvert par un raccourci, jamais une adresse. Le rail pointait vers
 * `/recherche`, qui n'existe nulle part et tombait sur la page « introuvable » :
 * la première entrée du rail était morte.
 */

let ouverte = false;
const auditeurs = new Set<() => void>();

function notifier(): void {
  auditeurs.forEach((auditeur) => auditeur());
}

function sAbonner(rappel: () => void): () => void {
  auditeurs.add(rappel);
  return () => {
    auditeurs.delete(rappel);
  };
}

function lireInstantane(): boolean {
  return ouverte;
}

export function ouvrirRecherche(): void {
  if (ouverte) return;
  ouverte = true;
  notifier();
}

/** Rend vrai si la recherche était ouverte — c'est ce qu'attend la pile Retour. */
export function fermerRecherche(): boolean {
  if (!ouverte) return false;
  ouverte = false;
  notifier();
  return true;
}

export function useRechercheOuverte(): boolean {
  return useSyncExternalStore(sAbonner, lireInstantane);
}
